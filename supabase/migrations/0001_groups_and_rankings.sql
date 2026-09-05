-- Sorority groups, roles, admin approval, and self-service ranking.
-- Paste this whole file into the Supabase SQL Editor (Project → SQL Editor →
-- New query) and run it once. Safe to re-run: everything is created with
-- IF NOT EXISTS / OR REPLACE.

-- ---------------------------------------------------------------------------
-- profiles: mirrors auth.users so the app can show names/emails to other
-- members without ever querying auth.users directly from the client.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------
-- groups
-- ---------------------------------------------------------------------------
-- NOTE: foreign keys below point at public.profiles (not auth.users)
-- everywhere we'll want Supabase's automatic relationship embedding
-- (e.g. `profile:profiles(email, name)`) to work — PostgREST can only
-- auto-join two tables that reference each other directly, not two tables
-- that separately reference the same third table. profiles.id always
-- equals the corresponding auth.users.id, so this is a purely structural
-- change; every value is still the same auth user id.
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  join_code text not null unique,
  min_big_rankings int not null default 5,
  min_little_rankings int not null default 5,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.groups enable row level security;

-- ---------------------------------------------------------------------------
-- memberships
-- ---------------------------------------------------------------------------
create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('admin', 'big', 'little')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  willing_to_take_twins boolean not null default false,
  requested_role text check (requested_role in ('admin', 'big', 'little')),
  created_at timestamptz not null default now(),
  unique (group_id, user_id)
);

alter table public.memberships enable row level security;

-- ---------------------------------------------------------------------------
-- rankings: one row per person per group, upserted whenever they save.
-- ---------------------------------------------------------------------------
create table if not exists public.rankings (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  ranker_id uuid not null references public.profiles (id) on delete cascade,
  ranked_ids uuid[] not null default '{}',
  updated_at timestamptz not null default now(),
  unique (group_id, ranker_id)
);

alter table public.rankings enable row level security;

-- ---------------------------------------------------------------------------
-- pairings: latest computed result per group. Re-running matching replaces
-- the group's rows.
-- ---------------------------------------------------------------------------
create table if not exists public.pairings (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  big_id uuid not null references public.profiles (id) on delete cascade,
  little_id uuid not null references public.profiles (id) on delete cascade,
  computed_at timestamptz not null default now()
);

alter table public.pairings enable row level security;

-- ---------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER so they can bypass the restrictive base
-- RLS policies below in a controlled way)
-- ---------------------------------------------------------------------------
create or replace function public.is_group_admin(p_group_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.memberships m
    where m.group_id = p_group_id
      and m.user_id = auth.uid()
      and m.role = 'admin'
      and m.status = 'approved'
  );
$$;

create or replace function public.is_approved_group_member(p_group_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.memberships m
    where m.group_id = p_group_id
      and m.user_id = auth.uid()
      and m.status = 'approved'
  );
$$;

create or replace function public.find_group_by_code(p_code text)
returns table (id uuid, name text)
language sql
security definer
stable
set search_path = public
as $$
  select g.id, g.name from public.groups g where g.join_code = p_code;
$$;

create or replace function public.create_group(p_name text, p_join_code text)
returns public.groups
language plpgsql
security definer
set search_path = public
as $$
declare
  new_group public.groups;
begin
  insert into public.groups (name, join_code, created_by)
  values (p_name, p_join_code, auth.uid())
  returning * into new_group;

  insert into public.memberships (group_id, user_id, role, status)
  values (new_group.id, auth.uid(), 'admin', 'approved');

  return new_group;
end;
$$;

-- Narrow, single-purpose function for a Big to self-report twin
-- willingness. Deliberately NOT a general self-UPDATE RLS policy on
-- memberships — that would let a user rewrite their own role/status too
-- (privilege escalation to admin/approved). This only ever touches
-- willing_to_take_twins, and only for the caller's own approved big row.
create or replace function public.set_my_twin_willingness(p_group_id uuid, p_willing boolean)
returns void
language sql
security definer
set search_path = public
as $$
  update public.memberships
  set willing_to_take_twins = p_willing
  where group_id = p_group_id
    and user_id = auth.uid()
    and role = 'big'
    and status = 'approved';
$$;

