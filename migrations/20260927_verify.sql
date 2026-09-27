-- Read-only verification. Run after phase 1 and phase 2.

select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'food_places',
    'app_admins',
    'brands',
    'categories',
    'catalog_items',
    'item_barcodes',
    'places',
    'item_locations',
    'reviews',
    'review_photos',
    'favorites',
    'missing_item_requests'
  )
order by c.relname;

select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd
from pg_policies
where schemaname in ('public', 'storage')
  and (
    tablename in (
      'food_places',
      'app_admins',
      'brands',
      'categories',
      'catalog_items',
      'item_barcodes',
      'places',
      'item_locations',
      'reviews',
      'review_photos',
      'favorites',
      'missing_item_requests'
    )
    or (schemaname = 'storage' and tablename = 'objects')
  )
order by schemaname, tablename, policyname;

select
  (select count(*) from public.food_places) as legacy_food_places,
  (
    select count(*)
    from public.places
    where source = 'legacy_food_places'
  ) as migrated_places;

select
  table_name,
  privilege_type,
  grantee
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated')
  and table_name in (
    'food_places',
    'brands',
    'categories',
    'catalog_items',
    'item_barcodes',
    'places',
    'item_locations',
    'reviews',
    'review_photos',
    'favorites',
    'missing_item_requests'
  )
order by table_name, grantee, privilege_type;
