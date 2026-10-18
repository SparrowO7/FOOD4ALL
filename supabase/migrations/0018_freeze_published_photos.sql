-- Follow-up to 0017: freeze donor photographs when a listing is published.
begin;
create or replace function public.can_upload_donation_photo(p_donation uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.donations d
 where d.id=p_donation and d.donor_id=auth.uid() and d.status='draft');
$$;
revoke all on function public.can_upload_donation_photo(uuid) from public,anon;
grant execute on function public.can_upload_donation_photo(uuid) to authenticated;
comment on function public.can_upload_donation_photo(uuid) is
 'Only the donor of an unpublished draft may insert, replace or remove its food photograph.';
commit;
