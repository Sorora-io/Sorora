# Source reconciliation — October 16, 2026

GitHub main was at `62b3e60088d4031bb327471ff8284197712133db` (September 23) while production was `dpl_9S8gBFLqn1bUtdrqaQbZYG82o6fa` at https://sorora.vercel.app. Prior releases were uploaded from local copies without preserving the work in Git.

## Captured source

- All 76 recoverable production frontend runtime source files match the reconciled source byte-for-byte, using the live asset manifest and source maps. The frontend package/lockfile and public/config files are included; Vercel continues to use the existing root build configuration.
- Captured accumulated UI, navigation, ranking/matching safety, pairing editor, participation controls, time-zone deadlines, member ranking review/export, twins/triplets labels, join recovery and superuser settings work, with regression tests.
- Added missing migrations 0026–0041 and changed reveal/reminder Edge Function source. No migration or email function was invoked to modify production data during reconciliation.
- Preserved release notes from September 30 onward, plus the cycle-participation guide. Their screenshot references describe local historical verification artifacts; those images and exploratory bug-bash artifacts are deliberately outside this source commit.
- Added concise, task-routed repository instructions. The original Button rules are preserved verbatim in `docs/agents/ui.md`. Shipping instructions require committing, pushing, remote verification and an exact deployed-revision association.

## Verification and limits

A clean export of the staged tree installed successfully with `npm ci`. Its 29 frontend suites / 181 tests, TypeScript check and strict CI production build passed using placeholder public Supabase configuration, without a private environment file. All 16 isolated database/Edge Function test scripts passed. Staged-file credential-pattern and generated/private-path scans reported no findings.

Live read-only probes confirmed ten relevant protected RPCs are installed and deny anonymous execution, including settings, submission metadata, exports, participation, pairing/review/reveal status, eligibility and roster functions. The migration bodies are preserved from the source used for the recorded SQL-editor deployments. The reveal source is 13,438 characters, matching the prior recorded production source comparison; reminder source includes the later deployed participation, Gmail and zoned-deadline changes. A fresh complete database schema dump and fresh read-back of all deployed Edge Function bodies were unavailable; backend parity beyond these endpoint checks relies on the recorded deployments and isolated source regressions. This limitation is not treated as a verified full schema comparison. Hosted secrets remain outside Git.

Unrelated pre-existing deletions of the legacy Express backend (including its tracked generated/dependency files), root dependency cleanup and root `node_modules/.package-lock.json` changes are left uncommitted. The legacy backend is not part of the deployed Vercel application. Private `.env`, `.vercel`, Supabase local state, generated builds/dependencies and incidental screenshots are excluded.

The reconciliation commit is pushed to `origin/main`. Its release is associated with the exact Git SHA in Vercel deployment metadata and the final reconciliation report; verify remote history and deployment status rather than assuming a local deployment implies a push.
