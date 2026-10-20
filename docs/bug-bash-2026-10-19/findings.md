# Sorora local bug bash — October 19, 2026

Baseline: `1d449ba607de65184b5f8dc4f44aeda81ac1eaef`. The audit and fixes were verified locally; pushing was requested separately afterward. No production deployment was performed during the audit. Pre-existing backend/dependency deletions and root package edits were preserved.

## Confirmed findings, fixed

| Priority | Finding and reproduction | Fix and verification |
| --- | --- | --- |
| P2 | Auth initialization did not catch a rejected `getSession()` promise. A storage/session failure could leave the application loading indefinitely. | Release initial loading into the signed-out state. Preserve a newer authentication event when initialization fails late. Regression covers both failure and event ordering. |
| P2 | Contact submission did not catch a rejected request. The submit button stayed busy, with no recovery or success confirmation. | Catch failures, retain the message draft, announce an error, and release the button in `finally`. Retry regression confirms a subsequent successful request. Only mocked messages were sent. |
| P2 | Password reset did not catch session-check or password-update rejections. Either could strand its loading state. | Session verification now offers retry and distinguishes a network error from an invalid link. Saving always releases its busy state and reports failures without false success. Mocked tests cover retry. |
| P2 | The dashboard roster interpreted a failed fetch as an empty chapter; the standalone roster displayed error and empty content together. | Both routes now share the same directory component. Failures show an alert/retry instead of an empty-members claim. Regression verifies recovery. |
| P3 | Password-reset labels were not associated with their input fields, making label-based keyboard/assistive access fail. | Added input IDs, associated labels, `new-password` autocomplete, and accessible error/success status messages. Regression locates both fields by label. |

Before fixes, the new failure/label regression run reproduced four failing tests; after fixes those tests pass.

## Requested roster change

The Roster tab now renders the complete directory directly, rather than offering an “Open full roster” detour. It reuses the standalone roster's member details, list/card views, profile navigation, and authorized admin participation controls. Added name/email/details search and role filtering; sort controls remain available. All matching members are rendered, with no preview cap. Profile Back navigation returns to the dashboard roster when entered there.

Tests cover 20 rendered members, search, card view, profile return path, fetch failure and retry. Browser checks covered the same directory at desktop and 390px width; measured document width and scroll width were both 390px on mobile. No real participation changes were submitted.

## Coverage and validation

- Full frontend suite: **48 suites, 277 tests passed**.
- All **20** scripts under `supabase/tests/` passed against isolated in-memory databases or mocked Edge Function dependencies. Coverage includes blind-ranking privacy, membership/admin roles, cross-organization authorization, cycle participation and locks, zoned deadlines, matching/capacity, pairing changes and confirmations, roster profile RLS, exports, account merges, superusers, reminders and reveal failures. These scripts load their own fixtures and relevant migrations; passing them does not establish deployed schema parity.
- Production build and TypeScript check: **passed** after the final roster changes. Type-check explicitly lists `node,jest,react,react-dom` types to avoid pre-existing duplicate empty `@types/* 2` directories in this checkout.
- Public app browser checks: landing/tour steps, chapter setup through the account form, empty chapter-name validation, contact empty-form validation without sending, signed-out admin-settings redirect to sign-in, invalid reset link, and FAQ rendering.
- Real components with marked sample data: ranking add/remove/reorder and narrow layout; dashboard CTA hierarchy; full roster search/list/cards/mobile; mocked reset-session failure followed by retry.
- `git diff --check` run on intended changes.

## Limits

This is local verification, not production certification. Fresh signup, actual password changes, real email delivery, real member/participation mutations, reveal sends, and complete authenticated browser flows against a live Supabase stack were not performed. Role/privacy/lifecycle coverage comes from the automated component and isolated SQL suites. Safari/Firefox, real screen-reader devices, and live concurrency/load testing were not covered. Existing browser-data age warnings are dependency maintenance items; no dependency updates were made as part of this run.

Temporary execution logs and sample screenshots are under `/tmp/sorora-bug-bash-*` and `/tmp/sorora-full-roster-*`; no credentials, private environment files, generated builds, or dependency changes belong to this bug-bash change set.

## Subsequent visual refinements in the same change set

Centered both roster dropdown icons, simplified the roster title, and replaced the dashboard's centered navigation pills with left-aligned flat navigation. Chapter/role context now sits beside the Sorora wordmark (below it at phone width). Chapter labels use “Chapter at University,” falling back to the chapter name when no university is set. Header/navigation tests, the full 277-test suite, TypeScript check, and production build were re-run before pushing this change set.

## Production build follow-up

The automatic deployments of the roster/header release failed because two imports in Dashboard.tsx became unused during the roster consolidation. Local builds completed with lint warnings, while Vercel's `CI=true` setting promoted those warnings to errors. Production therefore continued serving the prior successful revision and still showed “Open full roster.” Removed the unused imports and validated the build with `CI=true` before pushing the correction. Production readiness and aliases must be checked after the automatic deployment, not inferred from Git push success.
