begin;
create table if not exists public.cycle_exclusions (
 group_id uuid not null references public.groups(id) on delete cascade,
 cycle_id uuid not null references public.cycles(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 excluded boolean not null default true,
 changed_by uuid references public.profiles(id), changed_at timestamptz not null default now(),
 primary key(cycle_id,user_id)
);
alter table public.cycle_exclusions enable row level security;
revoke all on public.cycle_exclusions from public,anon,authenticated;
grant select on public.cycle_exclusions to authenticated;
create policy "admin or own exclusion" on public.cycle_exclusions for select to authenticated
using(user_id=auth.uid() or public.is_group_admin(group_id));
create table public.cycle_participation_history (
 id uuid primary key default gen_random_uuid(), group_id uuid not null references public.groups(id) on delete cascade,
 cycle_id uuid not null references public.cycles(id) on delete cascade,user_id uuid not null references public.profiles(id),
 excluded boolean not null,actor_id uuid references public.profiles(id),created_at timestamptz not null default now(),removed_pairings jsonb not null
);
alter table public.cycle_participation_history enable row level security;
revoke all on public.cycle_participation_history from public,anon,authenticated;
grant select on public.cycle_participation_history to authenticated;
create policy "admins read participation history" on public.cycle_participation_history for select to authenticated using(public.is_group_admin(group_id));
create or replace function public.cycle_memberships(p_group_id uuid,p_cycle_id uuid)
returns setof public.memberships language sql stable security definer set search_path='' as $$
 select m.* from public.memberships m where m.group_id=p_group_id and not exists(
 select 1 from public.cycle_exclusions e where e.group_id=p_group_id and e.cycle_id=p_cycle_id and e.user_id=m.user_id and e.excluded)
$$;
revoke all on function public.cycle_memberships(uuid,uuid) from public,anon,authenticated;
create or replace function public.get_cycle_participation(p_group_id uuid,p_cycle_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.memberships membership where membership.group_id=p_group_id and membership.user_id=auth.uid() and membership.status='approved') then raise exception 'Chapter membership required.'; end if;
 if not exists(select 1 from public.cycles where id=p_cycle_id and group_id=p_group_id) then raise exception 'Cycle not found.'; end if;
 return jsonb_build_object('excludedIds',coalesce((select jsonb_agg(user_id) from public.cycle_exclusions where group_id=p_group_id and cycle_id=p_cycle_id and excluded and (public.is_group_admin(p_group_id) or user_id=auth.uid())),'[]'::jsonb),
 'version',public.pairing_version(p_cycle_id),
 'history',case when public.is_group_admin(p_group_id) then coalesce((select jsonb_agg(jsonb_build_object('userId',h.user_id,'excluded',h.excluded,'actor',coalesce(p.name,'Chapter admin'),'at',h.created_at) order by h.created_at desc) from public.cycle_participation_history h left join public.profiles p on p.id=h.actor_id where h.cycle_id=p_cycle_id and h.group_id=p_group_id),'[]'::jsonb) else '[]'::jsonb end,
 'locked',exists(select 1 from public.cycles where id=p_cycle_id and (ended_at is not null or pairing_edits_locked_at is not null or reveal_completed_at is not null)) or exists(select 1 from public.pairings where cycle_id=p_cycle_id and reveal_sent_at is not null),
 'pairings',case when public.is_group_admin(p_group_id) then coalesce((select jsonb_agg(jsonb_build_object('bigId',big_id,'littleId',little_id)) from public.pairings where cycle_id=p_cycle_id),'[]'::jsonb) else '[]'::jsonb end);
end;$$;
revoke all on function public.get_cycle_participation(uuid,uuid) from public,anon;
grant execute on function public.get_cycle_participation(uuid,uuid) to authenticated;
create or replace function public.set_cycle_participation(p_group_id uuid,p_cycle_id uuid,p_user_id uuid,p_excluded boolean,p_remove_pairings boolean default false,p_expected_version text default null)
returns void language plpgsql security definer set search_path='' as $$
declare c public.cycles; affected jsonb;
begin
 if auth.uid() is null or not public.is_group_admin(p_group_id) then raise exception 'Only chapter admins can change cycle participation.'; end if;
 if p_excluded is null then raise exception 'Choose exclude or restore.'; end if;
 perform 1 from public.groups where id=p_group_id for update;
 select * into c from public.cycles where id=p_cycle_id and group_id=p_group_id for update;
 if not found or c.ended_at is not null or not exists(select 1 from public.groups where id=p_group_id and active_cycle_id=p_cycle_id) then raise exception 'Only the active open cycle can be changed.'; end if;
 if c.pairing_edits_locked_at is not null or c.reveal_completed_at is not null or exists(select 1 from public.pairings where cycle_id=p_cycle_id and reveal_sent_at is not null) then raise exception 'Reveal sending has started. Participation is locked.'; end if;
 if not exists(select 1 from public.memberships where group_id=p_group_id and user_id=p_user_id and status='approved' and role in ('big','little')) then raise exception 'Choose an approved Big or Little.'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('bigId',big_id,'littleId',little_id)),'[]'::jsonb) into affected from public.pairings where cycle_id=p_cycle_id and (big_id=p_user_id or little_id=p_user_id);
 if p_excluded and jsonb_array_length(affected)>0 and p_remove_pairings and p_expected_version is distinct from public.pairing_version(p_cycle_id) then raise exception 'Pairings changed. Reload and review affected pairings again.'; end if;
 if p_excluded and jsonb_array_length(affected)>0 and not p_remove_pairings then raise exception 'This member is paired. Review and confirm removal of affected pairings.'; end if;
 if p_excluded then delete from public.pairings where cycle_id=p_cycle_id and (big_id=p_user_id or little_id=p_user_id); end if;
 insert into public.cycle_exclusions(group_id,cycle_id,user_id,excluded,changed_by) values(p_group_id,p_cycle_id,p_user_id,p_excluded,auth.uid())
 on conflict(cycle_id,user_id) do update set excluded=p_excluded,changed_by=auth.uid(),changed_at=now();
 insert into public.cycle_participation_history(group_id,cycle_id,user_id,excluded,actor_id,removed_pairings)
 values(p_group_id,p_cycle_id,p_user_id,p_excluded,auth.uid(),case when p_excluded then affected else '[]'::jsonb end);
