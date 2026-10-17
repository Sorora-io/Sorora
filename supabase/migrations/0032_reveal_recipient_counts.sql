begin;

-- A consumed schedule is never retried automatically. Persist its failure
-- separately from completion so admins can still see it after reloading.
alter table public.cycles add column if not exists reveal_failure_message text;

-- Returning a new column requires recreating the function's return type.
drop function if exists public.get_pairing_reveal_status(uuid, uuid);
create or replace function public.get_pairing_reveal_status(
  p_group_id uuid,
  p_cycle_id uuid
) returns table (
  total integer,
  sent integer,
  last_sent_at timestamptz,
  scheduled_at timestamptz,
  completed_at timestamptz,
  failure_message text,
  unnotified_bigs integer
) language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_group_admin(p_group_id) then
    raise exception 'Only a chapter admin can view reveal status.';
  end if;
  return query
    select
      (select count(*)::integer from public.pairings p
        where p.group_id = p_group_id and p.cycle_id = p_cycle_id),
      (select count(*)::integer from public.pairings p
        where p.group_id = p_group_id and p.cycle_id = p_cycle_id
          and p.reveal_sent_at is not null),
      (select max(p.reveal_sent_at) from public.pairings p
        where p.group_id = p_group_id and p.cycle_id = p_cycle_id),
      (select c.reveal_scheduled_at from public.cycles c
        where c.id = p_cycle_id and c.group_id = p_group_id),
      (select c.reveal_completed_at from public.cycles c
        where c.id = p_cycle_id and c.group_id = p_group_id),
      (select c.reveal_failure_message from public.cycles c
        where c.id = p_cycle_id and c.group_id = p_group_id),
      (select count(distinct p.big_id)::integer from public.pairings p
        where p.group_id = p_group_id and p.cycle_id = p_cycle_id
          and p.reveal_sent_at is null);
end;
$$;

revoke all on function public.get_pairing_reveal_status(uuid, uuid) from public, anon;
grant execute on function public.get_pairing_reveal_status(uuid, uuid) to authenticated;

commit;
