# Sorora

Sorora helps sorority chapters organize Big/Little matching: pairing existing members (Bigs) with newer members (Littles) using preferences submitted by both sides. It brings onboarding, rankings, matching, and pairing reveals into one web application.

## Chapter workflow

1. Create a chapter or join one with an invite code.
2. Approve members, assign matching roles, and manage profiles.
3. Collect ordered preferences for the active recruitment cycle and track submissions.
4. Generate pairings, including two Littles for Bigs who opt into taking twins.
5. Reveal pairings to Bigs by email immediately or on a schedule, once email and scheduling services are configured.

Chapters can configure ranking deadlines, send submission reminders, and manage separate recruitment cycles. Blind rankings are enabled by default; chapter administrators can turn them off.

## Matching and privacy

### Capacity-aware deferred acceptance

Sorora uses Little-proposing deferred acceptance, a capacity-aware version of Gale–Shapley. Each Little proposes to their next preferred Big. Each Big holds their preferred proposals up to their capacity of one, two, or three, capped by the organization’s maximum Littles per Big, rejecting others so those Littles can continue proposing.

Partial preference lists are completed by appending eligible, unranked members in deterministic roster order. This treats unranked members as acceptable fallback choices, rather than exclusions. If demand exceeds available slots, some Littles remain unmatched.

The result is stable with respect to those completed preferences: no Little and Big would both prefer to replace an existing assignment with each other, accounting for capacity. The proposing side receives its best stable outcome under these preferences; this does not guarantee everyone's first choice or the highest total preference score.

### Matching without exposing rankings to the browser

For chapter matching, the frontend calls the PostgreSQL `run_blind_matching` function. It checks administrator access and the active cycle, reads preferences within the database, and saves pairings. A separate function returns submission status without preference lists.

Row-level security restricts ranking reads. In blind mode, even chapter administrators can read only their own rankings. Disabling blind mode allows chapter administrators to read chapter rankings. Blind mode is an application access policy, not encryption against database operators.

Matching locks the chapter row and replaces results in a transaction, so a failed run does not leave partially replaced pairings. This adds database complexity, but lets administrators run matching without receiving other members' preferences in their browser.

A TypeScript reference implementation is retained for tests only; the chapter UI does not execute it. Database tests compare it with the SQL implementation across generated fixtures to help prevent their behavior from diverging.

## Architecture

| Layer | Technology and responsibility |
| --- | --- |
| Frontend | React, TypeScript, React Router, Tailwind CSS, TanStack Query |
| Authentication | Supabase Auth |
| Data and authorization | Supabase PostgreSQL, row-level security, database functions |
| Profile images | Supabase Storage |
| Email | Supabase Edge Functions; Resend for reminders and Gmail SMTP for contact messages and reveals |
| Web deployment | Root Vercel configuration |

The frontend connects directly to Supabase. Authentication, database functions, row-level security, and Edge Functions provide the deployed backend. The legacy Express `backend/` is outside the Vercel build.

## Local setup

You need Node.js, npm, and a Supabase project with Auth, PostgreSQL, and Storage available.

### Configure Supabase

For a new development project, apply the SQL files in [supabase/migrations](supabase/migrations) in numeric order, from `0001` through `0041`, using the Supabase SQL Editor. These define the schema, access policies, storage setup, and database functions.

Before migration `0025`, create and verify the initial platform account and seed its grant as described in that migration. It intentionally refuses to run when no superuser grant exists. Do not store the bootstrap account’s personal details or credentials in Git.

Enable email/password authentication. Configure the Auth site URL and allowed redirect URLs for the local app, including `http://localhost:3000/reset-password` for password recovery. Configure equivalent URLs for deployment.

### Start the frontend

From the repository root:

```bash
cd sorority-matcher
npm ci
cp .env.example .env.local
```

Fill in `.env.local`:

```dotenv
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your_anon_key_here
```

Use the public Supabase anon key. React environment variables are included in the browser bundle; service-role keys and email credentials belong in server-side secrets. `.env.local` is ignored by Git.

```bash
npm start
```

