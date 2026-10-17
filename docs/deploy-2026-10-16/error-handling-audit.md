# Focused error-handling audit

Reviewed sign-in, signup/join, ranking submission, profile/settings saves, chapter approvals, matching and reveal actions. Code review and mocked failure tests only; no real member data used or modified.

## Fixed in this rollout

- `src/lib/groups.ts`: repeated joins reuse the signed-in user’s existing membership for that chapter. Existing pending, approved and rejected states, roles and admin privileges are unchanged. Concurrent calls share work; cross-tab unique conflicts are recovered by reading the same user/chapter membership. Unconfirmed failures provide recovery text rather than SQL constraint names. No upsert, uniqueness change or authorization change.
- `src/pages/Login.tsx`: approved joins navigate to dashboard; other statuses navigate to the existing pending/rejected page. A ref blocks repeated chapter submissions. Active chapter selection happens after membership refresh. Sign-in, code lookup and password reset now clear busy state and show recovery text on thrown requests.
- `src/components/AddOrganizationForm.tsx` and `src/pages/group/Onboarding.tsx`: reuse the returned membership state and release join busy state on failure.
- `src/pages/Dashboard.tsx`: persistent member rankings navigation for effective admins, including dual-role admins, independent of outstanding tasks. A failed submission query now surfaces a retry rather than claiming an empty/caught-up chapter.
- `src/pages/group/Status.tsx`: shortcut opens member rankings directly; blind chapters see privacy explanation without preference loading. Matching exceptions release the button and explicitly report uncertainty, directing admins to Pairings before another run.
- `src/pages/group/SubmitRanking.tsx`: thrown saves release busy state, retain draft choices, and avoid a false success; success is shown after refresh completes.

## Verified remaining gaps

1. `src/pages/group/Settings.tsx:291`: minimum-ranking settings and deadline are saved in two parallel requests. One can commit while the other fails; the UI reports a generic failure without identifying which values persisted. This requires a transactional save or precise partial-save/reload behavior. Reveal-template, chapter-profile/description, cycle creation and ownership-transfer handlers also lack catch/finally for thrown requests (e.g. lines 125, 229, 244, 261, 278).
2. `src/pages/group/Approvals.tsx:63`: approval/rejection and requested-role decisions have no in-flight guard or disabled pending state. Repeated clicks can send competing decisions. Admin-toggle and member-removal handlers set busy flags but lack finally for thrown requests (lines 81, 93). Server permissions still apply.
3. `src/pages/Profile.tsx:75`: avatar upload, password change and role-change requests lack catch/finally (lines 75, 113, 154), so unexpected exceptions can leave busy indicators stuck. Password verification also maps every returned sign-in error to “Current password is incorrect,” even when the cause may be connectivity or a rate limit. The main profile save already has catch/finally and visible load/save errors.
4. `src/pages/group/Pairings.tsx:111`: manual reveal, scheduling and cancellation lack catch/finally, as do some page loads. Thrown requests can leave controls busy. An uncertain email-send result needs server-status reconciliation, never an automatic resend. Returned server failures and partial sends already receive specific handling. Ranking reminder sending has the same exception/busy-state gap in `src/pages/group/Status.tsx:69`.
5. Rankings and Big capacity preference are still separate requests in `src/pages/group/SubmitRanking.tsx:113`. The new exception handling avoids claiming total success, but atomicity requires a backend operation; the draft remains available for explicit retry.

These are code-confirmed recovery gaps, not claims that production data was corrupted. The immediate join, navigation and scoped failure-recovery changes were kept separate from broader transactional/admin-workflow changes.
