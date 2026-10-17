begin;
alter table public.groups add column max_littles_per_big integer not null default 3
  check (max_littles_per_big between 1 and 3);

-- Only the checked admin RPC can change the maximum. Serialize with matching,
-- pairing edits and reveal claims using their existing group lock.
create or replace function public.set_max_littles_per_big(p_group_id uuid, p_maximum integer)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.is_group_admin(p_group_id) then
    raise exception 'Only chapter admins can set the maximum Littles per Big.';
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
revoke all on function public.set_max_littles_per_big(uuid,integer) from public,anon;
grant execute on function public.set_max_littles_per_big(uuid,integer) to authenticated;

create or replace function public.set_my_little_preference(p_group_id uuid, p_willing boolean, p_wanted_count integer)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if p_willing is null or (p_wanted_count is not null and p_wanted_count not in (2, 3)) then
    raise exception 'Choose 2 or 3 Littles, or no wanted number.';
  end if;
  perform 1 from public.groups where id=p_group_id for update;
  if coalesce(p_wanted_count,case when p_willing then 2 else 1 end) >
    (select max_littles_per_big from public.groups where id=p_group_id) then
    raise exception 'Your preference exceeds the organization’s maximum Littles per Big.';
  end if;
  update public.memberships set willing_to_take_twins = p_willing, wanted_little_count = p_wanted_count
    where group_id = p_group_id and user_id = auth.uid() and role = 'big' and status = 'approved';
  if not found then raise exception 'Only an approved Big can update this preference.'; end if;
