-- Lets a member be both a Big/Little AND an admin at once. Admin access
-- becomes its own flag (is_admin) instead of a role you occupy instead of
-- big/little — role keeps meaning "which side of matching you're on" (or
-- 'admin' for the legacy admin-only membership, still supported), is_admin
-- means "can also approve/settings/pairings/etc regardless of role."
-- Paste into the Supabase SQL Editor and run once. Safe to re-run.

alter table public.memberships add column if not exists is_admin boolean not null default false;

-- Backfill: every existing role='admin' membership already has admin
-- powers, so carry that forward as the flag.
update public.memberships set is_admin = true where role = 'admin' and not is_admin;

-- is_group_admin now checks the flag (which every legacy admin has, per the
-- backfill above) instead of role = 'admin', so a big/little who's been
-- granted admin access passes exactly like a pure admin does.
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
      and m.is_admin = true
      and m.status = 'approved'
  );
$$;

-- Narrow, single-purpose function (same pattern as set_my_twin_willingness):
-- only an existing group admin can grant/revoke admin access on another
-- member of the SAME group, and the group's owner can never be stripped of
-- admin access this way (they'd have to transfer ownership first).
create or replace function public.set_member_admin(p_membership_id uuid, p_is_admin boolean)
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
    raise exception 'Only an admin of this group can change admin access.';
  end if;

  if not p_is_admin and exists (
    select 1 from public.groups where id = target.group_id and owner_id = target.user_id
  ) then
    raise exception 'The group owner must always have admin access — transfer ownership first.';
  end if;

  update public.memberships set is_admin = p_is_admin where id = p_membership_id;
end;
$$;

-- transfer_group_ownership (0006) checked role = 'admin' for the incoming
-- owner — a dual-role big/little-plus-admin should be just as eligible, so
-- this now checks the is_admin flag instead.
create or replace function public.transfer_group_ownership(p_group_id uuid, p_new_owner_id uuid)
returns public.groups
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_group public.groups;
begin
  if not exists (
    select 1 from public.groups
    where id = p_group_id and owner_id = auth.uid()
  ) then
    raise exception 'Only the current owner can transfer ownership.';
  end if;

  if not exists (
    select 1 from public.memberships
    where group_id = p_group_id
      and user_id = p_new_owner_id
      and is_admin = true
      and status = 'approved'
  ) then
    raise exception 'The new owner must already be an approved admin of this group.';
  end if;

  update public.groups
  set owner_id = p_new_owner_id
  where id = p_group_id
  returning * into updated_group;

  return updated_group;
end;
$$;
