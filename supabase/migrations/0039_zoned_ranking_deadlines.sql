-- Add exact, zoned deadlines without reinterpreting any legacy UTC dates.
begin;
alter table public.groups add column if not exists ranking_deadline_at timestamptz;
alter table public.groups add column if not exists ranking_deadline_timezone text;

create or replace function public.set_ranking_deadline(p_group_id uuid, p_deadline timestamptz, p_timezone text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.is_group_admin(p_group_id) then
    raise exception 'Only chapter admins can change the ranking deadline.';
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
revoke all on function public.set_ranking_deadline(uuid,timestamptz,text) from public,anon;
grant execute on function public.set_ranking_deadline(uuid,timestamptz,text) to authenticated;

create or replace function public.can_edit_ranking(p_group_id uuid, p_cycle_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.cycle_memberships(p_group_id,p_cycle_id) m
    join public.groups g on g.id = m.group_id
    join public.cycles c on c.id = g.active_cycle_id and c.group_id = g.id
    where m.group_id = p_group_id and m.user_id = auth.uid()
      and m.status = 'approved' and m.role in ('big', 'little')
      and c.id = p_cycle_id and c.ended_at is null
      and (coalesce(g.ranking_deadline_at, (g.ranking_deadline + 1)::timestamp at time zone 'UTC') is null or
        statement_timestamp() < coalesce(g.ranking_deadline_at, (g.ranking_deadline + 1)::timestamp at time zone 'UTC'))
  );
$$;

create or replace function public.get_unranked_member_review(p_group_id uuid, p_cycle_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare g public.groups; members jsonb;
begin
 if auth.uid() is null or not public.is_group_admin(p_group_id) then raise exception 'Only chapter admins can review members.'; end if;
 select * into g from public.groups where id=p_group_id for share;
 if not exists(select 1 from public.cycles where id=p_cycle_id and group_id=p_group_id) then raise exception 'This cycle does not belong to your chapter.'; end if;
 -- A group deadline describes its active cycle, not historical cycles.
 if g.active_cycle_id is distinct from p_cycle_id or coalesce(g.ranking_deadline_at, (g.ranking_deadline + 1)::timestamp at time zone 'UTC') is null
    or statement_timestamp() < coalesce(g.ranking_deadline_at, (g.ranking_deadline + 1)::timestamp at time zone 'UTC') then
  return jsonb_build_object('state','not_due','members','[]'::jsonb);
 end if;
 if g.blind_rankings is distinct from false then return jsonb_build_object('state','private','members','[]'::jsonb); end if;
 select coalesce(jsonb_agg(jsonb_build_object('userId',m.user_id,'name',coalesce(p.name,'Unnamed member'),'role',m.role) order by m.role,p.name,m.user_id),'[]'::jsonb)
 into members from public.cycle_memberships(p_group_id,p_cycle_id) m left join public.profiles p on p.id=m.user_id
 where m.group_id=p_group_id and m.status='approved' and m.role in ('big','little')
 and not exists (
  select 1 from public.rankings r join public.cycle_memberships(p_group_id,p_cycle_id) voter
   on voter.group_id=p_group_id and voter.user_id=r.ranker_id and voter.status='approved'
   and voter.role=case when m.role='big' then 'little' else 'big' end
  where r.group_id=p_group_id and r.cycle_id=p_cycle_id and m.user_id=any(r.ranked_ids)
 );
 return jsonb_build_object('state','ready','members',members);
end;
$$;
notify pgrst, 'reload schema';
commit;
