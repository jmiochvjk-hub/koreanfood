-- Phase 2: BanFan catalog foundation.
-- Safe to run before client auth is finished: new tables are public-read,
-- authenticated-write, and admin-maintained where appropriate.

begin;

create extension if not exists pgcrypto;

create table if not exists public.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.app_admins enable row level security;

drop policy if exists "admins_read_own_membership" on public.app_admins;
create policy "admins_read_own_membership"
on public.app_admins for select
to authenticated
using (user_id = auth.uid());

create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.app_admins
    where user_id = auth.uid()
  );
$$;

revoke all on function public.is_app_admin() from public;
grant execute on function public.is_app_admin() to anon, authenticated;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  name_zh text not null default '',
  name_ko text not null default '',
  name_en text not null default '',
  slug text not null unique,
  logo_url text not null default '',
  website_url text not null default '',
  country_code text not null default 'KR',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(slug) between 1 and 100)
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('food', 'beauty', 'life', 'fashion')),
  parent_id uuid references public.categories(id) on delete set null,
  slug text not null,
  name_zh text not null,
  name_ko text not null default '',
  name_en text not null default '',
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (channel, slug)
);

create table if not exists public.catalog_items (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('food', 'beauty', 'life', 'fashion')),
  brand_id uuid references public.brands(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  item_type text not null default 'product'
    check (item_type in ('product', 'menu_item')),
  name_zh text not null default '',
  name_ko text not null,
  name_en text not null default '',
  description_zh text not null default '',
  hero_image_url text not null default '',
  price_krw integer check (price_krw is null or price_krw >= 0),
  source text not null default 'manual',
  source_key text,
  attributes jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(btrim(name_ko)) between 1 and 200)
);

create unique index if not exists catalog_items_source_key_uidx
  on public.catalog_items (source, source_key)
  where source_key is not null and source_key <> '';

create index if not exists catalog_items_channel_category_idx
  on public.catalog_items (channel, category_id)
  where active;

create index if not exists catalog_items_brand_idx
  on public.catalog_items (brand_id)
  where active;

create or replace function public.normalize_gtin(scan_code text)
returns text
language sql
immutable
strict
set search_path = public
as $$
  select case
    when regexp_replace(scan_code, '[^0-9]', '', 'g') ~ '^[0-9]{8}$'
      then lpad(regexp_replace(scan_code, '[^0-9]', '', 'g'), 14, '0')
    when regexp_replace(scan_code, '[^0-9]', '', 'g') ~ '^[0-9]{12,14}$'
      then lpad(regexp_replace(scan_code, '[^0-9]', '', 'g'), 14, '0')
    else null
  end;
$$;

create table if not exists public.item_barcodes (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.catalog_items(id) on delete cascade,
  code text not null,
  gtin14 text generated always as (public.normalize_gtin(code)) stored,
  symbology text not null default 'unknown'
    check (symbology in ('ean_8', 'ean_13', 'upc_a', 'gtin_14', 'unknown')),
  is_primary boolean not null default false,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  check (public.normalize_gtin(code) is not null),
  unique (gtin14)
);

create unique index if not exists item_barcodes_one_primary_per_item_uidx
  on public.item_barcodes (item_id)
  where is_primary;

create index if not exists item_barcodes_item_idx
  on public.item_barcodes (item_id);

