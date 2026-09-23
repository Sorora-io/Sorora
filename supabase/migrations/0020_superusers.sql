-- Platform access is separate from chapter roles. Never trust profile email or
-- user-editable metadata for authorization. Seed access requires verified email.
create table if not exists public.superuser_grants (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now()
);
alter table public.superuser_grants enable row level security;
revoke all on public.superuser_grants from public, anon, authenticated;

-- Access comes from superuser_grants only — no email allowlist. The first
-- superuser is seeded out of band with a direct insert from the SQL editor,
-- where you are connected as the table owner and RLS does not apply:
--
--   insert into public.superuser_grants (user_id)
--   select id from auth.users
--   where lower(email) = lower('you@example.com')
--     and email_confirmed_at is not null
--   on conflict (user_id) do nothing;
--
-- After that, grant_superuser() promotes everyone else. Keeping addresses
-- out of the function body keeps personal emails out of a public repo.
create or replace function public.is_superuser()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.users u where u.id = auth.uid()
    and u.email_confirmed_at is not null
    and exists (select 1 from public.superuser_grants s where s.user_id = u.id)
  );
$$;

create or replace function public.grant_superuser(p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_superuser() then
    raise exception 'Only a superuser can promote accounts.' using errcode = '42501';
  end if;
  if not exists (select 1 from auth.users where id = p_user_id and email_confirmed_at is not null) then
    raise exception 'Choose an existing account with a verified email.';
  end if;
  insert into public.superuser_grants(user_id, granted_by)
  values (p_user_id, auth.uid()) on conflict (user_id) do nothing;
end;
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

revoke all on function public.is_superuser() from public, anon;
revoke all on function public.grant_superuser(uuid) from public, anon;
revoke all on function public.superuser_accounts(text, integer) from public, anon;
grant execute on function public.is_superuser() to authenticated;
grant execute on function public.grant_superuser(uuid) to authenticated;
grant execute on function public.superuser_accounts(text, integer) to authenticated;
