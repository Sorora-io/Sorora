begin;
-- Date-only deadlines include the whole selected UTC day. Server time is
-- authoritative; browser clocks and direct API calls cannot bypass the cutoff.
create or replace function public.can_edit_ranking(p_group_id uuid, p_cycle_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    join public.groups g on g.id = m.group_id
    join public.cycles c on c.id = g.active_cycle_id and c.group_id = g.id
    where m.group_id = p_group_id and m.user_id = auth.uid()
      and m.status = 'approved' and m.role in ('big', 'little')
      and c.id = p_cycle_id and c.ended_at is null
      and (g.ranking_deadline is null or
        statement_timestamp() < ((g.ranking_deadline + 1)::timestamp at time zone 'UTC'))
  );
$$;
revoke all on function public.can_edit_ranking(uuid, uuid) from public, anon;
grant execute on function public.can_edit_ranking(uuid, uuid) to authenticated;
commit;