-- Narrow function for a member to request a role change. Only ever touches
-- requested_role for the caller's own approved row — the actual role change
-- (and clearing requested_role) happens when an admin approves it, via the
-- ordinary admin-update RLS policy on memberships.
create or replace function public.request_role_change(p_group_id uuid, p_requested_role text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.memberships
  set requested_role = p_requested_role
  where group_id = p_group_id
    and user_id = auth.uid()
    and status = 'approved';
$$;

-- ---------------------------------------------------------------------------
-- RLS policies
-- ---------------------------------------------------------------------------

-- profiles
drop policy if exists "profiles: view own" on public.profiles;
create policy "profiles: view own"
  on public.profiles for select
  using (id = auth.uid());

drop policy if exists "profiles: admins view group members" on public.profiles;
create policy "profiles: admins view group members"
  on public.profiles for select
  using (
    exists (
      select 1 from public.memberships m
      where m.user_id = profiles.id
        and public.is_group_admin(m.group_id)
    )
  );

-- Roster visibility: an approved member needs to see the names of other
-- approved members in their group to rank them (not just admins).
drop policy if exists "profiles: group peers view each other" on public.profiles;
create policy "profiles: group peers view each other"
  on public.profiles for select
  using (
    exists (
      select 1 from public.memberships them
      where them.user_id = profiles.id
        and them.status = 'approved'
        and public.is_approved_group_member(them.group_id)
    )
  );

-- groups
drop policy if exists "groups: members view their group" on public.groups;
create policy "groups: members view their group"
  on public.groups for select
  using (
    exists (
      select 1 from public.memberships m
      where m.group_id = groups.id and m.user_id = auth.uid()
    )
  );

drop policy if exists "groups: authenticated users can create" on public.groups;
create policy "groups: authenticated users can create"
  on public.groups for insert
  with check (created_by = auth.uid());

drop policy if exists "groups: admins can update their group" on public.groups;
create policy "groups: admins can update their group"
  on public.groups for update
  using (public.is_group_admin(id));

-- memberships
drop policy if exists "memberships: view own" on public.memberships;
create policy "memberships: view own"
  on public.memberships for select
  using (user_id = auth.uid());

drop policy if exists "memberships: admins view group memberships" on public.memberships;
create policy "memberships: admins view group memberships"
  on public.memberships for select
  using (public.is_group_admin(group_id));

-- Roster visibility: any approved member can see other APPROVED memberships
-- in their group (to build the ranking roster). Pending/rejected rows of
-- other people stay admin-only via the policy above.
drop policy if exists "memberships: peers view approved group members" on public.memberships;
create policy "memberships: peers view approved group members"
  on public.memberships for select
  using (status = 'approved' and public.is_approved_group_member(group_id));

drop policy if exists "memberships: request to join" on public.memberships;
create policy "memberships: request to join"
  on public.memberships for insert
  with check (user_id = auth.uid() and status = 'pending');

drop policy if exists "memberships: admins update group memberships" on public.memberships;
create policy "memberships: admins update group memberships"
  on public.memberships for update
  using (public.is_group_admin(group_id));

-- rankings
drop policy if exists "rankings: view own" on public.rankings;
create policy "rankings: view own"
  on public.rankings for select
  using (ranker_id = auth.uid());

drop policy if exists "rankings: admins view group rankings" on public.rankings;
create policy "rankings: admins view group rankings"
  on public.rankings for select
  using (public.is_group_admin(group_id));

drop policy if exists "rankings: submit own" on public.rankings;
create policy "rankings: submit own"
  on public.rankings for insert
  with check (
    ranker_id = auth.uid()
    and exists (
      select 1 from public.memberships m
      where m.group_id = rankings.group_id
        and m.user_id = auth.uid()
        and m.status = 'approved'
    )
  );

drop policy if exists "rankings: update own" on public.rankings;
create policy "rankings: update own"
  on public.rankings for update
  using (ranker_id = auth.uid());

-- pairings (admin only)
drop policy if exists "pairings: admins view" on public.pairings;
create policy "pairings: admins view"
  on public.pairings for select
  using (public.is_group_admin(group_id));

drop policy if exists "pairings: admins insert" on public.pairings;
create policy "pairings: admins insert"
  on public.pairings for insert
  with check (public.is_group_admin(group_id));

drop policy if exists "pairings: admins delete" on public.pairings;
create policy "pairings: admins delete"
  on public.pairings for delete
  using (public.is_group_admin(group_id));
