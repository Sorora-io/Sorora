-- Adds an avatar and bio to profiles, plus a storage bucket for avatar
-- uploads. Paste into the Supabase SQL Editor and run once. Safe to re-run.

alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists avatar_url text;

-- Narrow, single-purpose function so users can only ever touch their own
-- name/bio/avatar_url — not email or id — following the same pattern as
-- set_my_twin_willingness / request_role_change in 0001.
create or replace function public.update_my_profile(p_name text, p_bio text, p_avatar_url text)
returns public.profiles
language sql
security definer
set search_path = public
as $$
  update public.profiles
  set name = p_name, bio = p_bio, avatar_url = p_avatar_url
  where id = auth.uid()
  returning *;
$$;

-- ---------------------------------------------------------------------------
-- avatars storage bucket: public read (so avatar images can be shown to
-- other group members without a signed URL), writes restricted to a user's
-- own folder (avatars/<user id>/...).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatars: public read" on storage.objects;
create policy "avatars: public read"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "avatars: users upload own" on storage.objects;
create policy "avatars: users upload own"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars: users update own" on storage.objects;
create policy "avatars: users update own"
  on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars: users delete own" on storage.objects;
create policy "avatars: users delete own"
  on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
