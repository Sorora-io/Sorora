-- Preferences are private by default. A chapter admin can flip
-- blind_rankings off on their group to expose members' ranked preferences;
-- matching itself never returns rankings — only final pairings — either way.
begin;

alter table public.groups add column if not exists blind_rankings boolean not null default true;
-- 0014 grants group updates column-by-column; the new toggle belongs there
-- alongside the existing name/school/description/deadline/min-ranking fields
-- so an admin can flip it with a plain client .update({blind_rankings}).
grant update (blind_rankings) on public.groups to authenticated;

drop policy if exists "rankings: admins view group rankings" on public.rankings;
create policy "rankings: admins view group rankings"
  on public.rankings for select to authenticated
  using (
    public.is_group_admin(group_id) and exists (
      select 1 from public.groups g where g.id = group_id and not g.blind_rankings
    )
  );

-- Restrictive backstop: even if a future permissive policy is added by
-- mistake, a ranking row can only be read by its author or by an admin of
-- a chapter that has explicitly turned blind rankings off.
drop policy if exists "rankings: preferences stay private" on public.rankings;
create policy "rankings: preferences stay private"
  on public.rankings as restrictive for select to authenticated
  using (
    ranker_id = auth.uid() or (
      public.is_group_admin(group_id) and exists (
        select 1 from public.groups g where g.id = group_id and not g.blind_rankings
      )
    )
  );

create or replace function public.get_blind_submission_status(p_group_id uuid, p_cycle_id uuid)
returns table (user_id uuid, role text, name text, email text, submitted boolean)
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_group_admin(p_group_id) then
    raise exception 'Only a chapter admin can view submission status.';
  end if;
  if not exists (select 1 from public.cycles c where c.id = p_cycle_id and c.group_id = p_group_id) then
    raise exception 'This cycle does not belong to your chapter.';
  end if;
  return query
    select m.user_id, m.role::text, p.name::text, p.email::text,
      exists (select 1 from public.rankings r where r.cycle_id = p_cycle_id and r.ranker_id = m.user_id)
    from public.memberships m join public.profiles p on p.id = m.user_id
    where m.group_id = p_group_id and m.status = 'approved' and m.role in ('big', 'little')
    order by m.created_at, m.user_id;
end;
$$;

-- Pure helper: explicit preferences first, then all remaining eligible
-- members in deterministic roster order. It reads no stored data.
create or replace function public.complete_matching_preferences(p_ranked uuid[], p_universe uuid[])
returns uuid[] language sql immutable set search_path = public
as $$
  select coalesce(array_agg(u.id order by
    coalesce(array_position(p_ranked, u.id), cardinality(coalesce(p_ranked, '{}'::uuid[])) + u.position)), '{}'::uuid[])
  from unnest(p_universe) with ordinality as u(id, position);
$$;

create or replace function public.run_blind_matching(p_group_id uuid, p_cycle_id uuid)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  bigs uuid[];
  littles uuid[];
  twins uuid[];
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
    from public.memberships m where m.group_id = p_group_id and m.status = 'approved';
  if cardinality(bigs) = 0 or cardinality(littles) = 0 then
    raise exception 'Approve at least one Big and one Little before running matching.';
  end if;
  select coalesce(jsonb_object_agg(r.ranker_id::text, to_jsonb(r.ranked_ids)), '{}') into rankings_map
    from public.rankings r where r.group_id = p_group_id and r.cycle_id = p_cycle_id;

  foreach little in array littles loop
    select coalesce(array_agg(value::uuid), '{}') into ranked
      from jsonb_array_elements_text(coalesce(rankings_map -> little::text, '[]'));
    little_prefs := jsonb_set(little_prefs, array[little::text], to_jsonb(public.complete_matching_preferences(ranked, bigs)));
    next_proposal := jsonb_set(next_proposal, array[little::text], '1');
  end loop;
  foreach big in array bigs loop
    select coalesce(array_agg(value::uuid), '{}') into ranked
      from jsonb_array_elements_text(coalesce(rankings_map -> big::text, '[]'));
    big_prefs := jsonb_set(big_prefs, array[big::text], to_jsonb(public.complete_matching_preferences(ranked, littles)));
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
    capacity := case when big = any(twins) then 2 else 1 end;
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

revoke all on function public.get_blind_submission_status(uuid, uuid) from public, anon;
revoke all on function public.run_blind_matching(uuid, uuid) from public, anon;
grant execute on function public.get_blind_submission_status(uuid, uuid) to authenticated;
grant execute on function public.run_blind_matching(uuid, uuid) to authenticated;

-- 0016's create_group omitted the independent admin flag. Repair chapter
-- owners affected by that omission, and set it on every new chapter.
update public.memberships m set is_admin = true
  from public.groups g where g.id = m.group_id and g.owner_id = m.user_id
    and m.status = 'approved' and not m.is_admin;

create or replace function public.create_group(p_name text, p_school text, p_join_code text)
returns public.groups
language plpgsql security definer set search_path = public
as $$
declare new_group public.groups; new_cycle public.cycles;
begin
  if auth.uid() is null then raise exception 'Sign in before creating a chapter.'; end if;
  if nullif(trim(p_name), '') is null then raise exception 'Please enter your chapter’s name.'; end if;
  if nullif(trim(p_school), '') is null then raise exception 'Please enter your school.'; end if;
  insert into public.groups (name, school, join_code, created_by, owner_id)
    values (trim(p_name), trim(p_school), p_join_code, auth.uid(), auth.uid()) returning * into new_group;
  insert into public.memberships (group_id, user_id, role, status, is_admin)
    values (new_group.id, auth.uid(), 'admin', 'approved', true);
  insert into public.cycles (group_id, label, created_by)
    values (new_group.id, 'Cycle 1', auth.uid()) returning * into new_cycle;
  update public.groups set active_cycle_id = new_cycle.id where id = new_group.id;
  new_group.active_cycle_id := new_cycle.id;
  return new_group;
end;
$$;
commit;
