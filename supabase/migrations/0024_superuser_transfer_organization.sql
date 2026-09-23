-- Superusers can reassign an organization's owner.
--
-- The ordinary transfer_group_ownership() (0008) can't serve this case: it
-- requires the CALLER to be the current owner, which is precisely what's
-- missing when a chapter's owner has graduated, lost their account, or
-- never finished setup. It also requires the incoming owner to already be
-- an approved admin — fine for a healthy chapter handing off internally,
-- useless when there is nobody left to do the handing.
--
-- Takes an email rather than a uuid because that's what a superuser has in
-- front of them; resolution happens here so the client never has to look up
-- auth.users (which it can't read anyway).
begin;

create or replace function public.superuser_transfer_organization(
  p_group_id uuid,
  p_new_owner_email text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  target_id uuid;
  target_email text;
  target_name text;
  org_name text;
  previous_email text;
begin
  if not public.is_superuser() then
    raise exception 'Only a superuser can transfer organizations.' using errcode = '42501';
  end if;

  select g.name, u.email into org_name, previous_email
  from public.groups g left join auth.users u on u.id = g.owner_id
  where g.id = p_group_id;
  if org_name is null then
    raise exception 'This organization no longer exists.';
  end if;

  -- Verified email only, matching is_superuser()'s own standard: an
  -- unconfirmed address is not proof anyone controls that inbox.
  select u.id, u.email into target_id, target_email
  from auth.users u
  where lower(u.email) = lower(trim(coalesce(p_new_owner_email, '')))
    and u.email_confirmed_at is not null;
  if target_id is null then
    raise exception 'No account with a verified email matches %.', coalesce(nullif(trim(p_new_owner_email), ''), '(blank)');
  end if;

  if not exists (select 1 from public.profiles p where p.id = target_id) then
    raise exception 'That account has not finished setting up. Ask them to sign in once, then retry.';
  end if;

  select p.name into target_name from public.profiles p where p.id = target_id;

  -- An owner without admin access is a broken state: is_group_admin() is
  -- what actually gates every admin capability, and owner_id alone grants
  -- none of it. So the membership is created or upgraded as part of the
  -- transfer. Someone already ranking as a big/little keeps that role and
  -- simply gains admin alongside it.
  insert into public.memberships (group_id, user_id, role, status, is_admin)
  values (p_group_id, target_id, 'admin', 'approved', true)
  on conflict (group_id, user_id) do update
    set is_admin = true, status = 'approved';

  -- The outgoing owner keeps their membership and admin access, same as the
  -- ordinary transfer does — demoting them is a separate decision.
  update public.groups set owner_id = target_id where id = p_group_id;

  return jsonb_build_object(
    'group_id', p_group_id,
    'group_name', org_name,
    'owner_id', target_id,
    'owner_email', target_email,
    'owner_name', target_name,
    'previous_owner_email', previous_email
  );
end; $$;

revoke all on function public.superuser_transfer_organization(uuid, text) from public, anon;
grant execute on function public.superuser_transfer_organization(uuid, text) to authenticated;

commit;
