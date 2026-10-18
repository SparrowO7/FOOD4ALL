begin;
alter table public.deliveries add column if not exists people_reached integer check(people_reached>=0);
create or replace function public.is_valid_transition(p_from donation_status,p_to donation_status)
returns boolean language sql immutable as $$
select case p_from
 when 'draft' then p_to in ('available','cancelled')
 when 'available' then p_to in ('claimed','cancelled','expired')
 when 'claimed' then p_to in ('pickup_scheduled','picked_up','available','expired','cancelled')
 when 'pickup_scheduled' then p_to in ('picked_up','cancelled','rejected')
 when 'picked_up' then p_to in ('delivered','rejected')
 when 'delivered' then p_to in ('completed','rejected') else false end;
$$;
create or replace function public.ngo_collect(p_id uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare d public.donations; u uuid:=auth.uid();
begin
 select * into d from public.donations where id=p_id for update;
 if u is null or not found or d.claimed_by_ngo is distinct from u or public.app_role(u) is distinct from 'ngo' then raise exception 'Only the claiming NGO may collect this food';end if;
 if not exists(select 1 from public.ngos where id=u and verification_status='verified') then raise exception 'NGO verification is required';end if;
 if d.status<>'claimed' or d.assigned_volunteer is not null then raise exception 'This donation is not awaiting direct NGO collection';end if;
 if d.best_before<=now() or d.pickup_window_end<=now() then raise exception 'The food or pickup window has expired';end if;
 update public.donations set status='picked_up' where id=p_id;
 insert into public.donation_events(donation_id,from_status,to_status,actor_id,actor_role,note)values(p_id,'claimed','picked_up',u,'ngo','NGO collected directly from the donor.');
end;$$;
create or replace function public.ngo_distribute(p_id uuid,p_servings integer,p_people integer,p_area text,p_note text default null) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare d public.donations;u uuid:=auth.uid();
begin
 select * into d from public.donations where id=p_id for update;
 if u is null or not found or d.claimed_by_ngo is distinct from u or public.app_role(u) is distinct from 'ngo' then raise exception 'Only the claiming NGO may record distribution';end if;
 if not exists(select 1 from public.ngos where id=u and verification_status='verified') then raise exception 'NGO verification is required';end if;
 if d.status<>'picked_up' or d.assigned_volunteer is not null then raise exception 'Record direct NGO collection first; distribution can only be recorded once';end if;
 if d.best_before<=now() then raise exception 'The use-before time has passed. Do not distribute this batch through this flow';end if;
 if p_servings is null or p_people is null or p_servings<=0 or p_people<=0 or coalesce(btrim(p_area),'')='' or length(p_area)>300 or length(coalesce(p_note,''))>2000 then raise exception 'Enter positive servings, people reached, and a distribution area';end if;
 update public.donations set status='delivered' where id=p_id;
 insert into public.deliveries(donation_id,ngo_id,volunteer_id,servings_delivered,people_reached,distribution_area,recipient_note)values(p_id,u,null,p_servings,p_people,btrim(p_area),nullif(btrim(p_note),''));
 insert into public.donation_events(donation_id,from_status,to_status,actor_id,actor_role,note)values(p_id,'picked_up','delivered',u,'ngo','Distribution recorded by the receiving NGO.');
 update public.donations set status='completed' where id=p_id;
 insert into public.donation_events(donation_id,from_status,to_status,actor_id,actor_role,note)values(p_id,'delivered','completed',u,'ngo','NGO confirmed distribution. Counts are NGO-reported.');
end;$$;
revoke all on function public.ngo_collect(uuid) from public,anon;
revoke all on function public.ngo_distribute(uuid,integer,integer,text,text) from public,anon;
grant execute on function public.ngo_collect(uuid) to authenticated;
grant execute on function public.ngo_distribute(uuid,integer,integer,text,text) to authenticated;
commit;