create table if not exists public.places (
  id uuid primary key default gen_random_uuid(),
  place_type text not null default 'restaurant'
    check (place_type in ('restaurant', 'cafe', 'bar', 'market', 'store', 'popup', 'other')),
  name_zh text not null default '',
  name_ko text not null,
  name_en text not null default '',
  address_ko text not null default '',
  address_zh text not null default '',
  city_code text not null default 'SEOUL',
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  phone text not null default '',
  website_url text not null default '',
  hero_image_url text not null default '',
  source text not null default 'community',
  source_key text,
  legacy_food_place_id text unique,
  created_by uuid references auth.users(id) on delete set null,
  moderation_status text not null default 'pending'
    check (moderation_status in ('pending', 'published', 'rejected', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(btrim(name_ko)) between 1 and 200)
);

create unique index if not exists places_source_key_uidx
  on public.places (source, source_key)
  where source_key is not null and source_key <> '';

create index if not exists places_geo_idx on public.places (lat, lng);
create index if not exists places_city_status_idx
  on public.places (city_code, moderation_status);
create index if not exists places_created_by_idx on public.places (created_by);

create table if not exists public.item_locations (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.catalog_items(id) on delete cascade,
  place_id uuid not null references public.places(id) on delete cascade,
  price_krw integer check (price_krw is null or price_krw >= 0),
  stock_status text not null default 'unknown'
    check (stock_status in ('unknown', 'in_stock', 'low_stock', 'out_of_stock')),
  purchase_url text not null default '',
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (item_id, place_id)
);

create index if not exists item_locations_place_idx
  on public.item_locations (place_id);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references public.catalog_items(id) on delete cascade,
  place_id uuid references public.places(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating numeric(2,1) not null check (rating between 1 and 5),
  body text not null,
  moderation_status text not null default 'pending'
    check (moderation_status in ('pending', 'published', 'rejected', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(item_id, place_id) = 1),
  check (char_length(btrim(body)) between 1 and 1000)
);

create unique index if not exists reviews_one_user_per_item_uidx
  on public.reviews (user_id, item_id)
  where item_id is not null;

create unique index if not exists reviews_one_user_per_place_uidx
  on public.reviews (user_id, place_id)
  where place_id is not null;

create index if not exists reviews_item_status_idx
  on public.reviews (item_id, moderation_status, created_at desc);

create index if not exists reviews_place_status_idx
  on public.reviews (place_id, moderation_status, created_at desc);

create table if not exists public.review_photos (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews(id) on delete cascade,
  storage_path text not null unique,
  sort_order smallint not null default 0 check (sort_order between 0 and 9),
  created_at timestamptz not null default now()
);

create index if not exists review_photos_review_idx
  on public.review_photos (review_id, sort_order);

create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid references public.catalog_items(id) on delete cascade,
  place_id uuid references public.places(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (num_nonnulls(item_id, place_id) = 1)
);

create unique index if not exists favorites_user_item_uidx
  on public.favorites (user_id, item_id)
  where item_id is not null;

create unique index if not exists favorites_user_place_uidx
  on public.favorites (user_id, place_id)
  where place_id is not null;

create table if not exists public.missing_item_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  channel text not null check (channel in ('food', 'beauty', 'life', 'fashion')),
  brand_text text not null default '',
  item_name text not null,
  barcode text not null default '',
  evidence_url text not null default '',
  note text not null default '',
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'merged')),
  resolved_item_id uuid references public.catalog_items(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(btrim(item_name)) between 1 and 200)
);

create index if not exists missing_item_requests_status_idx
  on public.missing_item_requests (status, created_at);

drop trigger if exists brands_set_updated_at on public.brands;
create trigger brands_set_updated_at
before update on public.brands
for each row execute function public.set_updated_at();

drop trigger if exists categories_set_updated_at on public.categories;
create trigger categories_set_updated_at
before update on public.categories
for each row execute function public.set_updated_at();

drop trigger if exists catalog_items_set_updated_at on public.catalog_items;
create trigger catalog_items_set_updated_at
before update on public.catalog_items
for each row execute function public.set_updated_at();

drop trigger if exists places_set_updated_at on public.places;
create trigger places_set_updated_at
before update on public.places
for each row execute function public.set_updated_at();

drop trigger if exists item_locations_set_updated_at on public.item_locations;
create trigger item_locations_set_updated_at
before update on public.item_locations
for each row execute function public.set_updated_at();

drop trigger if exists reviews_set_updated_at on public.reviews;
create trigger reviews_set_updated_at
before update on public.reviews
for each row execute function public.set_updated_at();

drop trigger if exists missing_item_requests_set_updated_at on public.missing_item_requests;
create trigger missing_item_requests_set_updated_at
before update on public.missing_item_requests
for each row execute function public.set_updated_at();

-- Preserve legacy map content without changing or deleting the original rows.
insert into public.places (
  place_type,
  name_zh,
  name_ko,
  address_ko,
  lat,
  lng,
  hero_image_url,
  source,
  legacy_food_place_id,
  moderation_status,
  created_at
)
select
  case
    when category = '咖啡甜品' then 'cafe'
    when category = '酒馆' then 'bar'
    when category = '街头小吃' then 'market'
    else 'restaurant'
  end,
  name,
  name,
  '',
  lat,
  lng,
  coalesce(image_url, ''),
  'legacy_food_places',
  id,
  'published',
  created_at
from public.food_places
on conflict (legacy_food_place_id) do nothing;

alter table public.brands enable row level security;
alter table public.categories enable row level security;
alter table public.catalog_items enable row level security;
alter table public.item_barcodes enable row level security;
alter table public.places enable row level security;
alter table public.item_locations enable row level security;
alter table public.reviews enable row level security;
alter table public.review_photos enable row level security;
alter table public.favorites enable row level security;
alter table public.missing_item_requests enable row level security;