Open [localhost:3000](http://localhost:3000). Restart the development server after changing environment variables.

### Email features

Deploy the relevant Edge Functions and configure their secrets using these guides:

- [Ranking reminders](supabase/functions/send-ranking-reminders/README.md)
- [Pairing reveals](supabase/functions/send-pairing-reveal/README.md)
- [Contact messages](supabase/functions/send-contact-message/README.md)

Scheduled pairing reveals also require the periodic database job described in the reveal guide; saving a schedule in the UI alone does not start a sender.

## Validation

From `sorority-matcher/`:

```bash
npm test -- --watchAll=false
npm run build
```

The database test script uses an isolated in-memory PGlite database. It checks ranking visibility, administrator authorization, status-only responses, migration reapplication, chapter creation, and SQL/TypeScript matching parity across 40 generated fixtures.

After installing the frontend dependencies, install PGlite in a separate test-tools directory and run from the repository root:

```bash
npm install --prefix /tmp/sorora-test-tools @electric-sql/pglite
PGLITE_MODULE=/tmp/sorora-test-tools/node_modules/@electric-sql/pglite/dist/index.js node supabase/tests/blind-rankings.mjs
```

These tests do not connect to a deployed Supabase project.

## Code guide

- [Chapter pages](sorority-matcher/src/pages/group): onboarding, approvals, rankings, status, settings, and pairings.
- [Ranking API calls](sorority-matcher/src/lib/rankings.ts): frontend ranking and matching integration.
- [TypeScript matching](sorority-matcher/src/lib/matching.ts): deferred-acceptance implementation.
- [Blind-ranking migration](supabase/migrations/0017_blind_rankings.sql): access policies, submission status, and database matching.
- [Database tests](supabase/tests/blind-rankings.mjs): privacy, authorization, and matching checks.
- [Edge Functions](supabase/functions): email handlers and deployment guides.

## Deployment

The root [vercel.json](vercel.json) installs and builds the frontend in `sorority-matcher/` and serves `sorority-matcher/build`. Set the two `REACT_APP_SUPABASE_*` variables in the hosting environment before building. Database migrations, Auth URLs, Edge Functions, and email secrets are configured separately in Supabase.


## Admin pairing changes

The Pairings page lets chapter admins move a matched Little to a different Big or swap two Littles. Changes require a reason, a before/after review, and explicit confirmation. The database checks approved membership, capacity, cycle state, reveal state, and the version originally reviewed, then saves both the assignments and the audit entry atomically. History includes the admin name and participant names as snapshots and remains readable by chapter admins after closure. Manual changes may no longer satisfy the matching algorithm’s stability guarantee.

Once manual changes exist, rerunning matching is blocked to avoid silently replacing reviewed assignments. Further adjustments use the same audited editor. Unmatched Littles are not assigned through this first version of the editor.

Before enabling this feature, apply `0028_pairing_changes.sql` after existing migrations, deploy the updated `send-pairing-reveal` Edge Function, then deploy the frontend. Pause scheduled reveal jobs and avoid manual sends during the backend rollout so an older sender cannot read mutable pairings. The updated sender acquires a permanent edit lock before reading assignments for SMTP; a failed or uncertain reveal attempt also leaves editing locked. Cancelling or rescheduling does not remove this lock. No email is sent by the pairing editor.

Validation (isolated data, no email):

```bash
PGLITE_MODULE=/tmp/sorora-test-tools/node_modules/@electric-sql/pglite/dist/index.js node supabase/tests/pairing-changes.mjs
node supabase/tests/reveal-outcomes.cjs
```

Ranking deadlines now accept a local date/time and a required named time zone in Organization settings → Edit ranking rules. Migration `0039_zoned_ranking_deadlines.sql` adds the canonical timestamp and chosen zone; existing date-only deadlines remain unchanged and still close at 00:00 UTC the following day. Apply migration 0039 and deploy the updated `send-ranking-reminders` function before the corresponding frontend. New deadlines close at the exact selected instant; skipped or repeated daylight-saving times must be corrected before saving. Apply migrations 0029–0032 before deploying the corresponding frontend. Migration 0029 preserves existing memberships; existing Little/admin combinations need an explicit role decision before further role changes.

## Maximum Littles per Big

Organization settings → Matching rules lets chapter admins set a maximum of 1, 2, or 3 Littles per Big. The default is 3, preserving existing twins/triplets preferences. Bigs can choose fewer Littles. Matching and manual pairing edits enforce the lower of the Big’s preference and the organization maximum. Lowering the maximum is rejected when existing active-cycle pairings exceed it; adjust those pairings first. Closed-cycle pairings are preserved.

Apply `0034_max_littles_per_big.sql` before deploying this frontend. This adds the checked admin settings RPC and updates matching, pairing-editor capacities, pairing-edit validation, and member preference validation. The reveal/review guards on matching remain in place.

Run the database regression check with `node supabase/tests/max-littles-per-big.mjs` (`PGLITE_MODULE` can point to an installed PGlite module).


## Current administration and shipping

Verified superusers can use Superuser → Organizations → Edit settings without chapter membership (migration `0041`). This settings capability does not grant ranked-choice access. Chapter admins retain cycle and membership approval workflows.

Submission status includes saved twins/triplets capacity. Its single **Download ranked choices** action exports a readable matrix with member, role, capacity preference and ordered choices, without UUIDs or timestamps. Blind-ranking rules still apply.

Repository agent instructions are indexed in [AGENTS.md](AGENTS.md), with task-specific guides under [docs/agents](docs/agents). Shipping includes committing, pushing and verifying the exact deployed source revision.
