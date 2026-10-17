-- Superuser settings access stays separate from chapter admin and ranking access.
begin;
drop policy if exists "groups: superusers read settings" on public.groups;
create policy "groups: superusers read settings" on public.groups for select to authenticated using (public.is_superuser());
drop policy if exists "groups: superusers update settings" on public.groups;
create policy "groups: superusers update settings" on public.groups for update to authenticated
  using (public.is_superuser()) with check (public.is_superuser());
-- Existing column-level UPDATE grants still protect owner_id, active_cycle_id,
-- join codes and other lifecycle fields; no table-wide UPDATE grant is added.

create or replace function public.superuser_organization_settings(p_group_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare settings jsonb;
begin
  if auth.uid() is null or not public.is_superuser() then
    raise exception 'Only a superuser can view organization settings.' using errcode='42501';
  end if;
  select jsonb_build_object('group',to_jsonb(g),
    'bigs',(select count(*) from public.memberships m where m.group_id=g.id and m.status='approved' and m.role='big'),
    'littles',(select count(*) from public.memberships m where m.group_id=g.id and m.status='approved' and m.role='little'))
  into settings from public.groups g where g.id=p_group_id;
  if settings is null then raise exception 'Organization not found.'; end if;
  return settings;
end;$$;
revoke all on function public.superuser_organization_settings(uuid) from public,anon;
grant execute on function public.superuser_organization_settings(uuid) to authenticated;

create or replace function public.set_max_littles_per_big(p_group_id uuid, p_maximum integer)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not (public.is_group_admin(p_group_id) or public.is_superuser()) then
    raise exception 'Only chapter admins or superusers can set the maximum Littles per Big.';
  end if;
  if p_maximum is null or p_maximum not between 1 and 3 then
    raise exception 'Choose a maximum between 1 and 3 Littles.';
  end if;
  perform 1 from public.groups where id=p_group_id for update;
  if exists(select 1 from public.pairings p join public.groups g on g.active_cycle_id=p.cycle_id
    where g.id=p_group_id group by p.big_id having count(*) > p_maximum) then
    raise exception 'Adjust active pairings that exceed this maximum before lowering it.';
  end if;
  update public.groups set max_littles_per_big=p_maximum where id=p_group_id;
end;
$$;

create or replace function public.set_ranking_deadline(p_group_id uuid, p_deadline timestamptz, p_timezone text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not (public.is_group_admin(p_group_id) or public.is_superuser()) then
    raise exception 'Only chapter admins or superusers can change the ranking deadline.';
  end if;
  if p_deadline is not null and (not isfinite(p_deadline) or p_timezone is null or
      not exists(select 1 from pg_catalog.pg_timezone_names where name = p_timezone)) then
    raise exception 'Choose a valid named time zone and deadline.';
  end if;
  update public.groups set ranking_deadline_at=p_deadline,
    ranking_deadline_timezone=case when p_deadline is null then null else p_timezone end,
    ranking_deadline=null where id=p_group_id;
end;
$$;
revoke all on function public.set_max_littles_per_big(uuid,integer) from public,anon;
grant execute on function public.set_max_littles_per_big(uuid,integer) to authenticated;
revoke all on function public.set_ranking_deadline(uuid,timestamptz,text) from public,anon;
grant execute on function public.set_ranking_deadline(uuid,timestamptz,text) to authenticated;
notify pgrst, 'reload schema';
commit;
