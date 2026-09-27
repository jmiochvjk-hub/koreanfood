begin;

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  channel text not null check (channel in ('food', 'beauty', 'life', 'fashion')),
  title text not null,
  body text not null,
  linked_item_id uuid references public.catalog_items(id) on delete set null,
  linked_place_id uuid references public.places(id) on delete set null,
  moderation_status text not null default 'pending'
    check (moderation_status in ('pending', 'published', 'rejected', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(btrim(title)) between 4 and 80),
  check (char_length(btrim(body)) between 10 and 2000),
  check (num_nonnulls(linked_item_id, linked_place_id) <= 1)
);

create index if not exists community_posts_feed_idx
  on public.community_posts (moderation_status, created_at desc);
create index if not exists community_posts_user_idx
  on public.community_posts (user_id, created_at desc);

create table if not exists public.community_post_photos (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  storage_path text not null unique,
  sort_order smallint not null default 0 check (sort_order between 0 and 8),
  created_at timestamptz not null default now()
);

create index if not exists community_post_photos_post_idx
  on public.community_post_photos (post_id, sort_order);

create table if not exists public.community_post_likes (
  user_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid not null references public.community_posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create table if not exists public.qa_usage (
  id bigint generated always as identity primary key,
  requester_key text not null,
  created_at timestamptz not null default now()
);

create index if not exists qa_usage_requester_created_idx
  on public.qa_usage (requester_key, created_at desc);

drop trigger if exists community_posts_set_updated_at on public.community_posts;
create trigger community_posts_set_updated_at
before update on public.community_posts
for each row execute function public.set_updated_at();

alter table public.community_posts enable row level security;
alter table public.community_post_photos enable row level security;
alter table public.community_post_likes enable row level security;
alter table public.qa_usage enable row level security;

revoke all on public.community_posts, public.community_post_photos,
  public.community_post_likes, public.qa_usage from anon, authenticated;

grant select on public.community_posts, public.community_post_photos
  to anon, authenticated;
grant insert, update, delete on public.community_posts,
  public.community_post_photos to authenticated;
grant select, insert, delete on public.community_post_likes to authenticated;

create policy "community_posts_public_read"
on public.community_posts for select to anon
using (moderation_status = 'published');

create policy "community_posts_authenticated_read"
on public.community_posts for select to authenticated
using (
  moderation_status = 'published'
  or user_id = (select auth.uid())
  or public.is_app_admin()
);

create policy "community_posts_owner_insert"
on public.community_posts for insert to authenticated
with check (
  user_id = (select auth.uid())
  and moderation_status = 'pending'
);

create policy "community_posts_owner_update"
on public.community_posts for update to authenticated
using (user_id = (select auth.uid()) or public.is_app_admin())
with check (
  (user_id = (select auth.uid()) and moderation_status = 'pending')
  or public.is_app_admin()
);

create policy "community_posts_owner_delete"
on public.community_posts for delete to authenticated
using (user_id = (select auth.uid()) or public.is_app_admin());

create policy "community_post_photos_public_read"
on public.community_post_photos for select to anon
using (
  exists (
    select 1 from public.community_posts p
    where p.id = post_id and p.moderation_status = 'published'
  )
);

create policy "community_post_photos_authenticated_read"
on public.community_post_photos for select to authenticated
using (
  exists (
    select 1 from public.community_posts p
    where p.id = post_id and (
      p.moderation_status = 'published'
      or p.user_id = (select auth.uid())
      or public.is_app_admin()
    )
  )
);

create policy "community_post_photos_owner_insert"
on public.community_post_photos for insert to authenticated
with check (
  exists (
    select 1 from public.community_posts p
    where p.id = post_id
      and p.user_id = (select auth.uid())
      and p.moderation_status = 'pending'
  )
);

create policy "community_post_photos_owner_delete"
on public.community_post_photos for delete to authenticated
using (
  exists (
    select 1 from public.community_posts p
    where p.id = post_id
      and (
        (p.user_id = (select auth.uid()) and p.moderation_status = 'pending')
        or public.is_app_admin()
      )
  )
);

create policy "community_post_likes_owner_read"
on public.community_post_likes for select to authenticated
using (user_id = (select auth.uid()));

create policy "community_post_likes_owner_insert"
on public.community_post_likes for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.community_posts p
    where p.id = post_id and p.moderation_status = 'published'
  )
);

create policy "community_post_likes_owner_delete"
on public.community_post_likes for delete to authenticated
using (user_id = (select auth.uid()));

insert into storage.buckets (id, name, public)
values ('community-posts', 'community-posts', false)
on conflict (id) do update set public = excluded.public;

create policy "community_post_objects_owner_insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'community-posts'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.community_posts p
    where p.id::text = (storage.foldername(name))[2]
      and p.user_id = (select auth.uid())
      and p.moderation_status = 'pending'
  )
);

create policy "community_post_objects_approved_read"
on storage.objects for select to anon, authenticated
using (
  bucket_id = 'community-posts'
  and exists (
    select 1
    from public.community_post_photos pp
    join public.community_posts p on p.id = pp.post_id
    where pp.storage_path = name
      and (
        p.moderation_status = 'published'
        or p.user_id = (select auth.uid())
        or public.is_app_admin()
      )
  )
);

create policy "community_post_objects_owner_delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'community-posts'
  and (
    public.is_app_admin()
    or (
      (storage.foldername(name))[1] = (select auth.uid())::text
      and exists (
        select 1 from public.community_posts p
        where p.id::text = (storage.foldername(name))[2]
          and p.user_id = (select auth.uid())
          and p.moderation_status = 'pending'
      )
    )
  )
);

create or replace view public.community_post_cards
with (security_invoker = true)
as
select
  p.id,
  p.user_id,
  p.channel,
  p.title,
  p.body,
  p.linked_item_id,
  p.linked_place_id,
  p.moderation_status,
  p.created_at,
  (
    select pp.storage_path
    from public.community_post_photos pp
    where pp.post_id = p.id
    order by pp.sort_order asc
    limit 1
  ) as cover_storage_path,
  (
    select count(*)::integer
    from public.community_post_photos pp
    where pp.post_id = p.id
  ) as photo_count,
  (
    select count(*)::integer
    from public.community_post_likes pl
    where pl.post_id = p.id
  ) as like_count,
  coalesce(nullif(ci.name_zh, ''), ci.name_ko, nullif(plc.name_zh, ''), plc.name_ko, '') as linked_title
from public.community_posts p
left join public.catalog_items ci on ci.id = p.linked_item_id
left join public.places plc on plc.id = p.linked_place_id;

revoke all on public.community_post_cards from anon, authenticated;
grant select on public.community_post_cards to anon, authenticated;

comment on table public.community_posts is
  'Free-form photo posts that complement the structured Korea catalogue and map.';
comment on table public.qa_usage is
  'Server-side request ledger used only for rate limiting grounded Q&A.';

commit;
