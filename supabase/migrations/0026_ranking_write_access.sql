begin;

-- Historical rankings remain readable by their author, but only current
-- approved Bigs/Littles may write to their chapter's active, open cycle.
create or replace function public.can_edit_ranking(p_group_id uuid, p_cycle_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    join public.groups g on g.id = m.group_id
    join public.cycles c on c.id = g.active_cycle_id and c.group_id = g.id
    where m.group_id = p_group_id and m.user_id = auth.uid()
      and m.status = 'approved' and m.role in ('big', 'little')
      and c.id = p_cycle_id and c.ended_at is null
  );
$$;
revoke all on function public.can_edit_ranking(uuid, uuid) from public, anon;
grant execute on function public.can_edit_ranking(uuid, uuid) to authenticated;

drop policy if exists "rankings: submit own" on public.rankings;
create policy "rankings: submit own" on public.rankings for insert to authenticated
  with check (ranker_id = auth.uid() and public.can_edit_ranking(group_id, cycle_id));

drop policy if exists "rankings: update own" on public.rankings;
create policy "rankings: update own" on public.rankings for update to authenticated
  using (ranker_id = auth.uid() and public.can_edit_ranking(group_id, cycle_id))
  with check (ranker_id = auth.uid() and public.can_edit_ranking(group_id, cycle_id));

commit;
