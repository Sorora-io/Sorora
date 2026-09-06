-- Backfills public.profiles for any auth.users created before the
-- on_auth_user_created trigger (0001) existed. Without a profiles row, that
-- user hits "violates foreign key constraint memberships_user_id_fkey" (or
-- groups_created_by_fkey) the first time they try to create/join a group,
-- since those tables reference profiles(id), not auth.users(id) directly.
-- Paste into the Supabase SQL Editor and run once. Safe to re-run.

insert into public.profiles (id, email, name)
select u.id, u.email, u.raw_user_meta_data ->> 'name'
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;
