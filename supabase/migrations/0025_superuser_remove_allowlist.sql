-- Removes the bootstrap email allowlist from is_superuser().
--
-- 0020 originally hardcoded three addresses so somebody could become the
-- first superuser — grant_superuser() refuses to run unless the caller is
-- already one, so an empty superuser_grants table is otherwise a dead end.
-- A one-off insert from the SQL editor solves that just as well without
-- putting personal emails in a public repo, so the allowlist is retired.
--
-- 0020 in the repo has already been stripped, which covers databases built
-- from scratch. This migration exists for databases where the original 0020
-- was applied: editing a .sql file changes nothing that is already running,
-- so the live function has to be redefined.
--
-- BEFORE RUNNING THIS, seed yourself (SQL editor, as the table owner):
--
--   insert into public.superuser_grants (user_id)
--   select id from auth.users
--   where lower(email) = lower('you@example.com')
--     and email_confirmed_at is not null
--   on conflict (user_id) do nothing;
--
-- The guard below refuses to proceed otherwise, rather than silently
-- leaving an installation with no superuser and no way to make one.
begin;

do $$
begin
  if not exists (select 1 from public.superuser_grants) then
    raise exception using
      errcode = '42501',
      message = 'Refusing to drop the bootstrap allowlist while superuser_grants is empty.',
      hint = 'Seed a superuser first, then re-run: insert into public.superuser_grants (user_id) select id from auth.users where lower(email) = lower(''you@example.com'') and email_confirmed_at is not null on conflict (user_id) do nothing;';
  end if;
end $$;

create or replace function public.is_superuser()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.users u where u.id = auth.uid()
    and u.email_confirmed_at is not null
    and exists (select 1 from public.superuser_grants s where s.user_id = u.id)
  );
$$;

create or replace function public.superuser_accounts(p_search text default '', p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not public.is_superuser() then
    raise exception 'Only a superuser can view all accounts.' using errcode = '42501';
  end if;
  if p_offset is null or p_offset < 0 then raise exception 'Invalid page offset.'; end if;
  with accounts as (
    select u.id, u.email, p.name, u.created_at,
      u.email_confirmed_at is not null as verified,
      u.email_confirmed_at is not null
        and exists (select 1 from public.superuser_grants s where s.user_id = u.id) as is_superuser,
      coalesce((select jsonb_agg(jsonb_build_object(
        'group_id', g.id, 'group_name', g.name, 'school', g.school,
        'role', m.role, 'is_admin', m.is_admin, 'status', m.status,
        'is_owner', g.owner_id = u.id, 'requested_role', m.requested_role
      ) order by g.name) from public.memberships m join public.groups g on g.id = m.group_id
        where m.user_id = u.id), '[]'::jsonb) as memberships
    from auth.users u left join public.profiles p on p.id = u.id
    where coalesce(u.email, '') ilike '%' || coalesce(p_search, '') || '%'
       or coalesce(p.name, '') ilike '%' || coalesce(p_search, '') || '%'
  ), page as (select * from accounts order by created_at desc, id limit 50 offset p_offset)
  select jsonb_build_object('total', (select count(*) from accounts),
    'accounts', coalesce((select jsonb_agg(to_jsonb(page)) from page), '[]'::jsonb)) into result;
  return result;
end;
$$;

commit;
