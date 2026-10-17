-- Chapter creators and internal admin promotions use SECURITY DEFINER functions.
-- Public join requests may only ask to participate as a Big or Little.
drop policy if exists "memberships: request to join" on public.memberships;
create policy "memberships: request to join"
  on public.memberships for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and status = 'pending'
    and role in ('big', 'little')
    and is_admin = false
    and requested_role is null
  );