revoke all on public.app_admins from anon, authenticated;
revoke all on public.brands, public.categories, public.catalog_items,
  public.item_barcodes, public.places, public.item_locations,
  public.reviews, public.review_photos, public.favorites,
  public.missing_item_requests
from anon, authenticated;

grant select on public.brands, public.categories, public.catalog_items,
  public.item_barcodes,
  public.places, public.item_locations, public.reviews, public.review_photos
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

drop policy if exists "brands_public_read" on public.brands;
create policy "brands_public_read"
on public.brands for select
to anon, authenticated
using (active or public.is_app_admin());

drop policy if exists "brands_admin_write" on public.brands;
create policy "brands_admin_write"
on public.brands for all
to authenticated
using (public.is_app_admin())
with check (public.is_app_admin());

drop policy if exists "categories_public_read" on public.categories;
create policy "categories_public_read"
on public.categories for select
to anon, authenticated
using (active or public.is_app_admin());

drop policy if exists "categories_admin_write" on public.categories;
create policy "categories_admin_write"
on public.categories for all
to authenticated
using (public.is_app_admin())
with check (public.is_app_admin());

drop policy if exists "catalog_items_public_read" on public.catalog_items;
create policy "catalog_items_public_read"
on public.catalog_items for select
to anon, authenticated
using (active or public.is_app_admin());

drop policy if exists "catalog_items_admin_write" on public.catalog_items;
create policy "catalog_items_admin_write"
on public.catalog_items for all
to authenticated
using (public.is_app_admin())
with check (public.is_app_admin());

drop policy if exists "item_barcodes_public_read" on public.item_barcodes;
create policy "item_barcodes_public_read"
on public.item_barcodes for select
to anon, authenticated
using (
  exists (
    select 1 from public.catalog_items i
    where i.id = item_id and i.active
  )
);

drop policy if exists "item_barcodes_admin_write" on public.item_barcodes;
create policy "item_barcodes_admin_write"
on public.item_barcodes for all
to authenticated
using (public.is_app_admin())
with check (public.is_app_admin());

drop policy if exists "places_public_read" on public.places;
create policy "places_public_read"
on public.places for select
to anon
using (moderation_status = 'published');

drop policy if exists "places_authenticated_read" on public.places;
create policy "places_authenticated_read"
on public.places for select
to authenticated
using (
  moderation_status = 'published'
  or created_by = auth.uid()
  or public.is_app_admin()
);

drop policy if exists "places_authenticated_insert" on public.places;
create policy "places_authenticated_insert"
on public.places for insert
to authenticated
with check (
  created_by = auth.uid()
  and moderation_status = 'pending'
);

drop policy if exists "places_owner_update" on public.places;
create policy "places_owner_update"
on public.places for update
to authenticated
using (created_by = auth.uid() or public.is_app_admin())
with check (
  (created_by = auth.uid() and moderation_status = 'pending')
  or public.is_app_admin()
);

drop policy if exists "places_owner_delete" on public.places;
create policy "places_owner_delete"
on public.places for delete
to authenticated
using (created_by = auth.uid() or public.is_app_admin());

drop policy if exists "item_locations_public_read" on public.item_locations;
create policy "item_locations_public_read"
on public.item_locations for select
to anon, authenticated
using (
  exists (
    select 1 from public.catalog_items i
    where i.id = item_id and i.active
  )
  and exists (
    select 1 from public.places p
    where p.id = place_id and p.moderation_status = 'published'
  )
);

drop policy if exists "item_locations_admin_write" on public.item_locations;
create policy "item_locations_admin_write"
on public.item_locations for all
to authenticated
using (public.is_app_admin())
with check (public.is_app_admin());

drop policy if exists "reviews_public_read" on public.reviews;
create policy "reviews_public_read"
on public.reviews for select
to anon
using (moderation_status = 'published');

drop policy if exists "reviews_authenticated_read" on public.reviews;
create policy "reviews_authenticated_read"
on public.reviews for select
to authenticated
using (
  moderation_status = 'published'
  or user_id = auth.uid()
  or public.is_app_admin()
);

drop policy if exists "reviews_authenticated_insert" on public.reviews;
create policy "reviews_authenticated_insert"
on public.reviews for insert
to authenticated
with check (
  user_id = auth.uid()
  and moderation_status = 'pending'
);

drop policy if exists "reviews_owner_update" on public.reviews;
create policy "reviews_owner_update"
on public.reviews for update
to authenticated
using (user_id = auth.uid() or public.is_app_admin())
with check (
  (user_id = auth.uid() and moderation_status = 'pending')
  or public.is_app_admin()
);

