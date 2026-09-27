-- Phase 3: run only after Supabase Auth is integrated in every client.
-- This closes the temporary anonymous place-submission path.

begin;

alter table public.food_places
  add column if not exists created_by uuid references auth.users(id) on delete set null;

create index if not exists food_places_created_by_idx
  on public.food_places (created_by);

drop policy if exists "food_places_insert_transition" on public.food_places;
revoke all on public.food_places from anon, authenticated;
grant select on public.food_places to anon, authenticated;
grant insert, update, delete on public.food_places to authenticated;

-- Remove permissive policies created by the original prototype schema. RLS
-- policies are ORed together, so leaving any of these in place would bypass the
-- owner checks below.
drop policy if exists "food_places_insert_auth" on public.food_places;
drop policy if exists "food_places_update_auth" on public.food_places;
drop policy if exists "food_places_delete_auth" on public.food_places;
drop policy if exists "food_places_select_auth" on public.food_places;

drop policy if exists "food_places_insert_authenticated" on public.food_places;
create policy "food_places_insert_authenticated"
on public.food_places for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and char_length(btrim(name)) between 1 and 120
  and char_length(coalesce(note, '')) between 1 and 800
  and lat between 32 and 39.5
  and lng between 124 and 132
);

drop policy if exists "food_places_update_own" on public.food_places;
create policy "food_places_update_own"
on public.food_places for update
to authenticated
using (created_by = (select auth.uid()) or public.is_app_admin())
with check (created_by = (select auth.uid()) or public.is_app_admin());

drop policy if exists "food_places_delete_own" on public.food_places;
create policy "food_places_delete_own"
on public.food_places for delete
to authenticated
using (created_by = (select auth.uid()) or public.is_app_admin());

drop policy if exists "food_photos_insert_authenticated" on storage.objects;
create policy "food_photos_insert_authenticated"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'food-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

commit;
