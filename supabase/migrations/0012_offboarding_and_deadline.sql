-- Two independent additions. Paste into the Supabase SQL Editor and run
-- once. Safe to re-run.

-- 1) A ranking deadline admins can set per chapter, shown to Bigs/Littles
--    on the Dashboard (and used to flag "overdue" there).
alter table public.groups add column if not exists ranking_deadline date;

-- 2) Offboarding: lets an admin remove an approved member from their
-- chapter (they graduated, left, etc.) without touching the member's
-- Sorora account itself — only their membership and this group's data
-- about them. Narrow, security definer, same shape as set_member_admin:
-- only a group admin can call it, and the group's owner can't be removed
-- this way (transfer ownership first, same rule as account deletion).
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

  -- Clean up this chapter's data about them so removal doesn't leave
  -- dangling rankings/pairings/notes pointing at someone no longer in it.
  delete from public.rankings where group_id = target.group_id and ranker_id = target.user_id;
  delete from public.pairings where group_id = target.group_id and (big_id = target.user_id or little_id = target.user_id);
  delete from public.notes where group_id = target.group_id and (author_id = target.user_id or subject_id = target.user_id);
  delete from public.memberships where id = p_membership_id;
end;
$$;
