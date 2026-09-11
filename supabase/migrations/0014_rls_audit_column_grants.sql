-- RLS audit fix: the broad "admins can update their group" / "admins
-- update group memberships" policies (0001) only check WHO is updating
-- (public.is_group_admin(...)), never WHICH COLUMNS — so any admin could
-- always bypass the narrow, carefully-guarded functions below with a raw
-- client .update() call:
--
--   * groups.owner_id      — meant to change ONLY via
--     transfer_group_ownership() (0006/0008), which requires the CALLER
--     to already be the current owner, and the new owner to already be an
--     approved admin. A raw `.update({owner_id})` from any admin (not
--     just the owner) skipped both checks entirely — full ownership
--     hijack by any co-admin.
--   * memberships.is_admin — meant to change ONLY via set_member_admin()
--     (0008), which refuses to strip the group owner's admin access. A
--     raw `.update({is_admin: false})` on the owner's own membership row
--     from any OTHER admin skipped that protection.
--   * memberships.willing_to_take_twins — meant to change ONLY via
--     set_my_twin_willingness() (0001), scoped to the caller's own
--     approved Big row. The admin policy let an admin set this on ANY
--     member's row directly, though the app never actually did this.
--
-- RLS policies alone can't express "same row, but only this column" — so
-- this uses Postgres column-level privileges as a second, independent
-- layer: revoke blanket UPDATE from `authenticated`, then re-grant it only
-- for the specific columns the app's direct (non-RPC) update calls
-- actually touch. The RPC functions above are SECURITY DEFINER, so they
-- run as the function owner and are completely unaffected by this — they
-- keep working exactly as before. This is additive to the RLS policies,
-- not a replacement: a row must still pass the existing USING/WITH CHECK
-- clauses too.
--
-- NOTE for future migrations: a new column added to groups or
-- memberships is NOT updatable by `authenticated` until explicitly added
-- to one of the grant lists below — if a future admin-facing "edit X"
-- feature does a raw `.update({x})` and gets a permission-denied error,
-- this is why. Add the column to the relevant grant, or route the change
-- through a new narrow SECURITY DEFINER function if it's sensitive like
-- the three above.

revoke update on public.groups from authenticated;
grant update (name, school, description, ranking_deadline, min_big_rankings, min_little_rankings)
  on public.groups to authenticated;

revoke update on public.memberships from authenticated;
grant update (status, role, requested_role)
  on public.memberships to authenticated;
