-- Reveal only the absence of incoming preferences, to admins after collection closes.
begin;
create or replace function public.get_unranked_member_review(p_group_id uuid, p_cycle_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare g public.groups; members jsonb;
begin
 if auth.uid() is null or not public.is_group_admin(p_group_id) then raise exception 'Only chapter admins can review members.'; end if;
 select * into g from public.groups where id=p_group_id for share;
 if not exists(select 1 from public.cycles where id=p_cycle_id and group_id=p_group_id) then raise exception 'This cycle does not belong to your chapter.'; end if;
 -- A group deadline describes its active cycle, not historical cycles.
 if g.active_cycle_id is distinct from p_cycle_id or g.ranking_deadline is null
    or statement_timestamp() < ((g.ranking_deadline + 1)::timestamp at time zone 'UTC') then
  return jsonb_build_object('state','not_due','members','[]'::jsonb);
 end if;
 if g.blind_rankings is distinct from false then return jsonb_build_object('state','private','members','[]'::jsonb); end if;
 select coalesce(jsonb_agg(jsonb_build_object('userId',m.user_id,'name',coalesce(p.name,'Unnamed member'),'role',m.role) order by m.role,p.name,m.user_id),'[]'::jsonb)
 into members from public.memberships m left join public.profiles p on p.id=m.user_id
 where m.group_id=p_group_id and m.status='approved' and m.role in ('big','little')
 and not exists (
  select 1 from public.rankings r join public.memberships voter
   on voter.group_id=p_group_id and voter.user_id=r.ranker_id and voter.status='approved'
   and voter.role=case when m.role='big' then 'little' else 'big' end
  where r.group_id=p_group_id and r.cycle_id=p_cycle_id and m.user_id=any(r.ranked_ids)
 );
 return jsonb_build_object('state','ready','members',members);
end;
$$;
revoke all on function public.get_unranked_member_review(uuid,uuid) from public,anon;
grant execute on function public.get_unranked_member_review(uuid,uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
