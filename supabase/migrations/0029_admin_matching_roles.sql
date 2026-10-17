begin;

-- Preserve legacy admin-only access as well as the explicit admin flag.
create or replace function public.is_group_admin(p_group_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.memberships
    where group_id = p_group_id and user_id = auth.uid()
      and status = 'approved' and (is_admin or role = 'admin'));
$$;

-- Applies to every write path, including grants and approved role requests.
-- Existing memberships are not silently reassigned by this migration.
create or replace function public.check_admin_matching_role()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.role = 'little' and new.is_admin then
    raise exception 'Chapter admins cannot be Littles.';
  end if;
  if (new.is_admin or new.role = 'admin') and new.requested_role = 'little' then
    raise exception 'Chapter admins cannot request the Little role.';
  end if;
  return new;
end;
$$;
drop trigger if exists memberships_admin_matching_role on public.memberships;
create trigger memberships_admin_matching_role
before insert or update of role, is_admin, requested_role on public.memberships
for each row execute function public.check_admin_matching_role();

create or replace function public.set_my_admin_matching_role(p_group_id uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
declare target public.memberships;
begin
  if p_role is null or p_role not in ('big', 'admin') then
    raise exception 'Choose Big or admin-only, not Little.';
  end if;
  select * into target from public.memberships
    where group_id = p_group_id and user_id = auth.uid() for update;
  if target.id is null or target.status <> 'approved'
    or not (target.is_admin or target.role = 'admin') then
    raise exception 'Only an approved chapter admin can change their matching role.';
  end if;
  update public.memberships set role = p_role, is_admin = true, requested_role = null
    where id = target.id;
end;
$$;
revoke all on function public.set_my_admin_matching_role(uuid, text) from public, anon;
grant execute on function public.set_my_admin_matching_role(uuid, text) to authenticated;
commit;
