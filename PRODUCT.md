# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- Primary: Chinese-speaking travelers planning or taking a trip to Korea who need trustworthy, usable recommendations while deciding what to eat, buy, and visit.
- Secondary: Chinese-speaking students and long-term residents in Korea who need repeat-use discovery, saving, comparison, and review tools.
- Long-term: travelers and residents discovering local food and consumer goods in additional countries and languages.

## Product Purpose

BanFan helps Chinese-speaking users discover Korean food, beauty, lifestyle, and fashion through a structured catalogue of products and places, curated lists, saves, maps, photo-based reviews, community posts, and grounded site search. Early value must exist before a large community forms: imported catalogues, useful details, lists, the food map, and grounded answers should work on their own.

## Positioning

BanFan is not a purchasing or daigou platform and not a generic social feed. It is a Chinese-language Korea consumption guide whose structured product and place records remain primary. A free-form photo community captures discoveries that do not yet fit the catalogue, while grounded Q&A turns the catalogue, map, reviews, and posts into direct answers without inventing recommendations.

## Operating Context

- Users browse before travel, while shopping in Korea, and when deciding where to eat.
- Food depends on place and route context, so restaurants can be discovered and added through a map.
- Beauty, lifestyle, and fashion depend on stable catalogue records imported by the platform; users review existing items instead of freely creating duplicates.
- Xiaohongshu content is an acquisition channel: focused comparisons and lists should lead to a useful BanFan item, place, or collection page.

## Capabilities and Constraints

- Four open channels: FOOD 美食, BEAUTY 美妆, LIFE 生活, FASHION 潮流.
- Food supports both a list and a map, including adding a new place.
- Non-food items以平台导入的结构化商品库为主；用户找不到商品时可提供品牌、完整名称和公开商品链接申请新增，DeepSeek 自动审核、规范中文名并排重后才入库。
- Reviews require at least one real photo; user photos belong in reviews rather than replacing the official catalogue image.
- Community posts require at least one real photo but do not require an existing product or place; linking a post back to a durable record is encouraged when possible.
- “问一问” answers questions only from existing site evidence and shows the underlying products, places, reviews, or posts as clickable sources.
- Users can search, filter, save, open details, publish community posts, ask grounded questions, and submit reviews.
- Global search crosses all four channels, and discovery lists default to popularity measured by review count.
- Barcode scanning is intentionally out of scope for the current product.
- The current implementation is a static HTML/CSS/JavaScript web app backed by Supabase and deployed with GitHub Pages.
- China-accessible mapping and Mini Program support remain open technical decisions; the current Korean web map may not work reliably in mainland China.
- 邮箱验证码登录已开放；微信登录仍取决于微信开放平台资质。

## Brand Commitments

- Name: 伴饭 / BANFAN.
- Primary language: simplified Chinese, with Korean or English retained when it helps identify a product or place.
- The product should feel like a high-quality Korean retail and culture publication, with the craft level of 29CM or MUSINSA as a benchmark, without copying either brand.
- Avoid the term “在韩华人”.
- The interface must not read as generic AI-generated or template-driven.

## Evidence on Hand

- Existing Supabase data includes food places and an Olive Young product seed catalogue.
- Existing working flows include four-channel browsing, catalogue search and filters, favorites, item details, mandatory-photo reviews, and the food map.
- No verified testimonials, usage metrics, or brand-partnership claims are available; future surfaces must not invent them.

## Product Principles

1. Useful before community: catalogue, map, and lists must stand on their own during cold start.
2. Structure before feed: recommendations should resolve to durable product, place, review, or post evidence; free-form posts may later be linked to catalogue records.
3. Trust through proof: reviews require real photos and specific lived experience.
4. Travel-ready clarity: a visitor should quickly understand what to choose, where to find it, and why it is worth considering.
5. Korea first, globally extensible: data and interaction patterns should expand to other countries without erasing local context.

## Accessibility & Inclusion

The responsive web experience must remain usable with keyboard navigation, visible focus, adequate contrast, reduced motion, and common mobile widths. Chinese copy is primary and should not be displaced by decorative English labels.
