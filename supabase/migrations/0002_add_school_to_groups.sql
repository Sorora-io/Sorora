-- Adds a separate "school" field to groups (e.g. name="Alpha Beta Chapter",
-- school="NYU"), since the same chapter name can exist at multiple schools.
-- Paste into the Supabase SQL Editor and run once. Safe to re-run.

alter table public.groups
  add column if not exists school text not null default '';

-- create_group and find_group_by_code need their old versions dropped
-- (not just create-or-replace'd) because their argument list / return
-- shape is changing — Postgres treats a different signature as a distinct
-- overload rather than a replacement.
drop function if exists public.create_group(text, text);

create or replace function public.create_group(p_name text, p_school text, p_join_code text)
returns public.groups
language plpgsql
security definer
set search_path = public
as $$
declare
  new_group public.groups;
begin
  insert into public.groups (name, school, join_code, created_by)
  values (p_name, p_school, p_join_code, auth.uid())
  returning * into new_group;

  insert into public.memberships (group_id, user_id, role, status)
  values (new_group.id, auth.uid(), 'admin', 'approved');

  return new_group;
end;
$$;

drop function if exists public.find_group_by_code(text);

create or replace function public.find_group_by_code(p_code text)
returns table (id uuid, name text, school text)
language sql
security definer
stable
set search_path = public
as $$
  select g.id, g.name, g.school from public.groups g where g.join_code = p_code;
$$;
