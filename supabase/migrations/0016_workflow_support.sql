begin;
-- Only the responsible NGO/admin can browse assignable volunteer names.
create or replace function public.pickup_volunteers(p_donation uuid)
returns table(id uuid, full_name text, vehicle_type text)
language sql stable security definer set search_path=public,pg_temp as $$
 select v.id,p.full_name,v.vehicle_type from public.volunteers v
 join public.profiles p on p.id=v.id
 where v.is_available and p.role='volunteer' and exists (
 select 1 from public.donations d where d.id=p_donation and d.status='claimed'
 and (d.claimed_by_ngo=auth.uid() or public.is_admin()))
 order by p.full_name;
$$;
revoke all on function public.pickup_volunteers(uuid) from public,anon;
grant execute on function public.pickup_volunteers(uuid) to authenticated;

create table if not exists public.notifications (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 donation_id uuid not null references public.donations(id) on delete cascade,
 status donation_status not null,
 created_at timestamptz not null default now(),
 read_at timestamptz
);
alter table public.notifications enable row level security;
drop policy if exists notifications_own on public.notifications;
create policy notifications_own on public.notifications for select to authenticated using(user_id=auth.uid());
revoke all on public.notifications from anon,authenticated;
grant select on public.notifications to authenticated;
create index if not exists notifications_inbox on public.notifications(user_id,created_at desc);
create or replace function public.notify_donation_participants() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 insert into public.notifications(user_id,donation_id,status)
 select distinct recipient,new.donation_id,new.to_status
 from public.donations d cross join lateral
 unnest(array[d.donor_id,d.claimed_by_ngo,d.assigned_volunteer]) as recipient
 where d.id=new.donation_id and recipient is not null and recipient is distinct from new.actor_id;
 return new;
end;$$;
revoke all on function public.notify_donation_participants() from public,anon,authenticated;
drop trigger if exists donation_notify on public.donation_events;
create trigger donation_notify after insert on public.donation_events
 for each row execute function public.notify_donation_participants();
create or replace function public.read_notification(p_id uuid) returns void
language sql security definer set search_path=public,pg_temp as $$
 update public.notifications set read_at=coalesce(read_at,now()) where id=p_id and user_id=auth.uid();
$$;
revoke all on function public.read_notification(uuid) from public,anon;
grant execute on function public.read_notification(uuid) to authenticated;
commit;