end;
$$;
revoke all on function public.set_my_little_preference(uuid, boolean, integer) from public, anon;
grant execute on function public.set_my_little_preference(uuid, boolean, integer) to authenticated;

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
    from public.memberships m where m.group_id = p_group_id and m.status = 'approved';
  select coalesce(jsonb_object_agg(m.user_id::text, m.wanted_little_count), '{}') into wanted_counts
    from public.memberships m where m.group_id = p_group_id and m.status = 'approved'
      and m.role = 'big' and m.wanted_little_count is not null;
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
create or replace function public.get_pairing_editor(p_group_id uuid, p_cycle_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare c public.cycles; lock_reason text; result jsonb;
begin
 if auth.uid() is null or not public.is_group_admin(p_group_id) then raise exception 'Only chapter admins can view pairing changes.'; end if;
 select * into c from public.cycles where id=p_cycle_id and group_id=p_group_id;
 if not found then raise exception 'Cycle not found in this chapter.'; end if;
 if c.ended_at is not null or not exists(select 1 from public.groups where id=p_group_id and active_cycle_id=p_cycle_id) then
  lock_reason := 'This cycle is closed. Pairings and change history are read-only.';
 elsif c.pairing_edits_locked_at is not null or c.reveal_completed_at is not null or exists(select 1 from public.pairings where cycle_id=p_cycle_id and reveal_sent_at is not null) then
  lock_reason := 'Reveal sending has started. Pairings can no longer be changed.';
 end if;
 select jsonb_build_object(
  'version', public.pairing_version(p_cycle_id), 'lockReason', lock_reason,
  'pairings', coalesce((select jsonb_agg(jsonb_build_object('littleId', p.little_id, 'bigId', p.big_id,
    'littleName', coalesce(l.name, 'Former member'), 'bigName', coalesce(b.name, 'Former member')) order by p.little_id)
    from public.pairings p left join public.profiles l on l.id=p.little_id left join public.profiles b on b.id=p.big_id where p.cycle_id=p_cycle_id), '[]'::jsonb),
  'bigs', coalesce((select jsonb_agg(jsonb_build_object('id',m.user_id,'name',coalesce(p.name,'Unnamed Big'),
    'capacity',least((select max_littles_per_big from public.groups where id=p_group_id),coalesce(m.wanted_little_count,case when m.willing_to_take_twins then 2 else 1 end))) order by p.name,m.user_id)
    from public.memberships m join public.profiles p on p.id=m.user_id where m.group_id=p_group_id and m.role='big' and m.status='approved'), '[]'::jsonb),
  'history', coalesce((select jsonb_agg(to_jsonb(h) order by h.created_at desc,h.id) from public.pairing_change_history h where h.cycle_id=p_cycle_id), '[]'::jsonb)
 ) into result;
 return result;
end;
$$;
revoke all on function public.get_pairing_editor(uuid,uuid) from public,anon;
grant execute on function public.get_pairing_editor(uuid,uuid) to authenticated;

create or replace function public.change_pairing(
 p_group_id uuid, p_cycle_id uuid, p_little_id uuid, p_to_big_id uuid,
 p_swap_little_id uuid, p_expected_version text, p_reason text
) returns void language plpgsql security definer set search_path = '' as $$
declare c public.cycles; from_big uuid; swap_big uuid; target_capacity integer; changes jsonb; actor text;
begin
 if auth.uid() is null or not public.is_group_admin(p_group_id) then raise exception 'Only chapter admins can change pairings.'; end if;
 if p_reason is null or char_length(btrim(p_reason)) not between 1 and 2000 then raise exception 'Enter a reason between 1 and 2,000 characters.'; end if;
 -- Same lock order as matching. Lock the cycle as well to serialize with
 -- closing a cycle and the scheduled sender's pre-delivery claim.
 perform 1 from public.groups where id=p_group_id for update;
 select * into c from public.cycles where id=p_cycle_id and group_id=p_group_id for update;
 if not found or c.ended_at is not null or not exists(select 1 from public.groups where id=p_group_id and active_cycle_id=p_cycle_id) then
  raise exception 'This cycle is closed. Pairings cannot be changed.';
 end if;
 if c.pairing_edits_locked_at is not null or c.reveal_completed_at is not null or exists(select 1 from public.pairings where cycle_id=p_cycle_id and reveal_sent_at is not null) then
  raise exception 'Reveal sending has started. Pairings cannot be changed.';
 end if;
 if p_expected_version is distinct from public.pairing_version(p_cycle_id) then raise exception 'Pairings changed since you opened the editor. Refresh and review them again.'; end if;
 select big_id into from_big from public.pairings where cycle_id=p_cycle_id and little_id=p_little_id;
 if from_big is null or p_to_big_id is null or from_big=p_to_big_id then raise exception 'Choose a different Big for an existing pairing.'; end if;
 -- Lock participant memberships while validating eligibility and capacities.
 perform 1 from public.memberships where group_id=p_group_id and user_id in (from_big,p_to_big_id,p_little_id,p_swap_little_id) order by user_id for update;
 if not exists(select 1 from public.memberships where group_id=p_group_id and user_id=p_little_id and role='little' and status='approved') then raise exception 'The Little is no longer an approved member.'; end if;
 select least((select max_littles_per_big from public.groups where id=p_group_id),coalesce(wanted_little_count,case when willing_to_take_twins then 2 else 1 end)) into target_capacity
 from public.memberships where group_id=p_group_id and user_id=p_to_big_id and role='big' and status='approved';
 if target_capacity is null then raise exception 'Choose an approved Big in this chapter.'; end if;
 if p_swap_little_id is not null then
  select big_id into swap_big from public.pairings where cycle_id=p_cycle_id and little_id=p_swap_little_id;
  if swap_big is distinct from p_to_big_id or p_swap_little_id=p_little_id then raise exception 'Choose a Little currently paired with the destination Big.'; end if;
  if not exists(select 1 from public.memberships where group_id=p_group_id and user_id=p_swap_little_id and role='little' and status='approved') or
     not exists(select 1 from public.memberships where group_id=p_group_id and user_id=from_big and role='big' and status='approved') then raise exception 'Both swapped pairings must have approved members.'; end if;
 elsif (select count(*) from public.pairings where cycle_id=p_cycle_id and big_id=p_to_big_id) >= target_capacity then
  raise exception 'This Big is full. Choose a Little to swap.';
 end if;
 select jsonb_agg(jsonb_build_object('littleId',p.little_id,'littleName',coalesce(l.name,'Unnamed Little'),
   'fromBigId',p.big_id,'fromBigName',coalesce(b.name,'Former member'),
   'toBigId',case when p.little_id=p_little_id then p_to_big_id else from_big end,
   'toBigName',coalesce(t.name,'Unnamed Big')) order by p.little_id) into changes
 from public.pairings p left join public.profiles l on l.id=p.little_id left join public.profiles b on b.id=p.big_id
 left join public.profiles t on t.id=case when p.little_id=p_little_id then p_to_big_id else from_big end
 where p.cycle_id=p_cycle_id and p.little_id in (p_little_id,p_swap_little_id);
 update public.pairings set big_id=case when little_id=p_little_id then p_to_big_id else from_big end
 where cycle_id=p_cycle_id and little_id in (p_little_id,p_swap_little_id);
 -- Capacity may have been reduced after the original matching run.
 if exists(select 1 from public.memberships m where m.group_id=p_group_id and m.user_id in (from_big,p_to_big_id)
  and (select count(*) from public.pairings p where p.cycle_id=p_cycle_id and p.big_id=m.user_id) > least((select max_littles_per_big from public.groups where id=p_group_id),coalesce(m.wanted_little_count,case when m.willing_to_take_twins then 2 else 1 end))) then
  raise exception 'This change would exceed a Big’s current capacity.';
 end if;
 select coalesce(name,'Chapter admin') into actor from public.profiles where id=auth.uid();
 insert into public.pairing_change_history(group_id,cycle_id,actor_id,actor_name,reason,changes)
 values(p_group_id,p_cycle_id,auth.uid(),coalesce(actor,'Chapter admin'),btrim(p_reason),changes);
end;
$$;
revoke all on function public.change_pairing(uuid,uuid,uuid,uuid,uuid,text,text) from public,anon;
grant execute on function public.change_pairing(uuid,uuid,uuid,uuid,uuid,text,text) to authenticated;

commit;
