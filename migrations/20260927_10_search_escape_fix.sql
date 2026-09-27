-- Fix the literal ESCAPE character used by the catalog search RPC.

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
