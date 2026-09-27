#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT = path.resolve(import.meta.dirname, "../..");
const CACHE_DIR = path.join(ROOT, ".catalog-cache");
const RAW_FILE = path.join(CACHE_DIR, "musinsa-fashion-3000.raw.json");
const DONE_FILE = path.join(CACHE_DIR, "musinsa-fashion-3000.imported.ndjson");
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

function categorySlug(value) {
  const name = text(value).toLowerCase();
  if (/슈즈|스니커|운동화|로퍼|부츠|샌들|슬리퍼|구두|shoe|sneaker|loafer|boots?/.test(name)) return "shoes";
  if (/가방|백팩|숄더백|크로스백|토트백|파우치|bag|backpack|pouch/.test(name)) return "bags";
  if (/모자|캡|비니|벨트|지갑|양말|안경|선글라스|목걸이|반지|귀걸이|액세서리|cap|beanie|belt|wallet|socks|glasses/.test(name)) return "accessories";
  if (/티셔츠|셔츠|니트|가디건|팬츠|데님|슬랙스|스웨트|후드|맨투맨|t-?shirt|shirt|knit|pants|denim|sweat|hood/.test(name)) return "basics";
  return "streetwear";
}

function mapRow(row) {
  const sourceKey = text(row.source_key);
  const regularPrice = int(row.regular_price_krw);
  return {
    channel: "fashion",
    source: "musinsa",
    source_key: sourceKey,
    name_ko: text(row.name_ko).slice(0, 200),
    name_zh: "",
    brand_slug: text(row.brand_slug).slice(0, 100),
    brand_name_zh: text(row.brand_name_en) || text(row.brand_name_ko),
    brand_name_ko: text(row.brand_name_ko),
    brand_name_en: text(row.brand_name_en),
    brand_url: `https://www.musinsa.com/brand/${encodeURIComponent(text(row.brand_slug))}`,
    category_slug: categorySlug(row.name_ko),
    hero_image_url: text(row.hero_image_url),
    price_krw: int(row.price_krw) || regularPrice || null,
    active: true,
    attributes: {
      currency: "KRW",
      source_url: text(row.source_url),
      source_list: "popular_brands",
      source_rank: Math.max(1, int(row.source_rank)),
      source_brand_rank: Math.max(1, int(row.source_rank)),
      regular_price_krw: regularPrice || null,
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
    throw new Error(`Expected 3000 Fashion rows, received ${rows?.length || 0}`);
  }
  if (new Set(rows.map((row) => text(row.source_key))).size !== 3000) throw new Error("Fashion source keys are missing or duplicated");
  if (new Set(rows.map((row) => text(row.brand_slug))).size !== 100) throw new Error("Expected products from exactly 100 brands");
  return rows.map(mapRow);
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
  console.log(`Fashion: ${done.size} complete, ${pending.length} pending.`);
  for (let start = 0; start < pending.length; start += BATCH_SIZE) {
    const batch = pending.slice(start, start + BATCH_SIZE);
    const imported = await postBatch(settings, batch);
    await fs.appendFile(DONE_FILE, `${imported.map((row) => JSON.stringify(row)).join("\n")}\n`);
    console.log(`Fashion: ${Math.min(done.size + start + batch.length, rows.length)} / ${rows.length}`);
    await sleep(250);
  }
  console.log("Fashion import complete.");
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
