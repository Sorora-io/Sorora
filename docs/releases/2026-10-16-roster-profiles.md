# Roster member profiles

Member names in the dashboard roster, full roster list, and full roster cards are shared Button controls opening a read-only profile. The profile uses the saved bio, avatar, and existing roster details. Back to roster returns to the originating roster surface. Missing bios, hidden/missing profiles, loading, and retry states are explicit.

The query targets an approved membership in the active chapter, selects only roster-visible profile fields, and relies on existing memberships/profiles SELECT RLS. Query caches are scoped by viewer/chapter/member and expire on unmount. No permissions migration or live member-data changes are needed.

Validation: frontend suite, TypeScript, production build; focused profile/helper/dashboard navigation tests; isolated RLS checks using the actual migration policies (approved peers/admins allowed; anonymous, pending, rejected, revoked and cross-chapter viewers denied). Real components checked with clearly labelled sample data in list/card layouts, keyboard Enter, return navigation, and a 390px mobile viewport without horizontal overflow.

The root AGENTS.md explicitly requires committing all intended source, pushing to GitHub, and verifying the remote revision before every deployment. Backend migrations and function source are included in that rule. Unrelated cleanup remains outside this release.

Deployment is performed from a clean export of the verified pushed revision. The final deployment ID, URL and source comparison are recorded after Vercel reaches Ready. Existing backend reconciliation limits remain as documented in docs/reconciliation-2026-10-16.md.
