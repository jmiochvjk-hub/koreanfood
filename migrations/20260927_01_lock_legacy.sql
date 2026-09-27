-- Phase 1: safe to run before authentication is wired into the client.
-- Keeps public reading and tightly constrained new-place submissions.
-- Removes anonymous update/delete and anonymous photo uploads.

begin;

alter table public.food_places enable row level security;

drop policy if exists "food_places_select_public" on public.food_places;
create policy "food_places_select_public"
on public.food_places for select
to anon, authenticated
using (true);

drop policy if exists "food_places_insert_public" on public.food_places;
drop policy if exists "food_places_insert_transition" on public.food_places;
create policy "food_places_insert_transition"
on public.food_places for insert
to anon
with check (
  char_length(btrim(name)) between 1 and 120
  and category in ('韩餐', '烤肉', '街头小吃', '咖啡甜品', '海鲜', '酒馆', '日料', '中餐', '西餐')
  and char_length(coalesce(note, '')) between 1 and 800
  and lat between 32 and 39.5
  and lng between 124 and 132
  and coalesce(rating, 0) = 0
  and coalesce(price, 0) = 0
  and coalesce(submission_count, 0) = 0
  and coalesce(image_url, '') = ''
  and coalesce(idol_name, '') = ''
  and cardinality(coalesce(contributors, '{}')) <= 1
);

drop policy if exists "food_places_update_public" on public.food_places;
drop policy if exists "food_places_delete_public" on public.food_places;

revoke update, delete on public.food_places from anon;
grant select, insert on public.food_places to anon;
grant select on public.food_places to authenticated;

drop policy if exists "food_photos_insert_public" on storage.objects;

comment on table public.food_places is
  'Legacy food-place table. Public update/delete disabled. Replace with public.places after auth cutover.';

commit;
