-- Repair installations missing the privacy setting from migration 0017.
-- Preserve existing values and newer matching functions from migration 0028.
begin;

alter table public.groups add column if not exists blind_rankings boolean not null default true;
-- 0014 grants group updates column-by-column; the new toggle belongs there
-- alongside the existing name/school/description/deadline/min-ranking fields
-- so an admin can flip it with a plain client .update({blind_rankings}).
grant update (blind_rankings) on public.groups to authenticated;

drop policy if exists "rankings: admins view group rankings" on public.rankings;
create policy "rankings: admins view group rankings"
  on public.rankings for select to authenticated
  using (
    public.is_group_admin(group_id) and exists (
      select 1 from public.groups g where g.id = group_id and not g.blind_rankings
    )
  );

-- Restrictive backstop: even if a future permissive policy is added by
-- mistake, a ranking row can only be read by its author or by an admin of
-- a chapter that has explicitly turned blind rankings off.
drop policy if exists "rankings: preferences stay private" on public.rankings;
create policy "rankings: preferences stay private"
  on public.rankings as restrictive for select to authenticated
  using (
    ranker_id = auth.uid() or (
      public.is_group_admin(group_id) and exists (
        select 1 from public.groups g where g.id = group_id and not g.blind_rankings
      )
    )
  );

notify pgrst, 'reload schema';
commit;
