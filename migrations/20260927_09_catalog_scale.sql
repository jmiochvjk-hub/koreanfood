-- Catalog scale-up for thousands of imported products.
-- Keeps the public view compact, sortable, and searchable without downloading
-- the whole catalog into every browser.

begin;

create index if not exists catalog_items_active_channel_updated_idx
  on public.catalog_items (channel, updated_at desc)
  where active;

create index if not exists catalog_items_search_idx
  on public.catalog_items using gin (
    to_tsvector(
      'simple',
      coalesce(name_zh, '') || ' ' || coalesce(name_ko, '') || ' ' || coalesce(name_en, '')
    )
  )
  where active;

create or replace view public.catalog_item_cards
with (security_invoker = true)
as
select
  i.id,
  i.channel,
  i.item_type,
  i.name_zh,
  i.name_ko,
  i.name_en,
  i.hero_image_url,
  i.price_krw,
  i.attributes,
  b.name_zh as brand_name_zh,
  b.name_ko as brand_name_ko,
  c.name_zh as category_name_zh,
  coalesce(round(avg(r.rating)::numeric, 2), 0) as rating_average,
  count(r.id)::integer as review_count,
  case
    when coalesce(i.attributes->>'source_rank', '') ~ '^[0-9]+$'
      then (i.attributes->>'source_rank')::integer
    else 2147483647
  end as source_rank,
  case
    when coalesce(i.attributes->>'source_review_count', '') ~ '^[0-9]+$'
      then (i.attributes->>'source_review_count')::integer
    else 0
  end as source_review_count,
  case
    when coalesce(i.attributes->>'source_rating', '') ~ '^[0-9]+([.][0-9]+)?$'
      then (i.attributes->>'source_rating')::numeric
    else 0
  end as source_rating
from public.catalog_items i
left join public.brands b on b.id = i.brand_id
left join public.categories c on c.id = i.category_id
left join public.reviews r
  on r.item_id = i.id and r.moderation_status = 'published'
where i.active
group by i.id, b.name_zh, b.name_ko, c.name_zh;

revoke all on public.catalog_item_cards from anon, authenticated;
grant select on public.catalog_item_cards to anon, authenticated;

create or replace function public.search_catalog_items(
  search_term text,
  result_limit integer default 60,
  result_offset integer default 0
)
returns setof public.catalog_item_cards
language sql
stable
security invoker
set search_path = public
as $$
  select card.*
  from public.catalog_item_cards card
  where char_length(btrim(coalesce(search_term, ''))) >= 1
    and concat_ws(
      ' ',
      card.name_zh,
      card.name_ko,
      card.name_en,
      card.brand_name_zh,
      card.brand_name_ko,
      card.category_name_zh
    ) ilike '%' || replace(replace(replace(btrim(search_term), E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%' escape E'\\'
  order by
    card.review_count desc,
    card.source_review_count desc,
    card.source_rank asc,
    card.rating_average desc,
    card.name_zh asc
  limit least(greatest(coalesce(result_limit, 60), 1), 120)
  offset greatest(coalesce(result_offset, 0), 0);
$$;

revoke all on function public.search_catalog_items(text, integer, integer) from public;
grant execute on function public.search_catalog_items(text, integer, integer)
to anon, authenticated;

comment on function public.search_catalog_items(text, integer, integer) is
  'Server-side Chinese/Korean/English catalog search, popularity ordered and capped at 120 rows per request.';

create or replace function public.admin_import_catalog_items(payload jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  imported_count integer := 0;
begin
  if jsonb_typeof(payload) <> 'array' or jsonb_array_length(payload) < 1 or jsonb_array_length(payload) > 100 then
    raise exception 'payload must contain 1 to 100 catalog rows';
  end if;

  insert into public.brands (slug, name_zh, name_ko, name_en, website_url, country_code, active)
  select distinct
    btrim(row.brand_slug),
    btrim(coalesce(row.brand_name_zh, '')),
    btrim(coalesce(row.brand_name_ko, '')),
    btrim(coalesce(row.brand_name_en, '')),
    btrim(coalesce(row.brand_url, '')),
    'KR',
    true
  from jsonb_to_recordset(payload) as row(
    brand_slug text,
    brand_name_zh text,
    brand_name_ko text,
    brand_name_en text,
    brand_url text
  )
  where btrim(coalesce(row.brand_slug, '')) <> ''
  on conflict (slug) do update set
    name_zh = case when excluded.name_zh <> '' then excluded.name_zh else public.brands.name_zh end,
    name_ko = case when excluded.name_ko <> '' then excluded.name_ko else public.brands.name_ko end,
    name_en = case when excluded.name_en <> '' then excluded.name_en else public.brands.name_en end,
    website_url = case when excluded.website_url <> '' then excluded.website_url else public.brands.website_url end,
    active = true;

  insert into public.catalog_items (
    channel,
    brand_id,
    category_id,
    item_type,
    name_zh,
    name_ko,
    name_en,
    description_zh,
    hero_image_url,
    price_krw,
    source,
    source_key,
    attributes,
    active
  )
  select
    row.channel,
    brand.id,
    category.id,
    'product',
    btrim(row.name_zh),
    btrim(row.name_ko),
    btrim(coalesce(row.name_en, '')),
    btrim(coalesce(row.description_zh, '')),
    btrim(coalesce(row.hero_image_url, '')),
    case when row.price_krw >= 0 then row.price_krw else null end,
    row.source,
    btrim(row.source_key),
    coalesce(row.attributes, '{}'::jsonb),
    coalesce(row.active, true)
  from jsonb_to_recordset(payload) as row(
    channel text,
    brand_slug text,
    category_slug text,
    name_zh text,
    name_ko text,
    name_en text,
    description_zh text,
    hero_image_url text,
    price_krw integer,
    source text,
    source_key text,
    attributes jsonb,
    active boolean
  )
  left join public.brands brand on brand.slug = btrim(row.brand_slug)
  left join public.categories category
    on category.channel = row.channel and category.slug = btrim(row.category_slug)
  where row.channel in ('food', 'beauty', 'life', 'fashion')
    and row.source in ('daisomall', 'oliveyoung', 'musinsa', 'brand_official')
    and char_length(btrim(coalesce(row.source_key, ''))) between 1 and 200
    and char_length(btrim(coalesce(row.name_ko, ''))) between 1 and 200
    and char_length(btrim(coalesce(row.name_zh, ''))) between 1 and 200
  on conflict (source, source_key)
    where source_key is not null and source_key <> ''
  do update set
    channel = excluded.channel,
    brand_id = excluded.brand_id,
    category_id = excluded.category_id,
    name_zh = excluded.name_zh,
    name_ko = excluded.name_ko,
    name_en = excluded.name_en,
    description_zh = excluded.description_zh,
    hero_image_url = excluded.hero_image_url,
    price_krw = excluded.price_krw,
    attributes = excluded.attributes,
    active = excluded.active;

  get diagnostics imported_count = row_count;
  return imported_count;
end;
$$;

revoke all on function public.admin_import_catalog_items(jsonb) from public, anon, authenticated;
grant execute on function public.admin_import_catalog_items(jsonb) to service_role;

comment on function public.admin_import_catalog_items(jsonb) is
  'Service-role-only validated batch upsert used by the catalog import worker.';

commit;