end;$$;
revoke all on function public.set_cycle_participation(uuid,uuid,uuid,boolean,boolean,text) from public,anon;
grant execute on function public.set_cycle_participation(uuid,uuid,uuid,boolean,boolean,text) to authenticated;
create or replace function public.guard_cycle_participant() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.groups where id=new.group_id for update;
 if exists(select 1 from public.cycle_exclusions e where e.cycle_id=new.cycle_id and e.group_id=new.group_id and e.excluded and
 (case when tg_table_name='rankings' then e.user_id=(to_jsonb(new)->>'ranker_id')::uuid else e.user_id in ((to_jsonb(new)->>'big_id')::uuid,(to_jsonb(new)->>'little_id')::uuid) end)) then raise exception 'This member is not participating in this cycle.'; end if;
 return new;
end;$$;
create trigger rankings_cycle_participant before insert or update on public.rankings for each row execute function public.guard_cycle_participant();
create trigger pairings_cycle_participant before insert or update on public.pairings for each row execute function public.guard_cycle_participant();

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
    from public.cycle_memberships(p_group_id,p_cycle_id) m join public.profiles p on p.id = m.user_id
    where m.group_id = p_group_id and m.status = 'approved' and m.role in ('big', 'little')
    order by m.created_at, m.user_id;
end;
$$;

create or replace function public.can_edit_ranking(p_group_id uuid, p_cycle_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.cycle_memberships(p_group_id,p_cycle_id) m
    join public.groups g on g.id = m.group_id
    join public.cycles c on c.id = g.active_cycle_id and c.group_id = g.id
    where m.group_id = p_group_id and m.user_id = auth.uid()
      and m.status = 'approved' and m.role in ('big', 'little')
      and c.id = p_cycle_id and c.ended_at is null
      and (g.ranking_deadline is null or
        statement_timestamp() < ((g.ranking_deadline + 1)::timestamp at time zone 'UTC'))
  );
