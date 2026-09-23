create or replace function public.superuser_organizations(p_search text default '', p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not public.is_superuser() then raise exception 'Only a superuser can view organizations.' using errcode = '42501'; end if;
  if p_offset is null or p_offset < 0 then raise exception 'Invalid page offset.'; end if;
  with organizations as (
    select g.id, g.name, g.school, g.join_code, u.email as owner_email,
      (select count(*) from public.memberships m where m.group_id = g.id) as member_count
    from public.groups g left join auth.users u on u.id = g.owner_id
    where g.name ilike '%' || coalesce(p_search, '') || '%' or coalesce(g.school, '') ilike '%' || coalesce(p_search, '') || '%'
  ), page as (select * from organizations order by name, id limit 50 offset p_offset)
  select jsonb_build_object('total', (select count(*) from organizations),
    'organizations', coalesce((select jsonb_agg(to_jsonb(page)) from page), '[]'::jsonb)) into result;
  return result;
end; $$;

