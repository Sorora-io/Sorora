-- Adds major, college, year, and hometown to profiles, shown alongside
-- name/bio on the Profile page. Paste into the Supabase SQL Editor and run
-- once. Safe to re-run.

alter table public.profiles add column if not exists major text;
alter table public.profiles add column if not exists college text;
alter table public.profiles add column if not exists year text;
alter table public.profiles add column if not exists hometown text;

-- update_my_profile's argument list is changing, so its old version needs
-- dropping (not just create-or-replace'd) — see 0002 for why.
drop function if exists public.update_my_profile(text, text, text);

create or replace function public.update_my_profile(
  p_name text,
  p_bio text,
  p_avatar_url text,
  p_major text,
  p_college text,
  p_year text,
  p_hometown text
)
returns public.profiles
language sql
security definer
set search_path = public
as $$
  update public.profiles
  set name = p_name,
      bio = p_bio,
      avatar_url = p_avatar_url,
      major = p_major,
      college = p_college,
      year = p_year,
      hometown = p_hometown
  where id = auth.uid()
  returning *;
$$;
