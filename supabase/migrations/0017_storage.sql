-- ============================================================================
-- Food4All — 0017_storage.sql
--
-- Secure photo storage: the last unimplemented feature in SOFTWARE_STATUS.md
-- ("secure photo upload ... photos are not implemented by this patch").
--
-- The columns have existed since 0001 (`donations.photo_url`,
-- `deliveries.proof_photo_url`) but nothing ever wrote to them. Storing a URL a
-- client can type is not photo upload — it lets anyone attach an arbitrary
-- external image, and it gives the platform no control over what is served.
--
-- Design decisions, and why:
--
--   1. TWO PRIVATE BUCKETS, not one public bucket. A food photo can show a
--      kitchen interior, staff, and occasionally a person; a delivery proof can
--      show a shelter. Neither belongs on a CDN with a guessable URL.
--      `public = false` means reads go through a short-lived signed URL that
--      the server mints only after checking who is asking.
--
--   2. PATH ENCODES THE DONATION: `{donation_id}/{uuid}.{ext}`. Every policy
--      below resolves the donation from the first path segment, so access
--      control needs no mapping table and cannot drift out of sync with the
--      object it describes.
--
--   3. THE FILENAME IS SERVER-GENERATED. The client's filename is never used.
--      A name like `../../other-donation/photo.jpg` is the obvious attack on a
--      path-addressed bucket, so it is discarded rather than sanitised.
--
--   4. POLICY HELPERS ARE `SECURITY DEFINER` ON PURPOSE. After 0015 the
--      `donations_select` policy is `can_see_exact(donations)` — a browsing NGO
--      cannot read the row of an available donation. If the storage policies
--      queried `donations` directly, RLS would filter that subquery too and a
--      photo would only become visible after claiming, which is backwards: the
--      photo is what helps an NGO decide whether to claim. The helper functions
--      read past RLS but apply their own explicit, narrower rule.
--
--   5. UPLOAD IS LIMITED TO THE MOMENT IT MAKES SENSE. A donor may attach a
--      photo while the donation is still a draft — before that, the row may not
--      exist yet, and after publishing the record should be immutable. A
--      volunteer may attach proof only while the donation is `delivered`, i.e.
--      between pickup and NGO confirmation, which is exactly the window the
--      handover form occupies.
--
-- Apply after 0016. Re-runnable.
-- ============================================================================

begin;

-- ---------- buckets ----------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('donation-photos', 'donation-photos', false, 5242880,
   array['image/jpeg','image/png','image/webp']),
  ('delivery-proofs', 'delivery-proofs', false, 5242880,
   array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 5 MiB. The browser downsizes before upload (PhotoInput, ~1600 px JPEG), so
-- this is a ceiling for the odd un-resized client, not the expected size.

-- ---------- access helpers ---------------------------------------------------
--
-- Each takes the donation id parsed from the object path and answers one
-- question. Keeping the rule in a function rather than inline in the policy
-- means the read rule and the upload rule cannot drift apart between buckets.

create or replace function public.can_view_donation_media(p_donation uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.donations d
    where d.id = p_donation
      and (
        -- The people running this handover.
        public.can_see_exact(d)
        -- Everyone signed in may see the photo of food that is on offer,
        -- because that is the point of listing it. This is the one deliberate
        -- widening, and it is limited to `available`: once claimed, the photo
        -- drops back to participants only.
        or d.status = 'available'
      )
  );
$$;

create or replace function public.can_upload_donation_photo(p_donation uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.donations d
    where d.id = p_donation
      and d.donor_id = auth.uid()
      and d.status in ('draft', 'available')
  );
$$;

create or replace function public.can_upload_delivery_proof(p_donation uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.donations d
    where d.id = p_donation
      and d.assigned_volunteer = auth.uid()
      and d.status = 'delivered'
  );
$$;

revoke all on function public.can_view_donation_media(uuid)      from public, anon;
revoke all on function public.can_upload_donation_photo(uuid)    from public, anon;
revoke all on function public.can_upload_delivery_proof(uuid)    from public, anon;
grant execute on function public.can_view_donation_media(uuid)   to authenticated;
grant execute on function public.can_upload_donation_photo(uuid) to authenticated;
grant execute on function public.can_upload_delivery_proof(uuid) to authenticated;

-- ---------- storage policies -------------------------------------------------
--
-- `storage.objects` already has RLS enabled by Supabase; these add the policies
-- for the two buckets. Statement-level, so they are safe to re-run.

drop policy if exists f4a_donation_photos_read on storage.objects;
create policy f4a_donation_photos_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'donation-photos'
    and public.can_view_donation_media((storage.foldername(name))[1]::uuid)
  );

drop policy if exists f4a_donation_photos_write on storage.objects;
create policy f4a_donation_photos_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'donation-photos'
    and public.can_upload_donation_photo((storage.foldername(name))[1]::uuid)
    -- The object must live directly under its donation folder. Without this a
    -- caller could satisfy the helper with donation A and write to
    -- `A/B/...`, leaving a path that no reader rule resolves.
    and array_length(storage.foldername(name), 1) = 1
  );

-- Replace semantics: uploading a new photo for the same draft should overwrite,
-- and a donor may remove a wrong one. Both are allowed only under the same
-- ownership rule as the initial upload.
drop policy if exists f4a_donation_photos_update on storage.objects;
create policy f4a_donation_photos_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'donation-photos'
    and public.can_upload_donation_photo((storage.foldername(name))[1]::uuid)
  )
  with check (
    bucket_id = 'donation-photos'
    and public.can_upload_donation_photo((storage.foldername(name))[1]::uuid)
  );

drop policy if exists f4a_donation_photos_delete on storage.objects;
create policy f4a_donation_photos_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'donation-photos'
    and public.can_upload_donation_photo((storage.foldername(name))[1]::uuid)
  );

drop policy if exists f4a_delivery_proofs_read on storage.objects;
create policy f4a_delivery_proofs_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'delivery-proofs'
    and public.can_view_donation_media((storage.foldername(name))[1]::uuid)
  );

drop policy if exists f4a_delivery_proofs_write on storage.objects;
create policy f4a_delivery_proofs_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'delivery-proofs'
    and public.can_upload_delivery_proof((storage.foldername(name))[1]::uuid)
    and array_length(storage.foldername(name), 1) = 1
  );

-- No update or delete on proofs. The handover photograph is evidence; a
-- volunteer who could replace it after the NGO had looked at it would make the
-- NGO's confirmation meaningless.

-- ---------- record the object path, not a URL --------------------------------

comment on column public.donations.photo_url is
  'Object path inside the private donation-photos bucket ({donation_id}/{uuid}.{ext}), or a legacy external URL. Rendered through a short-lived signed URL — never public. See 0017_storage.sql.';

comment on column public.deliveries.proof_photo_url is
  'Object path inside the private delivery-proofs bucket. Immutable evidence of the handover; no update or delete policy exists. See 0017_storage.sql.';

commit;

-- Verify:
--   select id, public, file_size_limit from storage.buckets
--   where id in ('donation-photos','delivery-proofs');
-- Expect public = false for both.
