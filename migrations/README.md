# BanFan Supabase migrations

Run these files in Supabase SQL Editor in order.

## Now

1. `20260927_01_lock_legacy.sql`
   - Keeps public place browsing and the current anonymous add-place flow.
   - Removes anonymous update/delete permissions.
   - Removes anonymous uploads to the legacy photo bucket.

2. `20260927_02_catalog_foundation.sql`
   - Creates the four-channel catalog, one-to-many product barcodes and a
     public barcode lookup function, places, item locations, reviews,
     review photos, favorites, missing-item requests, admin membership,
     moderation fields, indexes, triggers, storage policies, and RLS.
   - Copies existing `food_places` rows into `places` without deleting or
     changing the legacy rows.
   - Products remain admin-maintained; authenticated users can submit places,
     reviews, favorites, and missing-item requests.

3. `20260927_02b_seed_categories.sql`
   - Adds idempotent Food, Beauty, Life, and Fashion category seeds.

4. `20260927_04_import_oliveyoung_200.sql`
   - Imports the reviewed Olive Young seed set from the public ranking pages.
   - Safe to rerun: products are upserted by `source + source_key`.
   - Leaves barcodes pending instead of inventing values not published by the
     retailer.

5. `20260927_05_tighten_catalog_grants.sql`
   - Removes Supabase's broad default table grants from browser roles.
   - Re-grants only the operations used by the current application; RLS remains
     the primary authorization boundary.

6. `20260927_verify.sql`
   - Read-only checks for tables, RLS, policies, and legacy-place migration.

## Later, after authentication ships

7. `20260927_03_require_auth.sql`
   - Stops anonymous place creation.
   - Requires an authenticated owner for legacy place writes.
   - Do not run this file until the website and mobile app both attach a
     Supabase user session to place submissions.

## First administrator

After creating the owner account through Supabase Auth, add it manually:

```sql
insert into public.app_admins (user_id)
values ('USER_UUID_FROM_AUTH_USERS');
```

Never put a service-role key in the website or mobile application.
