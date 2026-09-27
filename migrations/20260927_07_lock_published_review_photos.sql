begin;

-- A published review has already passed automatic text and image checks. Keep
-- its photo set immutable so a direct API client cannot swap in unchecked media.
drop policy if exists "review_photos_owner_insert" on public.review_photos;
create policy "review_photos_owner_insert"
on public.review_photos for insert
to authenticated
with check (
  exists (
    select 1
    from public.reviews r
    where r.id = review_id
      and r.user_id = (select auth.uid())
      and r.moderation_status = 'pending'
  )
);

drop policy if exists "review_photos_owner_delete" on public.review_photos;
create policy "review_photos_owner_delete"
on public.review_photos for delete
to authenticated
using (
  exists (
    select 1
    from public.reviews r
    where r.id = review_id
      and (
        (r.user_id = (select auth.uid()) and r.moderation_status = 'pending')
        or public.is_app_admin()
      )
  )
);

drop policy if exists "review_photo_objects_owner_insert" on storage.objects;
create policy "review_photo_objects_owner_insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'review-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1
    from public.reviews r
    where r.id::text = (storage.foldername(name))[2]
      and r.user_id = (select auth.uid())
      and r.moderation_status = 'pending'
  )
);

drop policy if exists "review_photo_objects_owner_delete" on storage.objects;
create policy "review_photo_objects_owner_delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'review-photos'
  and (
    public.is_app_admin()
    or (
      (storage.foldername(name))[1] = (select auth.uid())::text
      and exists (
        select 1
        from public.reviews r
        where r.id::text = (storage.foldername(name))[2]
          and r.user_id = (select auth.uid())
          and r.moderation_status = 'pending'
      )
    )
  )
);

commit;
