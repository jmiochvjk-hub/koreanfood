import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = new Set([
  "https://banfantujian.com",
  "https://www.banfantujian.com",
  "http://127.0.0.1:4173",
  "http://localhost:4173",
]);

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

  const payload = await request.json().catch(() => ({}));
  if (payload.confirmation !== "DELETE_MY_ACCOUNT") {
    return json(request, { code: "CONFIRMATION_REQUIRED" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const publishableKey = readDefaultKey("SUPABASE_PUBLISHABLE_KEYS") ||
    Deno.env.get("SUPABASE_ANON_KEY") || "";
  const secretKey = readDefaultKey("SUPABASE_SECRET_KEYS") ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !publishableKey || !secretKey) {
    return json(request, { code: "ACCOUNT_DELETION_NOT_CONFIGURED" }, 503);
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

  const admin = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const userId = authData.user.id;
  const [reviewsResult, postsResult] = await Promise.all([
    admin.from("reviews").select("review_photos(storage_path)").eq(
      "user_id",
      userId,
    ),
    admin.from("community_posts").select(
      "community_post_photos(storage_path)",
    ).eq("user_id", userId),
  ]);
  if (reviewsResult.error || postsResult.error) {
    return json(request, { code: "CONTENT_LOOKUP_FAILED" }, 500);
  }

  const reviewPaths = (reviewsResult.data || []).flatMap((review) =>
    Array.isArray(review.review_photos)
      ? review.review_photos.map((photo) => photo.storage_path).filter(Boolean)
      : []
  );
  const postPaths = (postsResult.data || []).flatMap((post) =>
    Array.isArray(post.community_post_photos)
      ? post.community_post_photos.map((photo) => photo.storage_path).filter(
        Boolean,
      )
      : []
  );

  const storageRemovals = await Promise.all([
    reviewPaths.length
      ? admin.storage.from("review-photos").remove(reviewPaths)
      : Promise.resolve({ error: null }),
    postPaths.length
      ? admin.storage.from("community-posts").remove(postPaths)
      : Promise.resolve({ error: null }),
  ]);
  if (storageRemovals.some((result) => result.error)) {
    return json(request, { code: "PHOTO_DELETION_FAILED" }, 500);
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) {
    return json(request, { code: "ACCOUNT_DELETION_FAILED" }, 500);
  }
  return json(request, { deleted: true });
});
