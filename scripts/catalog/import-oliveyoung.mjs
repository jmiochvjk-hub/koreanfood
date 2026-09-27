#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT = path.resolve(import.meta.dirname, "../..");
const CACHE_DIR = path.join(ROOT, ".catalog-cache");
const RAW_FILE = path.join(CACHE_DIR, "oliveyoung-3000.raw.json");
const DONE_FILE = path.join(CACHE_DIR, "oliveyoung-3000.imported.ndjson");
const BATCH_SIZE = 40;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function text(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function int(value) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function brandSlug(value) {
  const digest = crypto.createHash("sha256").update(text(value) || "oliveyoung").digest("hex").slice(0, 16);
  return `oy-${digest}`;
}

function categorySlug(value) {
  const label = text(value).toLowerCase();
  if (/선케어|선크림|자외선|썬케어|suncare/.test(label)) return "suncare";
  if (/스킨케어|크림|스킨|토너|에센스|세럼|앰플|마스크팩|클렌징/.test(label)) return "skincare";
  if (/메이크업|립|아이|네일|블러셔|파운데이션|쿠션|베이스|컨실러/.test(label)) return "makeup";
  if (/헤어|샴푸|트리트먼트|두피/.test(label)) return "haircare";
  if (/바디|핸드|풋|데오드란트/.test(label)) return "bodycare";
  if (/향수|디퓨저|프래그런스/.test(label)) return "fragrance";
  return "olive-young";
}

function mapRow(row) {
  const sourceKey = text(row.source_key);
  const regularPrice = int(row.regular_price_krw);
  const salePrice = int(row.sale_price_krw);
  const categoryKo = text(row.source_category_ko);
  const brandKo = text(row.brand_name_ko);
  return {
    channel: "beauty",
    source: "oliveyoung",
    source_key: sourceKey,
    name_ko: text(row.name_ko).slice(0, 200),
    name_zh: "",
    brand_slug: brandSlug(brandKo),
    brand_name_zh: "",
    brand_name_ko: brandKo,
    brand_name_en: "",
    brand_url: "https://www.oliveyoung.co.kr/",
    category_slug: categorySlug(categoryKo),
    hero_image_url: text(row.hero_image_url),
    price_krw: salePrice || regularPrice || null,
    active: true,
    attributes: {
      currency: "KRW",
      source_url: text(row.source_url),
      source_list: text(row.source_list) || "category",
      source_rank: Math.max(1, int(row.source_rank)),
      source_category_ko: categoryKo,
      source_category_id: text(row.source_category_id),
      regular_price_krw: regularPrice || null,
      sale_price_krw: salePrice || null,
      name_zh_status: "machine_draft",
      fetched_at: new Date().toISOString(),
    },
  };
}

async function config() {
  const source = await fs.readFile(path.join(ROOT, "config.js"), "utf8");
  const url = source.match(/url:\s*["']([^"']+)/)?.[1] || "";
  const anonKey = source.match(/anonKey:\s*["']([^"']+)/)?.[1] || "";
  const importToken = process.env.CATALOG_IMPORT_TOKEN || "";
  if (!url || !anonKey || !importToken) throw new Error("Missing Supabase config or CATALOG_IMPORT_TOKEN");
  return { url: url.replace(/\/$/, ""), anonKey, importToken };
}

async function sourceRows() {
  const rows = JSON.parse(await fs.readFile(RAW_FILE, "utf8"));
  if (!Array.isArray(rows) || rows.length !== 3000) {
    throw new Error(`Expected 3000 Olive Young rows, received ${rows?.length || 0}`);
  }
  const unique = new Map(rows.map((row) => [text(row.source_key), row]));
  if (unique.size !== 3000 || unique.has("")) throw new Error("Olive Young source keys are missing or duplicated");
  return [...unique.values()].map(mapRow);
}

async function completedKeys() {
  try {
    const lines = (await fs.readFile(DONE_FILE, "utf8")).split("\n").filter(Boolean);
    return new Set(lines.map((line) => JSON.parse(line).source_key));
  } catch {
    return new Set();
  }
}

async function postBatch(settings, rows, attempt = 1) {
  try {
    const response = await fetch(`${settings.url}/functions/v1/catalog-import`, {
      method: "POST",
      headers: {
        apikey: settings.anonKey,
        Authorization: `Bearer ${settings.anonKey}`,
        "Content-Type": "application/json",
        "x-catalog-import-token": settings.importToken,
      },
      body: JSON.stringify({ rows }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`${payload.code || `HTTP_${response.status}`}${payload.message ? `: ${payload.message}` : ""}`);
    if (!Array.isArray(payload.rows) || payload.rows.length !== rows.length) throw new Error("Import worker returned an incomplete batch");
    return payload.rows;
  } catch (error) {
    if (attempt >= 4) throw error;
    await sleep(800 * 2 ** (attempt - 1));
    return postBatch(settings, rows, attempt + 1);
  }
}

async function main() {
  const settings = await config();
  const rows = await sourceRows();
  const done = await completedKeys();
  const pending = rows.filter((row) => !done.has(row.source_key));
  console.log(`Olive Young: ${done.size} complete, ${pending.length} pending.`);
  for (let start = 0; start < pending.length; start += BATCH_SIZE) {
    const batch = pending.slice(start, start + BATCH_SIZE);
    const imported = await postBatch(settings, batch);
    await fs.appendFile(DONE_FILE, `${imported.map((row) => JSON.stringify(row)).join("\n")}\n`);
    console.log(`Olive Young: ${Math.min(done.size + start + batch.length, rows.length)} / ${rows.length}`);
    await sleep(250);
  }
  console.log("Olive Young import complete.");
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
