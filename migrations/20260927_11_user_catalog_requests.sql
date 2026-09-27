-- Harden user-submitted catalog requests before automatic DeepSeek review.

begin;

alter table public.missing_item_requests
  drop constraint if exists missing_item_requests_brand_length,
  add constraint missing_item_requests_brand_length
    check (char_length(btrim(brand_text)) between 1 and 160),
  drop constraint if exists missing_item_requests_barcode_length,
  add constraint missing_item_requests_barcode_length
    check (char_length(barcode) <= 80),
  drop constraint if exists missing_item_requests_evidence_url_length,
  add constraint missing_item_requests_evidence_url_length
    check (char_length(btrim(evidence_url)) between 8 and 600),
  drop constraint if exists missing_item_requests_note_length,
  add constraint missing_item_requests_note_length
    check (char_length(note) <= 800);

create unique index if not exists missing_item_requests_pending_name_uidx
  on public.missing_item_requests (
    user_id,
    channel,
    lower(btrim(brand_text)),
    lower(btrim(item_name))
  )
  where status = 'pending';

-- New food places now enter through the authenticated moderation edge
-- function; browser clients can no longer bypass DeepSeek by writing to the
-- legacy public map table directly.
revoke insert, update, delete on public.food_places from authenticated;

commit;
