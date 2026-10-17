begin;
-- An automatic pair must have at least one explicit ranking connection.
-- Unconnected members remain unmatched for deliberate admin assignment.
create or replace function public.run_blind_matching_unreviewed(p_group_id uuid, p_cycle_id uuid)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  bigs uuid[];
  littles uuid[];
  twins uuid[];
  wanted_counts jsonb;
  rankings_map jsonb;
  little_prefs jsonb := '{}';
  big_prefs jsonb := '{}';
  next_proposal jsonb := '{}';
  held_map jsonb := '{}';
  free_littles uuid[];
  ranked uuid[];
  prefs uuid[];
  held uuid[];
  big uuid;
  little uuid;
  rejected uuid;
  proposal_index integer;
  capacity integer;
  worst_index integer;
  worst_rank integer;
  candidate_rank integer;
  i integer;
  matched integer := 0;
begin
  if auth.uid() is null or not public.is_group_admin(p_group_id) then
    raise exception 'Only a chapter admin can run matching.';
  end if;
  -- Serialize matching with other matching runs and cycle changes. Results
  -- are replaced atomically; a failure leaves the previous pairings intact.
  perform 1 from public.groups g where g.id = p_group_id for update;
  if not exists (
    select 1 from public.groups g join public.cycles c on c.id = g.active_cycle_id
    where g.id = p_group_id and c.id = p_cycle_id and c.group_id = g.id and c.ended_at is null
  ) then
    raise exception 'Matching can only run for your chapter’s active cycle.';
  end if;

  select coalesce(array_agg(m.user_id order by m.created_at, m.user_id) filter (where m.role = 'big'), '{}'),
         coalesce(array_agg(m.user_id order by m.created_at, m.user_id) filter (where m.role = 'little'), '{}'),
         coalesce(array_agg(m.user_id) filter (where m.role = 'big' and m.willing_to_take_twins), '{}')
    into bigs, littles, twins
    from public.cycle_memberships(p_group_id,p_cycle_id) m where m.group_id = p_group_id and m.status = 'approved';
  select coalesce(jsonb_object_agg(m.user_id::text, m.wanted_little_count), '{}') into wanted_counts
    from public.cycle_memberships(p_group_id,p_cycle_id) m where m.group_id = p_group_id and m.status = 'approved'
      and m.role = 'big' and m.wanted_little_count is not null;
  if cardinality(bigs) = 0 or cardinality(littles) = 0 then
    raise exception 'Approve at least one Big and one Little before running matching.';
  end if;
  select coalesce(jsonb_object_agg(r.ranker_id::text, to_jsonb(r.ranked_ids)), '{}') into rankings_map
    from public.rankings r where r.group_id = p_group_id and r.cycle_id = p_cycle_id;

  foreach little in array littles loop
    select coalesce(array_agg(value::uuid), '{}') into ranked
      from jsonb_array_elements_text(coalesce(rankings_map -> little::text, '[]'));
    little_prefs := jsonb_set(little_prefs, array[little::text], to_jsonb(public.complete_matching_preferences(ranked, array(select b from unnest(bigs) with ordinality e(b,ord) where b=any(ranked) or coalesce(rankings_map->b::text,'[]'::jsonb) ? little::text order by ord))));
    next_proposal := jsonb_set(next_proposal, array[little::text], '1');
  end loop;
  foreach big in array bigs loop
    select coalesce(array_agg(value::uuid), '{}') into ranked
      from jsonb_array_elements_text(coalesce(rankings_map -> big::text, '[]'));
    big_prefs := jsonb_set(big_prefs, array[big::text], to_jsonb(public.complete_matching_preferences(ranked, array(select l from unnest(littles) with ordinality e(l,ord) where l=any(ranked) or coalesce(rankings_map->l::text,'[]'::jsonb) ? big::text order by ord))));
    held_map := jsonb_set(held_map, array[big::text], '[]');
  end loop;

  -- Little-proposing deferred acceptance, including optional twin capacity.
  free_littles := littles;
  while cardinality(free_littles) > 0 loop
    little := free_littles[1];
    free_littles := free_littles[2:cardinality(free_littles)];
    proposal_index := (next_proposal ->> little::text)::integer;
    if proposal_index > jsonb_array_length(little_prefs -> little::text) then continue; end if;
    big := (little_prefs -> little::text ->> (proposal_index - 1))::uuid;
    next_proposal := jsonb_set(next_proposal, array[little::text], to_jsonb(proposal_index + 1));
    select coalesce(array_agg(value::uuid), '{}') into held from jsonb_array_elements_text(held_map -> big::text);
    select array_agg(value::uuid) into prefs from jsonb_array_elements_text(big_prefs -> big::text);
    capacity := least((select max_littles_per_big from public.groups where id=p_group_id), coalesce((wanted_counts ->> big::text)::integer, case when big = any(twins) then 2 else 1 end));
    if cardinality(held) < capacity then
      held := array_append(held, little);
    else
      worst_index := 1;
      worst_rank := -1;
      for i in 1..cardinality(held) loop
        candidate_rank := array_position(prefs, held[i]);
        if candidate_rank > worst_rank then worst_index := i; worst_rank := candidate_rank; end if;
      end loop;
      if array_position(prefs, little) < worst_rank then
        rejected := held[worst_index];
        held[worst_index] := little;
        free_littles := array_append(free_littles, rejected);
      else
        free_littles := array_append(free_littles, little);
      end if;
    end if;
    held_map := jsonb_set(held_map, array[big::text], to_jsonb(held));
  end loop;

  delete from public.pairings where group_id = p_group_id and cycle_id = p_cycle_id;
  foreach big in array bigs loop
    for little in select value::uuid from jsonb_array_elements_text(held_map -> big::text) loop
      insert into public.pairings (group_id, cycle_id, big_id, little_id)
      values (p_group_id, p_cycle_id, big, little);
      matched := matched + 1;
    end loop;
  end loop;
  return matched;
end;
$$;


revoke all on function public.run_blind_matching_unreviewed(uuid,uuid) from public,anon,authenticated;

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
 'unsupportedPairings',coalesce((select jsonb_agg(jsonb_build_object('bigId',pairs.big_id,'littleId',pairs.little_id,'bigName',coalesce(b.name,'Former member'),'littleName',coalesce(l.name,'Former member')) order by pairs.big_id,pairs.little_id)
 from public.pairings pairs left join public.profiles b on b.id=pairs.big_id left join public.profiles l on l.id=pairs.little_id
 where pairs.group_id=p_group_id and pairs.cycle_id=p_cycle_id and not exists(select 1 from public.rankings r where r.group_id=p_group_id and r.cycle_id=p_cycle_id and ((r.ranker_id=pairs.big_id and pairs.little_id=any(r.ranked_ids)) or (r.ranker_id=pairs.little_id and pairs.big_id=any(r.ranked_ids))))),'[]'::jsonb)
 ) into result;return result;
end;$$;
revoke all on function public.get_matching_review(uuid,uuid) from public,anon;
grant execute on function public.get_matching_review(uuid,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
