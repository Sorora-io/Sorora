-- Rush cycles: rankings and pairings currently key off group_id alone
-- (rankings has unique(group_id, ranker_id); pairings is described as
-- "the latest computed result per group — re-running matching replaces
-- the group's rows"). That means a chapter running matching a second
-- time — next semester, next year — silently overwrites this year's
-- rankings and destroys this year's pairing history. There's no concept
-- of "which cycle is this for" at all.
--
-- Fix: a cycles table scoped to group_id, admin-controlled (no hardcoded
-- calendar — a chapter starts a new cycle whenever their own rush
-- timeline says to), and rankings/pairings each gain a cycle_id so a new
-- cycle is a new set of rows, never an overwrite of the last one.
--
-- Paste into the Supabase SQL Editor and run once. Safe to re-run.

create table if not exists public.cycles (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  label text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.cycles enable row level security;

drop policy if exists "cycles: members view their group's cycles" on public.cycles;
create policy "cycles: members view their group's cycles"
  on public.cycles for select
  using (
    exists (
      select 1 from public.memberships m
      where m.group_id = cycles.group_id and m.user_id = auth.uid()
    )
  );

-- No direct insert/update policy for `authenticated` — creating a cycle
-- (and flipping groups.active_cycle_id to point at it) only ever happens
-- together, atomically, via start_cycle() below.

-- Which cycle a new ranking/pairing belongs to, and where the
-- Submit-Ranking / Run-Matching pages point by default.
alter table public.groups add column if not exists active_cycle_id uuid references public.cycles (id);

alter table public.rankings add column if not exists cycle_id uuid references public.cycles (id) on delete cascade;
alter table public.pairings add column if not exists cycle_id uuid references public.cycles (id) on delete cascade;

-- Backfill: every group that predates cycles gets one cycle representing
-- everything that already happened, and becomes its active cycle.
insert into public.cycles (group_id, label, started_at)
select g.id, 'Cycle 1', g.created_at
from public.groups g
where not exists (select 1 from public.cycles c where c.group_id = g.id);

update public.groups g
set active_cycle_id = (
  select c.id from public.cycles c where c.group_id = g.id order by c.started_at asc limit 1
)
where g.active_cycle_id is null;

update public.rankings r
set cycle_id = (select c.id from public.cycles c where c.group_id = r.group_id order by c.started_at asc limit 1)
where r.cycle_id is null;

update public.pairings p
set cycle_id = (select c.id from public.cycles c where c.group_id = p.group_id order by c.started_at asc limit 1)
where p.cycle_id is null;

alter table public.rankings alter column cycle_id set not null;
alter table public.pairings alter column cycle_id set not null;

-- A person gets one ranking row per cycle now, not one ever per group.
alter table public.rankings drop constraint if exists rankings_group_id_ranker_id_key;
alter table public.rankings add constraint rankings_cycle_id_ranker_id_key unique (cycle_id, ranker_id);

-- group_id stays on both tables (simpler queries, and every existing RLS
-- policy already keys off it) but is now redundant with cycle_id ->
-- cycles.group_id — a trigger keeps the two from ever disagreeing, since
-- nothing else enforces that a client-supplied cycle_id actually belongs
-- to the client-supplied group_id.
create or replace function public.check_cycle_group_match()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.cycles c where c.id = new.cycle_id and c.group_id = new.group_id
  ) then
    raise exception 'cycle_id does not belong to group_id';
  end if;
  return new;
end;
$$;

drop trigger if exists rankings_cycle_group_match on public.rankings;
create trigger rankings_cycle_group_match
  before insert or update on public.rankings
  for each row execute procedure public.check_cycle_group_match();

drop trigger if exists pairings_cycle_group_match on public.pairings;
create trigger pairings_cycle_group_match
  before insert or update on public.pairings
  for each row execute procedure public.check_cycle_group_match();

-- create_group (0007) never created a cycle, so a brand-new group would
-- have active_cycle_id = null and nowhere for its first rankings to go
-- until an admin manually "started a cycle" — an extra step nobody
-- signing up for the first time would know to take. Every group now gets
-- an initial cycle for free at creation; start_cycle() stays how you move
-- to the NEXT one when your chapter's own rush timeline calls for it.
create or replace function public.create_group(p_name text, p_school text, p_join_code text)
returns public.groups
language plpgsql
security definer
set search_path = public
as $$
declare
  new_group public.groups;
  new_cycle public.cycles;
begin
  insert into public.groups (name, school, join_code, created_by, owner_id)
  values (p_name, p_school, p_join_code, auth.uid(), auth.uid())
  returning * into new_group;

  insert into public.memberships (group_id, user_id, role, status)
  values (new_group.id, auth.uid(), 'admin', 'approved');

  insert into public.cycles (group_id, label, created_by)
  values (new_group.id, 'Cycle 1', auth.uid())
  returning * into new_cycle;

  update public.groups set active_cycle_id = new_cycle.id where id = new_group.id;
  new_group.active_cycle_id := new_cycle.id;

  return new_group;
end;
$$;

-- Narrow, single-purpose function (same pattern as set_member_admin /
-- remove_member): only a group admin can start a new cycle. Closes
-- whatever cycle was active (so its end date is on record), creates the
-- new one, and points the group at it — all three happen together or not
-- at all. Doesn't touch memberships (chapter membership is persistent
-- across cycles) or delete anything from past cycles.
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

  update public.cycles set ended_at = now()
  where group_id = p_group_id and ended_at is null;

  insert into public.cycles (group_id, label, created_by)
  values (p_group_id, trim(p_label), auth.uid())
  returning * into new_cycle;

  update public.groups set active_cycle_id = new_cycle.id where id = p_group_id;

  return new_cycle;
end;
$$;

-- remove_member (0012) used to delete this group's rankings/pairings for
-- the removed member too — which destroyed cycle history the moment
-- someone graduated or left, the opposite of what cycles are for. Past
-- pairings/rankings now survive removal; only this chapter's private
-- notes about them (not part of the official matching record) and their
-- membership row still go. Also scrubs their optional profile fields
-- (bio/avatar/major/college/year/hometown), keeping just name and email —
-- but ONLY if this was their last remaining chapter, since profiles are
-- one row per person shared across every chapter they're in, not
-- per-membership; scrubbing it while they're still active somewhere else
-- would blank their profile there too.
create or replace function public.remove_member(p_membership_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.memberships;
begin
  select * into target from public.memberships where id = p_membership_id;
  if target is null then
    raise exception 'Membership not found.';
  end if;

  if not public.is_group_admin(target.group_id) then
    raise exception 'Only an admin of this group can remove a member.';
  end if;

  if exists (
    select 1 from public.groups where id = target.group_id and owner_id = target.user_id
  ) then
    raise exception 'The group owner can''t be removed this way — transfer ownership first.';
  end if;

  delete from public.notes where group_id = target.group_id and (author_id = target.user_id or subject_id = target.user_id);
  delete from public.memberships where id = p_membership_id;

  if not exists (select 1 from public.memberships where user_id = target.user_id and status = 'approved') then
    update public.profiles
    set bio = null, avatar_url = null, major = null, college = null, year = null, hometown = null
    where id = target.user_id;
  end if;
end;
$$;
