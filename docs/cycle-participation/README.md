# Cycle participation

Admins can exclude or restore approved Bigs and Littles from the active cycle through the roster. Membership and ranking records are retained. Excluded participants are omitted from ranking choices, submission status, matching, pairing destinations, unranked-member review, ranking exports and reminders. Exclusion does not carry over to a new cycle.

Paired exclusions require acknowledgment and the reviewed pairing version; changed pairings force a new review. The action removes only affected pairings and records them in participation history. Restoration does not recreate pairings. Reveal sending or cycle closure locks participation changes.

## Release

1. Apply `supabase/migrations/0038_cycle_participation.sql`.
2. Deploy `send-ranking-reminders` to the production Supabase project.
3. Deploy the frontend.

Released to production on October 16, 2026.

- Database migration 0038 applied through the production SQL editor; table/function presence and authenticated/anonymous permissions verified.
- Frontend deployment `dpl_8fX2PJLgyybkXkBpyq9GKWfSj6pX` is Ready and aliased to https://sorora.vercel.app.
- Live admin roster renders cycle participation controls with production data.
- Reminder service deployed through the dashboard. It uses the existing Gmail configuration when Resend is unavailable; scheduled sweeps require service-role authorization.
- Reminder authorization, excluded recipient filtering, Gmail delivery path, and cooldown covered by `node supabase/tests/ranking-reminders.cjs` with mocked delivery. No real reminder emails sent during verification.

## Verification

- Database: `PGLITE_MODULE=/path/to/@electric-sql/pglite/dist/index.js node supabase/tests/cycle-participation.mjs`.
- UI: CycleParticipationControls, WorkflowSafety, DashboardAttention and rankings tests: 26 passing tests.
- Production frontend build passes.
- Visual confirmation uses the real component with sample members and mocked data; no production members were changed.