drop policy if exists "reviews_owner_delete" on public.reviews;
create policy "reviews_owner_delete"
on public.reviews for delete
to authenticated
using (user_id = auth.uid() or public.is_app_admin());

drop policy if exists "review_photos_public_read" on public.review_photos;
create policy "review_photos_public_read"
on public.review_photos for select
to anon
using (
  exists (
    select 1 from public.reviews r
    where r.id = review_id and r.moderation_status = 'published'
  )
);

drop policy if exists "review_photos_authenticated_read" on public.review_photos;
create policy "review_photos_authenticated_read"
on public.review_photos for select
to authenticated
using (
  exists (
    select 1 from public.reviews r
    where r.id = review_id
      and (
        r.moderation_status = 'published'
        or r.user_id = auth.uid()
        or public.is_app_admin()
      )
  )
);

drop policy if exists "review_photos_owner_insert" on public.review_photos;
create policy "review_photos_owner_insert"
on public.review_photos for insert
to authenticated
with check (
  exists (
    select 1 from public.reviews r
    where r.id = review_id and r.user_id = auth.uid()
  )
);

drop policy if exists "review_photos_owner_delete" on public.review_photos;
create policy "review_photos_owner_delete"
on public.review_photos for delete
to authenticated
using (
  exists (
    select 1 from public.reviews r
    where r.id = review_id
      and (r.user_id = auth.uid() or public.is_app_admin())
  )
);

drop policy if exists "favorites_owner_all" on public.favorites;
create policy "favorites_owner_all"
on public.favorites for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "missing_item_requests_owner_read" on public.missing_item_requests;
create policy "missing_item_requests_owner_read"
on public.missing_item_requests for select
to authenticated
using (user_id = auth.uid() or public.is_app_admin());

drop policy if exists "missing_item_requests_owner_insert" on public.missing_item_requests;
create policy "missing_item_requests_owner_insert"
on public.missing_item_requests for insert
to authenticated
with check (user_id = auth.uid() and status = 'pending');

drop policy if exists "missing_item_requests_admin_update" on public.missing_item_requests;
create policy "missing_item_requests_admin_update"
on public.missing_item_requests for update
to authenticated
using (public.is_app_admin())
with check (public.is_app_admin());

insert into storage.buckets (id, name, public)
values ('review-photos', 'review-photos', false)
on conflict (id) do update set public = excluded.public;

drop policy if exists "review_photo_objects_owner_insert" on storage.objects;
create policy "review_photo_objects_owner_insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'review-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "review_photo_objects_approved_read" on storage.objects;
create policy "review_photo_objects_approved_read"
on storage.objects for select
to anon, authenticated
using (
  bucket_id = 'review-photos'
  and exists (
    select 1
    from public.review_photos rp
    join public.reviews r on r.id = rp.review_id
    where rp.storage_path = name
      and (
        r.moderation_status = 'published'
        or r.user_id = auth.uid()
        or public.is_app_admin()
      )
  )
);

drop policy if exists "review_photo_objects_owner_delete" on storage.objects;
create policy "review_photo_objects_owner_delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'review-photos'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_app_admin()
  )
);

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
  count(r.id)::integer as review_count
from public.catalog_items i
left join public.brands b on b.id = i.brand_id
left join public.categories c on c.id = i.category_id
left join public.reviews r
  on r.item_id = i.id and r.moderation_status = 'published'
where i.active
group by i.id, b.name_zh, b.name_ko, c.name_zh;

revoke all on public.catalog_item_cards from anon, authenticated;
grant select on public.catalog_item_cards to anon, authenticated;

create or replace function public.lookup_catalog_item_by_barcode(scan_code text)
returns setof public.catalog_item_cards
language sql
stable
security invoker
set search_path = public
as $$
  select card.*
  from public.item_barcodes ib
  join public.catalog_item_cards card on card.id = ib.item_id
  where ib.gtin14 = public.normalize_gtin(scan_code)
  limit 1;
$$;

grant execute on function public.lookup_catalog_item_by_barcode(text)
to anon, authenticated;

comment on table public.catalog_items is
  'Platform-maintained products for food, beauty, life, and fashion. Users cannot create rows directly.';
comment on table public.item_barcodes is
  'One-to-many GTIN aliases for catalog products. Scanner lookups normalize EAN-8, UPC-A, EAN-13, and GTIN-14.';
comment on table public.places is
  'Community-extensible restaurants and stores. New user rows require moderation.';
comment on table public.reviews is
  'Authenticated user experiences bound to exactly one catalog item or place.';

commit;
