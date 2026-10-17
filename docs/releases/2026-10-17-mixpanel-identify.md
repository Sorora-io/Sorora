# Mixpanel identified-users follow-up

## What changed

Sorora now identifies signed-in users in Mixpanel. Each authenticated session calls `mixpanel.identify(user.id)` with the Supabase Auth UUID and `mixpanel.people.set({...})` with the user's name, email, chapter, role, and admin flag. Anonymous visitors remain anonymous. Previous events (`page_viewed`, `sign_up_completed`, `login_completed`, `ranking_submitted`, `matching_completed`, `pairings_updated`, `reveal_requested`, `reveal_scheduled`, `reveal_cancelled`) are unchanged — only the distinct_id and People profile change.

This reverses the earlier "no identify, no profiles" posture recorded in [2026-10-16-mixpanel.md](2026-10-16-mixpanel.md). The project owner opted into identifying authenticated users so Mixpanel reports can tie events to a specific person and chapter.

## What is sent

| Field | Source | Mixpanel key |
| --- | --- | --- |
| User ID (distinct_id) | `supabase.auth.user.id` (UUID) | `distinct_id` |
| Display name | `profiles.name`, fallback to `auth.user_metadata.name` | `$name` |
| Email | `auth.user.email` | `$email` |
| Role | `memberships.role` on the active chapter | `role` |
| Admin flag | `memberships.is_admin` on the active chapter | `is_admin` |
| Chapter name | `groups.name` on the active chapter | `chapter` |

## What is explicitly not sent

Rankings, matching results, pairing members, ranking preferences, capacity preferences, passwords, free-text replies, query strings, URL fragments, referrers, chapter IDs, and user IDs other than the Supabase UUID. The allowlist in `setUserProperties` strips any key outside the table above; `people.set` bypasses the `before_send_events` hook, so this is the only filter protecting People profiles.

## Code touched

- `sorority-matcher/src/lib/analytics.ts` — adds `identifyUser(userId)`, `setUserProperties(props)`, and clears stored identity in `resetAnalyticsSession` and `syncConsent`. `identifyUser` dedupes per user; `setUserProperties` dedupes per serialized payload and refuses to run before `identifyUser`.
- `sorority-matcher/src/components/AnalyticsIdentity.tsx` — new. Reads `useAuth`, `useGroup`, `useMyProfile`; identifies on mount and whenever any of them change; resets when the user signs out. Returns `null`.
- `sorority-matcher/src/App.tsx` — mounts `<AnalyticsIdentity />` inside `AppShell`, where both auth and group contexts are available.
- `sorority-matcher/src/lib/analytics.test.ts` and `sorority-matcher/src/components/AnalyticsIdentity.test.tsx` — new tests cover dedup, allowlist, session restore vs sign-out, declined-consent silence, and account switch.
- `AGENTS.md` — rewrites the Analytics rule to describe the allowlist and the identity surface.

## How it behaves

- **Fresh browser, signs in.** `onAuthStateChange` fires `SIGNED_IN`; `AnalyticsIdentity` sees the user, calls `identifyUser(uuid)` and `setUserProperties(...)`. Subsequent events carry the UUID as `distinct_id`.
- **Return visit (session restore).** Supabase hydrates the session on load; `AnalyticsIdentity`'s effect runs with the user populated; identify and people.set re-fire. `identifyUser` dedupes on the second render, so no duplicate `$identify` is sent. `setUserProperties` dedupes on identical payloads.
- **Sign out.** `AuthContext.applySession` detects the identity change and calls `resetAnalyticsSession()`, which calls `mixpanel.reset()` and clears the stored identity. `AnalyticsIdentity` then re-renders with `user === null` and calls `resetAnalyticsSession()` again (idempotent).
- **Account switch.** Same as sign-out followed by sign-in; `identifyUser` sees a new UUID and runs.
- **Declined consent.** `initializeAnalytics()` returns false and every tracking entrypoint (including `identifyUser` and `setUserProperties`) short-circuits. Re-opt-in clears the stored identity so the next effect run re-identifies.
- **Storage failure.** `isAnalyticsEnabled()` returns false; identify and people.set are skipped alongside events.

## Validation

- `npx tsc --noEmit` passes.
- `CI=true npm test -- --watchAll=false` passes: **36 suites / 219 tests**, up from 34 / 208. New analytics-only subset: 17 tests across `analytics.test.ts`, `AnalyticsConsent.test.tsx`, `AnalyticsIdentity.test.tsx`.
- `npm run build` compiles with `REACT_APP_MIXPANEL_TOKEN=test-token`.

## How to verify in Mixpanel

1. Open the production app in a fresh browser (no stored consent). Sign in with a test account.
2. In Mixpanel → **Users**, find the user by `$email` or the Supabase UUID. The profile card should show `$name`, `$email`, `role`, `is_admin`, `chapter`.
3. In **Events → Live View**, confirm `page_viewed` events on the signed-in session show the UUID as `distinct_id` (not a random `$device:...` identifier) and that `sign_up_completed` / `login_completed` fire as before.
4. Sign out and refresh; the next `page_viewed` should land under a fresh anonymous distinct_id.
5. Decline analytics from the Analytics preferences control and sign in as a different test account; Live View should receive nothing from that browser.
6. Spot-check an event's properties in Live View: only `platform`, `page` (for `page_viewed`), and standard SDK fields (`distinct_id`, `$device_id`, `$insert_id`, `time`, `token`, `mp_lib`, `$lib_version`) should appear. No `rankings`, `pairings`, `preferences`, `referrer`, or URL properties should ever appear.
