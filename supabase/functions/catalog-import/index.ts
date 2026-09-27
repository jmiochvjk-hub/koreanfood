import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_SOURCES = new Set(["daisomall", "oliveyoung", "musinsa", "brand_official"]);
const ALLOWED_CHANNELS = new Set(["food", "beauty", "life", "fashion"]);

function readDefaultKey(name: "SUPABASE_SECRET_KEYS") {
  try {
    const keys = JSON.parse(Deno.env.get(name) || "{}");
    return typeof keys.default === "string" ? keys.default : "";
  } catch {
    return "";
  }
}

function response(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

type ImportRow = {
  channel: string;
  source: string;
  source_key: string;
  name_ko: string;
  name_zh?: string;
  name_en?: string;
  description_zh?: string;
  brand_slug?: string;
  brand_name_zh?: string;
  brand_name_ko?: string;
  brand_name_en?: string;
  brand_url?: string;
  category_slug?: string;
  hero_image_url?: string;
  price_krw?: number | null;
  attributes?: Record<string, unknown>;
  active?: boolean;
};

function cleanText(value: unknown, max = 200) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function normalizeRow(value: unknown): ImportRow | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const channel = cleanText(row.channel, 20);
  const source = cleanText(row.source, 40);
  const sourceKey = cleanText(row.source_key, 200);
  const nameKo = cleanText(row.name_ko, 200);
  if (!ALLOWED_CHANNELS.has(channel) || !ALLOWED_SOURCES.has(source) || !sourceKey || !nameKo) return null;
  const price = row.price_krw === null || row.price_krw === undefined ? null : Number(row.price_krw);
  return {
    channel,
    source,
    source_key: sourceKey,
    name_ko: nameKo,
    name_zh: cleanText(row.name_zh, 200),
    name_en: cleanText(row.name_en, 200),
    description_zh: cleanText(row.description_zh, 1000),
    brand_slug: cleanText(row.brand_slug, 100),
    brand_name_zh: cleanText(row.brand_name_zh, 200),
    brand_name_ko: cleanText(row.brand_name_ko, 200),
    brand_name_en: cleanText(row.brand_name_en, 200),
    brand_url: cleanText(row.brand_url, 500),
    category_slug: cleanText(row.category_slug, 100),
    hero_image_url: cleanText(row.hero_image_url, 1000),
    price_krw: Number.isFinite(price) && Number(price) >= 0 ? Math.round(Number(price)) : null,
    attributes: row.attributes && typeof row.attributes === "object" ? row.attributes as Record<string, unknown> : {},
    active: row.active !== false,
  };
}

async function translateRows(rows: ImportRow[], deepseekKey: string) {
  const pending = rows.filter((row) => !row.name_zh || (row.brand_name_ko && !row.brand_name_zh));
  if (!pending.length) return rows;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 50_000);
  try {
    const result = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${deepseekKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "deepseek-chat",
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 6000,
        messages: [
          {
            role: "system",
            content: "你是韩国商品资料库的中文编辑。把韩文商品名和韩文品牌名翻译成自然、简洁、准确的简体中文。保留品牌、型号、尺寸、容量、数量、色号和英文专名；删除不影响识别的促销口号，但不要删掉套装/赠品/规格信息。品牌已有通行英文或中文名时使用通行译名，不确定时保留原文。不得增加功效或安全承诺。只返回严格 JSON：{\"translations\":[{\"source_key\":\"...\",\"name_zh\":\"...\",\"brand_name_zh\":\"...\"}]}，每个输入必须恰好一条。没有品牌时 brand_name_zh 返回空字符串。",
          },
          {
            role: "user",
            content: JSON.stringify(pending.map((row) => ({
              source_key: row.source_key,
              name_ko: row.name_ko,
              brand: row.brand_name_ko || row.brand_name_en || row.brand_name_zh || "",
              category: row.attributes?.source_category_zh || row.category_slug || "",
            }))),
          },
        ],
      }),
      signal: controller.signal,
    });
    if (!result.ok) throw new Error(`DEEPSEEK_${result.status}`);
    const payload = await result.json();
    const content = String(payload?.choices?.[0]?.message?.content || "").trim();
    const parsed = JSON.parse(content);
    const translations = new Map<string, { nameZh: string; brandNameZh: string }>();
    for (const item of Array.isArray(parsed.translations) ? parsed.translations : []) {
      const sourceKey = cleanText(item?.source_key, 200);
      const nameZh = cleanText(item?.name_zh, 200);
      const brandNameZh = cleanText(item?.brand_name_zh, 200);
      if (sourceKey && nameZh) translations.set(sourceKey, { nameZh, brandNameZh });
    }
    if (pending.some((row) => !translations.has(row.source_key))) throw new Error("TRANSLATION_INCOMPLETE");
    return rows.map((row) => {
      const translated = translations.get(row.source_key);
      return {
        ...row,
        name_zh: row.name_zh || translated?.nameZh || "",
        brand_name_zh: row.brand_name_zh || translated?.brandNameZh || row.brand_name_ko || "",
      };
    });
  } finally {
    clearTimeout(timeout);
  }
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return response({ code: "METHOD_NOT_ALLOWED" }, 405);
  const expectedToken = Deno.env.get("CATALOG_IMPORT_TOKEN") || "";
  const providedToken = request.headers.get("x-catalog-import-token") || "";
  if (!expectedToken || providedToken !== expectedToken) return response({ code: "NOT_AUTHORIZED" }, 401);

  const payload = await request.json().catch(() => ({}));
  const rawRows = Array.isArray(payload.rows) ? payload.rows : [];
  if (rawRows.length < 1 || rawRows.length > 50) return response({ code: "INVALID_BATCH_SIZE" }, 400);
  const rows = rawRows.map(normalizeRow);
  if (rows.some((row) => !row)) return response({ code: "INVALID_ROW" }, 400);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const secretKey = readDefaultKey("SUPABASE_SECRET_KEYS") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const deepseekKey = Deno.env.get("DEEPSEEK_API_KEY") || "";
  if (!supabaseUrl || !secretKey || !deepseekKey) return response({ code: "IMPORT_NOT_CONFIGURED" }, 503);

  let translated: ImportRow[];
  try {
    translated = await translateRows(rows as ImportRow[], deepseekKey);
  } catch (error) {
    console.error("[catalog-import] translation failed", error);
    return response({ code: "TRANSLATION_FAILED" }, 502);
  }

  const admin = createClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await admin.rpc("admin_import_catalog_items", { payload: translated });
  if (error) {
    console.error("[catalog-import] database upsert failed", error);
    return response({ code: "IMPORT_FAILED", message: error.message }, 500);
  }
  return response({ imported: Number(data || 0), rows: translated });
});
