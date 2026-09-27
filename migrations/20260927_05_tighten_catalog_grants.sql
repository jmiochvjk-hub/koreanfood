-- Defense in depth after the catalog foundation is live.
-- RLS already blocks unauthorized writes; these grants also remove unused
-- table-level privileges from browser roles.

begin;

revoke all on public.app_admins from anon, authenticated;
revoke all on public.brands, public.categories, public.catalog_items,
  public.item_barcodes, public.places, public.item_locations,
  public.reviews, public.review_photos, public.favorites,
  public.missing_item_requests
from anon, authenticated;

grant select on public.brands, public.categories, public.catalog_items,
  public.item_barcodes, public.places, public.item_locations,
  public.reviews, public.review_photos
to anon, authenticated;

grant select on public.app_admins to authenticated;

grant insert, update, delete on public.brands, public.categories,
  public.catalog_items, public.item_barcodes, public.item_locations
to authenticated;

grant insert, update, delete on public.places, public.reviews,
  public.review_photos, public.favorites, public.missing_item_requests
to authenticated;

grant select on public.favorites, public.missing_item_requests
to authenticated;

revoke all on public.catalog_item_cards from anon, authenticated;
grant select on public.catalog_item_cards to anon, authenticated;

commit;
