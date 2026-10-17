begin;
-- Restore a pure helper required by the current run_blind_matching function.
create or replace function public.complete_matching_preferences(p_ranked uuid[], p_universe uuid[])
returns uuid[] language sql immutable set search_path = public
as $$
  select coalesce(array_agg(u.id order by
    coalesce(array_position(p_ranked, u.id), cardinality(coalesce(p_ranked, '{}'::uuid[])) + u.position)), '{}'::uuid[])
  from unnest(p_universe) with ordinality as u(id, position);
$$;

revoke all on function public.complete_matching_preferences(uuid[],uuid[]) from public,anon;
grant execute on function public.complete_matching_preferences(uuid[],uuid[]) to authenticated;
notify pgrst,'reload schema';
commit;
