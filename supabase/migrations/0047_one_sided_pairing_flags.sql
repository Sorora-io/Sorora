begin;
-- Admin-only mutuality metadata; never return ordered preferences or direction.
create or replace function public.get_matching_review(p_group_id uuid,p_cycle_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not public.is_group_admin(p_group_id) then raise exception 'Only chapter admins can review matching.' using errcode='42501';end if;
 perform 1 from public.groups where id=p_group_id for share;
 if not exists(select 1 from public.cycles where id=p_cycle_id and group_id=p_group_id) then raise exception 'This cycle does not belong to your chapter.';end if;
 select jsonb_build_object(
 'unmatched',coalesce((select jsonb_agg(jsonb_build_object('userId',m.user_id,'name',coalesce(p.name,'Unnamed member'),'role',m.role) order by m.role,p.name,m.user_id)
 from public.cycle_memberships(p_group_id,p_cycle_id) m join public.profiles p on p.id=m.user_id
 where m.status='approved' and m.role in('big','little') and not exists(select 1 from public.pairings pairs where pairs.group_id=p_group_id and pairs.cycle_id=p_cycle_id and (pairs.big_id=m.user_id or pairs.little_id=m.user_id))),'[]'::jsonb),
 'oneSidedPairings',coalesce((select jsonb_agg(jsonb_build_object('bigId',pairs.big_id,'littleId',pairs.little_id,'bigName',coalesce(b.name,'Former member'),'littleName',coalesce(l.name,'Former member')) order by pairs.big_id,pairs.little_id)
 from public.pairings pairs left join public.profiles b on b.id=pairs.big_id left join public.profiles l on l.id=pairs.little_id
 where pairs.group_id=p_group_id and pairs.cycle_id=p_cycle_id and
 (exists(select 1 from public.rankings r where r.group_id=p_group_id and r.cycle_id=p_cycle_id and r.ranker_id=pairs.big_id and pairs.little_id=any(r.ranked_ids))
 <> exists(select 1 from public.rankings r where r.group_id=p_group_id and r.cycle_id=p_cycle_id and r.ranker_id=pairs.little_id and pairs.big_id=any(r.ranked_ids)))),'[]'::jsonb),
 'unsupportedPairings',coalesce((select jsonb_agg(jsonb_build_object('bigId',pairs.big_id,'littleId',pairs.little_id,'bigName',coalesce(b.name,'Former member'),'littleName',coalesce(l.name,'Former member')) order by pairs.big_id,pairs.little_id)
 from public.pairings pairs left join public.profiles b on b.id=pairs.big_id left join public.profiles l on l.id=pairs.little_id
 where pairs.group_id=p_group_id and pairs.cycle_id=p_cycle_id and not exists(select 1 from public.rankings r where r.group_id=p_group_id and r.cycle_id=p_cycle_id and ((r.ranker_id=pairs.big_id and pairs.little_id=any(r.ranked_ids)) or (r.ranker_id=pairs.little_id and pairs.big_id=any(r.ranked_ids))))),'[]'::jsonb)
 ) into result;return result;
end;$$;
revoke all on function public.get_matching_review(uuid,uuid) from public,anon;
grant execute on function public.get_matching_review(uuid,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
