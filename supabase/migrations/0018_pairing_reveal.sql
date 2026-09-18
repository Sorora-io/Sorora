-- Pairing reveal: an admin can email each Big their matched Little(s),
-- either immediately or at a scheduled time.
--
-- Two columns support this:
--   * pairings.reveal_sent_at — when the Big for this pairing was notified.
--     Idempotency lives here — a second click only mails the un-notified
--     ones, and re-running matching + re-sending never double-emails a Big
--     whose match didn't change.
--   * cycles.reveal_scheduled_at / reveal_completed_at — the scheduling
--     handshake. A pg_cron job (see the send-pairing-reveal README) sweeps
--     for due schedules, invokes the Edge Function, and stamps the
--     completed_at so the same job never fires twice.
--
-- The actual send is done by the Edge Function under the service role,
-- which is why RLS on pairings.reveal_sent_at doesn't need to be permissive
-- to authenticated — admins never write to it from the client.
begin;

alter table public.pairings
  add column if not exists reveal_sent_at timestamptz;

alter table public.cycles
  add column if not exists reveal_scheduled_at timestamptz,
  add column if not exists reveal_completed_at timestamptz;

-- Admin-only RPCs for schedule/cancel. Doing this through RPCs (instead
-- of client updates) means the migration doesn't need to add cycle-column
-- grants for authenticated to touch reveal_scheduled_at directly, and the
-- admin check lives in one place instead of split between RLS + grant.

create or replace function public.schedule_pairing_reveal(
  p_group_id uuid,
  p_cycle_id uuid,
  p_when timestamptz
) returns public.cycles
language plpgsql security definer set search_path = public
as $$
declare updated public.cycles;
begin
  if auth.uid() is null or not public.is_group_admin(p_group_id) then
    raise exception 'Only a chapter admin can schedule the pairing reveal.';
  end if;
  if p_when is null or p_when <= now() then
    raise exception 'Choose a date and time in the future.';
  end if;
  update public.cycles
     set reveal_scheduled_at = p_when,
         reveal_completed_at = null
   where id = p_cycle_id and group_id = p_group_id
   returning * into updated;
  if updated.id is null then
    raise exception 'This cycle does not belong to your chapter.';
  end if;
  return updated;
end;
$$;

create or replace function public.cancel_pairing_reveal(
  p_group_id uuid,
  p_cycle_id uuid
) returns public.cycles
language plpgsql security definer set search_path = public
as $$
declare updated public.cycles;
begin
  if auth.uid() is null or not public.is_group_admin(p_group_id) then
    raise exception 'Only a chapter admin can cancel the pairing reveal.';
  end if;
  update public.cycles
     set reveal_scheduled_at = null
   where id = p_cycle_id and group_id = p_group_id
     and reveal_completed_at is null
   returning * into updated;
  if updated.id is null then
    raise exception 'No scheduled reveal to cancel for this cycle.';
  end if;
  return updated;
end;
$$;

-- Read-only summary for the Pairings page: how many pairings exist, how
-- many were already notified, and the current schedule state. Runs as
-- security definer so it can read pairings.reveal_sent_at without needing
-- a bespoke RLS policy on that column.
create or replace function public.get_pairing_reveal_status(
  p_group_id uuid,
  p_cycle_id uuid
) returns table (
  total integer,
  sent integer,
  last_sent_at timestamptz,
  scheduled_at timestamptz,
  completed_at timestamptz
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
        where c.id = p_cycle_id and c.group_id = p_group_id);
end;
$$;

revoke all on function public.schedule_pairing_reveal(uuid, uuid, timestamptz) from public, anon;
revoke all on function public.cancel_pairing_reveal(uuid, uuid) from public, anon;
revoke all on function public.get_pairing_reveal_status(uuid, uuid) from public, anon;
grant execute on function public.schedule_pairing_reveal(uuid, uuid, timestamptz) to authenticated;
grant execute on function public.cancel_pairing_reveal(uuid, uuid) to authenticated;
grant execute on function public.get_pairing_reveal_status(uuid, uuid) to authenticated;

commit;