$$;

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
    from public.cycle_memberships(p_group_id,p_cycle_id) m join public.profiles p on p.id=m.user_id where m.group_id=p_group_id and m.role='big' and m.status='approved'), '[]'::jsonb),
  'history', coalesce((select jsonb_agg(to_jsonb(h) order by h.created_at desc,h.id) from public.pairing_change_history h where h.cycle_id=p_cycle_id), '[]'::jsonb)
 ) into result;
 return result;
end;
$$;

create or replace function public.export_chapter_rankings(p_group_id uuid, p_cycle_id uuid, p_include_preferences boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if auth.uid() is null or not public.is_group_admin(p_group_id) then
    raise exception 'Only a chapter admin can export submissions.';
  end if;
  if not exists (select 1 from public.cycles where id = p_cycle_id and group_id = p_group_id) then
    raise exception 'This cycle does not belong to your chapter.';
  end if;
  -- Keep the privacy setting stable until this export finishes.
  perform 1 from public.groups where id = p_group_id for share;
  if p_include_preferences and not exists (select 1 from public.groups where id = p_group_id and blind_rankings = false) then
    raise exception 'Blind rankings are on. Turn them off in Organization settings before exporting preferences.';
  end if;
  select jsonb_build_object(
    'chapter', g.name, 'cycle', c.label, 'cycleId', c.id,
    'members', coalesce((select jsonb_agg(jsonb_build_object(
      'userId', m.user_id, 'name', p.name, 'email', p.email, 'role', m.role,
      'submitted', r.ranker_id is not null,
      'updatedAt', r.updated_at,
      'preferences', case when p_include_preferences then coalesce((
        select jsonb_agg(jsonb_build_object('rank', pref.position, 'userId', pref.id,
          'name', target.name, 'email', target.email) order by pref.position)
        from unnest(r.ranked_ids) with ordinality pref(id, position)
        left join public.profiles target on target.id = pref.id
        -- Only resolve identities belonging to this chapter.
          and exists (select 1 from public.cycle_memberships(p_group_id,p_cycle_id) tm where tm.group_id = p_group_id and tm.user_id = pref.id)
      ), '[]'::jsonb) else null end
    ) order by m.role, lower(coalesce(p.name, p.email)), m.user_id)
    from public.cycle_memberships(p_group_id,p_cycle_id) m join public.profiles p on p.id = m.user_id
    left join public.rankings r on r.group_id = p_group_id and r.cycle_id = p_cycle_id and r.ranker_id = m.user_id
    where m.group_id = p_group_id and m.status = 'approved' and m.role in ('big', 'little')), '[]'::jsonb)
  ) into result from public.groups g join public.cycles c on c.group_id = g.id
    where g.id = p_group_id and c.id = p_cycle_id;
  return result;
end;
$$;

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
create or replace function public.get_cycle_roster(p_group_id uuid,p_role text)
returns table(user_id uuid,name text,email text,avatar_url text)
language plpgsql security definer set search_path='' as $$
declare active uuid;
begin
 if auth.uid() is null or not exists(select 1 from public.memberships membership where membership.group_id=p_group_id and membership.user_id=auth.uid() and membership.status='approved') then raise exception 'Chapter membership required.'; end if;
 select active_cycle_id into active from public.groups where id=p_group_id;
 return query select m.user_id,p.name::text,p.email::text,p.avatar_url::text from public.cycle_memberships(p_group_id,active) m join public.profiles p on p.id=m.user_id where active is not null and m.status='approved' and m.role::text=p_role;
end;$$;
revoke all on function public.get_cycle_roster(uuid,text) from public,anon;
grant execute on function public.get_cycle_roster(uuid,text) to authenticated;
grant select on public.cycle_exclusions to service_role;
commit;
