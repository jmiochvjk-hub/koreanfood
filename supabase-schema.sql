create table if not exists public.food_places (
  id text primary key,
  name text not null,
  category text not null default '韩餐',
  dish text default '',
  rating numeric default 0,
  price integer default 0,
  note text default '',
  lat double precision not null,
  lng double precision not null,
  submission_count integer not null default 1,
  created_at timestamptz not null default now()
);

alter table public.food_places
  add column if not exists submission_count integer not null default 1;

alter table public.food_places enable row level security;

drop policy if exists "food_places_select_public" on public.food_places;
create policy "food_places_select_public"
on public.food_places for select
to anon
using (true);

drop policy if exists "food_places_insert_public" on public.food_places;
create policy "food_places_insert_public"
on public.food_places for insert
to anon
with check (true);

drop policy if exists "food_places_update_public" on public.food_places;
create policy "food_places_update_public"
on public.food_places for update
to anon
using (true)
with check (true);

drop policy if exists "food_places_delete_public" on public.food_places;
create policy "food_places_delete_public"
on public.food_places for delete
to anon
using (true);

create index if not exists food_places_created_at_idx
on public.food_places (created_at desc);
