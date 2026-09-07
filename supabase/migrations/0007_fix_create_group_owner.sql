-- 0006 made groups.owner_id not-null but never updated create_group() to
-- set it, so every new group creation since then has failed with
-- "null value in column owner_id ... violates not-null constraint".
-- Paste into the Supabase SQL Editor and run once. Safe to re-run.

create or replace function public.create_group(p_name text, p_school text, p_join_code text)
returns public.groups
language plpgsql
security definer
set search_path = public
as $$
declare
  new_group public.groups;
begin
  insert into public.groups (name, school, join_code, created_by, owner_id)
  values (p_name, p_school, p_join_code, auth.uid(), auth.uid())
  returning * into new_group;

  insert into public.memberships (group_id, user_id, role, status)
  values (new_group.id, auth.uid(), 'admin', 'approved');

  return new_group;
end;
$$;
