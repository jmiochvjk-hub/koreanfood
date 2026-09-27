#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT = path.resolve(import.meta.dirname, "../..");
const CACHE_DIR = path.join(ROOT, ".catalog-cache");
const RAW_FILE = path.join(CACHE_DIR, "daiso-3000.raw.json");
const DONE_FILE = path.join(CACHE_DIR, "daiso-3000.imported.ndjson");
const SOURCE_URL = "https://www.daisomall.co.kr/ssn/search/GoodsBestSale?period=R&pageNum=1&cntPerPage=3000&largeExhCtgrNo=&isCategory=0&soldOutYn=N";
const PRODUCT_URL = "https://www.daisomall.co.kr/pd/pdr/SCR_PDR_0001?pdNo=";
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

function categoryZh(row) {
  return [row.exhLargeCtgrNm, row.exhMiddleCtgrNm, row.exhSmallCtgrNm].filter(Boolean).join(" · ");
}

function imageUrl(value) {
  const raw = text(value);
  if (!raw) return "";
  if (/^https:\/\//i.test(raw)) return raw;
  return `https://cdn.daisomall.co.kr${raw.startsWith("/") ? "" : "/"}${raw}`;
}

function mapRow(row, index) {
  const sourceKey = text(row.pdNo);
  return {
    channel: "life",
    source: "daisomall",
    source_key: sourceKey,
    name_ko: text(row.exhPdNm || row.pdNm).slice(0, 200),
    name_zh: "",
    brand_slug: "daiso",
    brand_name_zh: "Daiso",
    brand_name_ko: "다이소",
    brand_name_en: "Daiso",
    brand_url: "https://www.daisomall.co.kr/",
    category_slug: "daiso",
    hero_image_url: imageUrl(row.pdImgUrl),
    price_krw: int(row.pdPrc),
    active: text(row.sleStsCd) !== "04",
    attributes: {
      currency: "KRW",
      source_url: `${PRODUCT_URL}${encodeURIComponent(sourceKey)}`,
      source_list: "sales_ranking",
      source_rank: index + 1,
      source_rating: Number(row.avgStscVal || 0),
      source_review_count: int(row.revwCnt),
      source_category_ko: categoryZh(row),
      source_category_zh: categoryZh(row),
      source_category_codes: [row.exhLargeCtgrNo, row.exhMiddleCtgrNo, row.exhSmallCtgrNo].filter(Boolean),
      availability: text(row.soldOutYn) === "Y" ? "out_of_stock" : "in_stock",
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

async function fetchRawRows() {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  try {
    const cached = JSON.parse(await fs.readFile(RAW_FILE, "utf8"));
    if (Array.isArray(cached) && cached.length === 3000) return cached;
  } catch {
    // Fetch a fresh public ranking snapshot below.
  }
  const response = await fetch(SOURCE_URL, {
    headers: { "User-Agent": "BanfanCatalogResearch/1.0 (+https://banfantujian.com)" },
  });
  if (!response.ok) throw new Error(`Daiso source returned HTTP ${response.status}`);
  const payload = await response.json();
  const rows = payload?.resultSet?.result?.[0]?.resultDocuments;
  if (!Array.isArray(rows) || rows.length !== 3000) throw new Error(`Expected 3000 Daiso rows, received ${rows?.length || 0}`);
  await fs.writeFile(RAW_FILE, JSON.stringify(rows));
  return rows;
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
  const rawRows = await fetchRawRows();
  const rows = rawRows.map(mapRow);
  const done = await completedKeys();
  const pending = rows.filter((row) => !done.has(row.source_key));
  console.log(`Daiso: ${done.size} complete, ${pending.length} pending.`);
  for (let start = 0; start < pending.length; start += BATCH_SIZE) {
    const batch = pending.slice(start, start + BATCH_SIZE);
    const imported = await postBatch(settings, batch);
    await fs.appendFile(DONE_FILE, `${imported.map((row) => JSON.stringify(row)).join("\n")}\n`);
    console.log(`Daiso: ${Math.min(done.size + start + batch.length, rows.length)} / ${rows.length}`);
    await sleep(250);
  }
  console.log("Daiso import complete.");
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
