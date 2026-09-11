-- Fixes a UX gap found during the RLS audit: a member can request to join
-- (or switch to) the 'admin' role, and an admin can approve that request,
-- but approving only ever set memberships.role — never
-- memberships.is_admin, the flag is_group_admin() (and therefore every
-- RLS policy) actually checks. So someone approved as role='admin' got a
-- nav bar full of admin links that silently failed, with no real admin
-- access, and no error explaining why.
--
-- Fix: approving a join or role-change request that grants role='admin'
-- now also sets is_admin = true, via two new narrow SECURITY DEFINER
-- functions replacing the raw .update() calls lib/groups.ts used to make
-- directly (which — after 0014's column grants — can no longer touch
-- is_admin from the client anyway, by design).

create or replace function public.approve_membership(p_membership_id uuid, p_approve boolean)
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
    raise exception 'Only an admin of this group can approve or reject a request.';
  end if;

  if p_approve then
    update public.memberships
    set status = 'approved',
        is_admin = case when target.role = 'admin' then true else is_admin end
    where id = p_membership_id;
  else
    update public.memberships set status = 'rejected' where id = p_membership_id;
  end if;
end;
$$;

create or replace function public.resolve_role_change(
  p_membership_id uuid,
  p_approve boolean,
  p_requested_role text
)
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
    raise exception 'Only an admin of this group can resolve a role-change request.';
  end if;

  if p_approve then
    update public.memberships
    set role = p_requested_role,
        requested_role = null,
        is_admin = case when p_requested_role = 'admin' then true else is_admin end
    where id = p_membership_id;
  else
    update public.memberships set requested_role = null where id = p_membership_id;
  end if;
end;
$$;
