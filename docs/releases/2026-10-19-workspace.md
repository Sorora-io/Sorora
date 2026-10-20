# Workspace UX redesign — October 19, 2026

## Agreed direction

Tasks before decoration; warm identity with a practical workspace; structure through alignment; colour that communicates priority; specific copy. These are design decisions from the user workshop, not claims of completed user research.

## Implemented locally

- Signed-in workspace routes use a warm off-white page without the frosted wrapper, background glow, or outer shadow. Public landing, onboarding and informational pages retain their brand treatment.
- Member overview leads with actual ranking state, the minimum count, deadline and one ranking action. No active cycle, closed deadlines, excluded members, loading and failed lookups have explicit states.
- Admin overview places chapter tasks before personal rankings and progress. The first task gets the primary action, approvals use explicit counts, and admin-only matching participation remains available as a secondary action. Failed/incomplete lookups do not claim the chapter is caught up.
- Ranking editor shows progress toward the minimum. Save status compares the draft order and Big capacity against the last confirmed snapshot. Failed saves retain the dirty state; only a confirmed save resets it. Save stays visible in a fixed phone footer, with bottom spacing so all content can scroll above it. Existing deadline/participation/permission guards remain in place.
- Roster defaults to flat rows and column headings, with the full member list, profile navigation, search, role filters, sorting and optional cards retained. The same component still serves both the dashboard tab and direct roster route.
- The chapter label sits below the Sorora wordmark, with a smaller supporting type treatment. Regular members' role labels remain absent from the header; effective admins retain their distinction. The deadline badge's pale green background/dark green text is preserved.

## Verification

Full frontend suite: 48 suites / 280 tests passed, including new checks for dirty/saved/failed ranking transitions and admin-task ordering. TypeScript was checked with explicit standard type packages to avoid the checkout's pre-existing duplicate empty type directories. A production build was checked with CI=true (warnings treated as errors).

Real components were reviewed with explicitly marked sample data: member overview, admin overview, ranking editing and confirmed mock save, flat roster columns, and 390px phone layouts. Mobile ranking/roster widths were verified without horizontal document overflow. No real member data or email sends were used, and no schema, Edge Function or analytics changes were made.

This note records the initial local review. These changes are included in the October 20 workspace release. Deployment monitoring remains stopped at the user's request.
