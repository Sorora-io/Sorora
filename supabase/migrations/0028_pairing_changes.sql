begin;

-- A permanent latch, set BEFORE reading matches for email delivery. It is
-- independent of scheduling fields, which admins may cancel or reschedule.
alter table public.cycles add column if not exists pairing_edits_locked_at timestamptz;
update public.cycles c set pairing_edits_locked_at = coalesce(c.reveal_completed_at, now())
where c.pairing_edits_locked_at is null and (c.reveal_completed_at is not null or exists (
  select 1 from public.pairings p where p.cycle_id = c.id and p.reveal_sent_at is not null
));

create table if not exists public.pairing_change_history (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  cycle_id uuid not null references public.cycles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  actor_name text not null,
  reason text not null check (char_length(btrim(reason)) between 1 and 2000),
  changes jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.pairing_change_history enable row level security;
revoke all on public.pairing_change_history from public, anon, authenticated;
grant select on public.pairing_change_history to authenticated;
drop policy if exists "admins read pairing history" on public.pairing_change_history;
create policy "admins read pairing history" on public.pairing_change_history for select to authenticated
using (public.is_group_admin(group_id));
create index if not exists pairing_history_cycle on public.pairing_change_history(cycle_id, created_at);

-- Include IDs and computed_at so regenerating an identical set of pairs still
-- invalidates any editor opened against the previous matching run.
create or replace function public.pairing_version(p_cycle_id uuid) returns text
language sql stable security definer set search_path = '' as $$
 select md5(coalesce(jsonb_agg(to_jsonb(p) order by p.id)::text, '[]'))
 from public.pairings p where p.cycle_id = p_cycle_id;
$$;
revoke all on function public.pairing_version(uuid) from public, anon, authenticated;

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
    'capacity',coalesce(m.wanted_little_count,case when m.willing_to_take_twins then 2 else 1 end)) order by p.name,m.user_id)
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
 select coalesce(wanted_little_count,case when willing_to_take_twins then 2 else 1 end) into target_capacity
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
  and (select count(*) from public.pairings p where p.cycle_id=p_cycle_id and p.big_id=m.user_id) > coalesce(m.wanted_little_count,case when m.willing_to_take_twins then 2 else 1 end)) then
  raise exception 'This change would exceed a Big’s current capacity.';
 end if;
 select coalesce(name,'Chapter admin') into actor from public.profiles where id=auth.uid();
 insert into public.pairing_change_history(group_id,cycle_id,actor_id,actor_name,reason,changes)
 values(p_group_id,p_cycle_id,auth.uid(),coalesce(actor,'Chapter admin'),btrim(p_reason),changes);
end;
$$;
revoke all on function public.change_pairing(uuid,uuid,uuid,uuid,uuid,text,text) from public,anon;
grant execute on function public.change_pairing(uuid,uuid,uuid,uuid,uuid,text,text) to authenticated;
-- All member writes must go through the checked, audited RPC.
revoke insert, update, delete on public.pairings from authenticated, anon;

create or replace function public.lock_pairings_for_reveal(p_group_id uuid,p_cycle_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
 perform 1 from public.groups where id=p_group_id for update;
 update public.cycles set pairing_edits_locked_at=coalesce(pairing_edits_locked_at,now()) where id=p_cycle_id and group_id=p_group_id;
 if not found then raise exception 'Cycle not found in this chapter.'; end if;
end;
$$;
revoke all on function public.lock_pairings_for_reveal(uuid,uuid) from public,anon,authenticated;
grant execute on function public.lock_pairings_for_reveal(uuid,uuid) to service_role;

-- Prevent a later matching run from erasing revealed or manually reviewed
-- assignments. Keep the existing algorithm unchanged behind this guard.
do $$ begin
 if to_regprocedure('public.run_blind_matching_unreviewed(uuid,uuid)') is null then
  alter function public.run_blind_matching(uuid,uuid) rename to run_blind_matching_unreviewed;
 end if;
end $$;
revoke all on function public.run_blind_matching_unreviewed(uuid,uuid) from public,anon,authenticated;
create or replace function public.run_blind_matching(p_group_id uuid,p_cycle_id uuid) returns integer
language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null or not public.is_group_admin(p_group_id) then raise exception 'Only a chapter admin can run matching.'; end if;
 perform 1 from public.groups where id=p_group_id for update;
 perform 1 from public.cycles where id=p_cycle_id and group_id=p_group_id for update;
 if exists(select 1 from public.cycles where id=p_cycle_id and (pairing_edits_locked_at is not null or reveal_completed_at is not null)) or
 exists(select 1 from public.pairings where cycle_id=p_cycle_id and reveal_sent_at is not null) then raise exception 'Reveal sending has started. Matching cannot be rerun.'; end if;
 if exists(select 1 from public.pairing_change_history where cycle_id=p_cycle_id) then raise exception 'This cycle has reviewed pairing changes. Use Edit pairings to preserve those changes.'; end if;
 return public.run_blind_matching_unreviewed(p_group_id,p_cycle_id);
end;
$$;
revoke all on function public.run_blind_matching(uuid,uuid) from public,anon;
grant execute on function public.run_blind_matching(uuid,uuid) to authenticated;
create or replace function public.start_cycle(p_group_id uuid, p_label text)
returns public.cycles
language plpgsql
security definer
set search_path = public
as $$
declare
  new_cycle public.cycles;
begin
  if not public.is_group_admin(p_group_id) then
    raise exception 'Only an admin of this group can start a new cycle.';
  end if;

  if p_label is null or length(trim(p_label)) = 0 then
    raise exception 'Give the new cycle a name.';
  end if;

  -- Match the editor/reveal lock order before closing the active cycle.
  perform 1 from public.groups where id = p_group_id for update;

  update public.cycles set ended_at = now()
  where group_id = p_group_id and ended_at is null;

  insert into public.cycles (group_id, label, created_by)
  values (p_group_id, trim(p_label), auth.uid())
  returning * into new_cycle;

  update public.groups set active_cycle_id = new_cycle.id where id = p_group_id;

  return new_cycle;
end;
$$;

commit;
