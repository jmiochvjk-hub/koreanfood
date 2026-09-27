import { createClient } from "npm:@supabase/supabase-js@2";

const REVIEW_PHOTO_BUCKET = "review-photos";
const ALLOWED_ORIGINS = new Set([
  "https://banfantujian.com",
  "https://www.banfantujian.com",
  "http://127.0.0.1:4173",
  "http://localhost:4173",
]);
const BLOCKED_CATEGORIES = [
  "sexual",
  "sexual/minors",
  "violence",
  "violence/graphic",
] as const;

function responseHeaders(request: Request) {
  const origin = request.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin)
      ? origin
      : "https://banfantujian.com",
    "Access-Control-Allow-Headers":
      "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "Vary": "Origin",
  };
}

function json(request: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders(request),
  });
}

function readDefaultKey(
  name: "SUPABASE_PUBLISHABLE_KEYS" | "SUPABASE_SECRET_KEYS",
) {
  try {
    const keys = JSON.parse(Deno.env.get(name) || "{}");
    return typeof keys.default === "string" ? keys.default : "";
  } catch {
    return "";
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: responseHeaders(request),
    });
  }
  if (request.method !== "POST") {
    return json(request, { code: "METHOD_NOT_ALLOWED" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const publishableKey = readDefaultKey("SUPABASE_PUBLISHABLE_KEYS") ||
    Deno.env.get("SUPABASE_ANON_KEY") || "";
  const secretKey = readDefaultKey("SUPABASE_SECRET_KEYS") ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const openaiKey = Deno.env.get("OPENAI_API_KEY") || "";
  if (!supabaseUrl || !publishableKey || !secretKey || !openaiKey) {
    return json(request, { code: "MODERATION_NOT_CONFIGURED" }, 503);
  }

  const authorization = request.headers.get("authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  if (!token) return json(request, { code: "AUTH_REQUIRED" }, 401);

  const userClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser(
    token,
  );
  if (authError || !authData.user) {
    return json(request, { code: "INVALID_SESSION" }, 401);
  }

  const payload = await request.json().catch(() => ({}));
  const reviewId = typeof payload.reviewId === "string" ? payload.reviewId : "";
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(reviewId)
  ) {
    return json(request, { code: "INVALID_REVIEW_ID" }, 400);
  }

  const admin = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: review, error: reviewError } = await admin
    .from("reviews")
    .select(
      "id,user_id,body,moderation_status,review_photos(storage_path,sort_order)",
    )
    .eq("id", reviewId)
    .maybeSingle();
  if (reviewError) return json(request, { code: "REVIEW_LOOKUP_FAILED" }, 500);
  if (!review) return json(request, { code: "REVIEW_NOT_FOUND" }, 404);
  if (review.user_id !== authData.user.id) {
    return json(request, { code: "FORBIDDEN" }, 403);
  }
  if (review.moderation_status !== "pending") {
    return json(request, { status: review.moderation_status });
  }

  const photos = Array.isArray(review.review_photos)
    ? review.review_photos
      .filter((photo) => typeof photo.storage_path === "string")
      .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0))
      .slice(0, 6)
    : [];
  if (!photos.length) return json(request, { code: "PHOTO_REQUIRED" }, 409);

  const storagePaths = photos.map((photo) => photo.storage_path);
  const { data: signedPhotos, error: signError } = await admin.storage
    .from(REVIEW_PHOTO_BUCKET)
    .createSignedUrls(storagePaths, 300);
  if (signError || !signedPhotos?.length) {
    return json(request, { code: "PHOTO_SIGNING_FAILED" }, 500);
  }

  const input: Array<Record<string, unknown>> = [{
    type: "text",
    text: String(review.body || ""),
  }];
  signedPhotos.forEach((photo) => {
    if (photo.signedUrl) {
      input.push({ type: "image_url", image_url: { url: photo.signedUrl } });
    }
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  let moderationResponse: Response;
  try {
    moderationResponse = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: "omni-moderation-latest", input }),
      signal: controller.signal,
    });
  } catch {
    clearTimeout(timeout);
    return json(request, { code: "MODERATION_UNAVAILABLE" }, 503);
  }
  clearTimeout(timeout);
  if (!moderationResponse.ok) {
    return json(request, { code: "MODERATION_UNAVAILABLE" }, 503);
  }

  const moderation = await moderationResponse.json().catch(() => ({}));
  const categories = moderation?.results?.[0]?.categories || {};
  const rejected = BLOCKED_CATEGORIES.some((category) =>
    categories[category] === true
  );

  if (rejected) {
    const { error: deleteError } = await admin.from("reviews").delete().eq(
      "id",
      reviewId,
    );
    if (deleteError) {
      return json(request, { code: "REJECTED_REVIEW_CLEANUP_FAILED" }, 500);
    }
    await admin.storage.from(REVIEW_PHOTO_BUCKET).remove(storagePaths);
    return json(request, { status: "rejected", reason: "sexual_or_violence" });
  }

  const { error: publishError } = await admin
    .from("reviews")
    .update({ moderation_status: "published" })
    .eq("id", reviewId)
    .eq("moderation_status", "pending");
  if (publishError) {
    return json(request, { code: "REVIEW_PUBLISH_FAILED" }, 500);
  }
  return json(request, { status: "published" });
});
