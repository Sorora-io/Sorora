-- Introduces a single "owner" per group, distinct from the (possibly
-- several) equal admins. Every admin can already approve members, edit
-- settings, and run matching — ownership only ever matters for one thing:
-- who's allowed to hand the chapter off to someone else. Paste into the
-- Supabase SQL Editor and run once. Safe to re-run.

alter table public.groups add column if not exists owner_id uuid references public.profiles (id);

-- Backfill: whoever created the group is its owner until transferred.
update public.groups set owner_id = created_by where owner_id is null;

alter table public.groups alter column owner_id set not null;

-- Narrow, single-purpose function (same pattern as set_my_twin_willingness /
-- request_role_change in 0001): only the current owner can call this, and it
-- only ever moves ownership to an existing approved admin of the same group
-- — never to an outsider, and never by anyone but the sitting owner.
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
      and role = 'admin'
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
