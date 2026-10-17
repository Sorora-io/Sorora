# Individual member rankings

Production deployment: dpl_5CEXfYBGVSjpwkgaApQ27R2DmEQa
Deployment URL: https://sorora-eh82mwjc8-yufei-huangs-projects.vercel.app
Production URL: https://sorora.vercel.app

Added the individual member rankings panel to admin Submission status. Admins can expand the panel and choose an approved Big or Little to review submitted preferences, rank 1 first, and the last submission time. Missing submissions and empty submitted preferences have distinct messages. The panel is hidden for blind chapters; the existing export_chapter_rankings RPC enforces chapter admin access, cycle ownership and nonblind privacy on the server. No new database migration required.

Deployed an isolated frontend copy using the existing root Vercel configuration and linked project. Before deploying, compared all 72 recovered production runtime source files against the workspace. Only Status.tsx and rankingExport.ts differed; the new MemberRankings.tsx is the additional runtime component. Unrelated local repository work was preserved and not included as new runtime changes.

Validation: six focused component/export tests passed, TypeScript check passed, Vercel production build compiled successfully, deployment Ready. Verified the production asset manifest serves main.44be27a4.js and the live status chunk contains the individual rankings UI. The live /group/status page requires authentication and redirects to sign-in in the available browser session, so authenticated production member data was not inspected. Exercised the actual component locally using sample member data and saved member-rankings-preview.jpg. No production rankings, settings or pairings were modified.

## Dashboard navigation and duplicate join follow-up

Final production deployment: dpl_FgcyDwiGvK3rZdi2yWX5h8LGotph
URL: https://sorora-2s4l2lxev-yufei-huangs-projects.vercel.app
Verified Ready and aliased to https://sorora.vercel.app.

Dashboard now has a permanent View member rankings button for effective admins, including dual-role admins. Organization also has a dedicated member rankings card. Both open /group/status?view=rankings with the panel expanded; blind chapters see an explicit privacy explanation without preferences being fetched. UI preview with sample members is saved as dashboard-rankings-shortcut.jpg.

Joining now checks for the signed-in user’s existing chapter membership before inserting. Pending/rejected memberships route to their existing status page; approved memberships route to dashboard. No role, status or admin privileges are overwritten. A unique conflict from a competing insert is recovered by reading the existing same-user/chapter membership. Concurrent in-page join calls share work; join forms prevent repeat submission. Raw membership constraint errors are replaced with recovery instructions. The change uses existing read/insert policies and requires no migration. No real member record was used to reproduce the issue.

Also improved thrown-request recovery for sign-in, chapter-code lookup, password reset, ranking submission and matching; dashboard submission-load errors now show a retry rather than an empty/caught-up state. See error-handling-audit.md for code-confirmed remaining gaps.

Validation: full frontend test suite passed (26 suites, 143 tests); TypeScript passed; production build succeeded. Final production source maps were compared to the workspace (73 runtime source files), with no differences. Authenticated live member flows were not exercised because the available browser session is signed out. Existing test act warnings and dependency/browser-data warnings remain unrelated to these changes.

Intermediate releases: dpl_8q5pvMpEnpGqxaePR77NsZUkZzPM (dashboard shortcut), dpl_3RrTPqgpEMnFu2ERgeooLTcHRTuv (join handling). The final release includes both plus the scoped recovery fixes.

## Zoned deadlines and wordmark hover

Production deployment: dpl_9MdziyTuqppXEeRyokr4DCRtwB52
Deployment URL: https://sorora-m3ei371is-yufei-huangs-projects.vercel.app
Production URL: https://sorora.vercel.app

Admin flow: Dashboard → Organization → Manage settings → Edit ranking rules. Enter a local date/time and explicitly choose a named time zone, then Save changes. New deadlines require a zone. Leaving the date/time blank clears the deadline. Existing zoned deadlines reopen in their saved zone; existing date-only deadlines retain their original end-of-UTC-day cutoff and show that exact instant in UTC. Editing unrelated ranking rules does not rewrite a legacy deadline.

Added @js-temporal/polyfill for date/time conversion. Nonexistent clock-forward local times and repeated clock-back times are rejected with specific correction messages; no offset is silently chosen. Common zones are available on older browsers, with all browser-supported IANA zones on modern browsers. The selected local cutoff and zone are shown on settings, both dashboard ranking surfaces, ranking submission and welcome tour, and in reminder emails. Post-deadline review uses the same canonical instant.

Applied 0039_zoned_ranking_deadlines.sql to production qkizypdwgqhkxwuhzmbr using SQL editor. Additive columns ranking_deadline_at and ranking_deadline_timezone leave every legacy deadline value unchanged. The admin-only set_ranking_deadline RPC validates the zone, writes the canonical instant and clears the legacy date only when an admin explicitly changes a deadline. Existing can_edit_ranking and get_unranked_member_review now use the exact cutoff with the original legacy fallback, preserving cycle exclusions and blind privacy. Read-only production verification confirmed installed=true, authenticated RPC access=true, anonymous access=false, exact enforcement=true, review cutoff=true. No actual group deadline was edited for verification.

Deployed send-ranking-reminders via its existing Supabase code editor. Production source before the change matched local source except this rollout’s deadline fields, formatting and scheduled-sweep filter. Deployment showed the updated timestamp. No reminder function was invoked against production for tests and no test emails were sent.

The dashboard/member-header wordmark remains a Button. Its brand-only ss-wordmark class forces a transparent background and scales to 1.06 on hover over 180 ms without layout shift. Other ghost buttons are unchanged. Hover scaling is restricted to hover-capable devices and no-preference motion; reduced-motion disables the transition and scale. Browser verification found transparent hover background, scale(1.06), and a visible 2px keyboard focus outline. Sample previews are saved alongside this document.

Validation: full frontend suite passed (26 suites, 155 tests); TypeScript passed; local and production builds compiled successfully. Isolated PostgreSQL tests covered legacy preservation, admin/anonymous access, invalid zones/infinity, exact cutoff, clearing, exclusions and review privacy. Reminder tests verified named-zone email text and inclusion of timestamp-only deadlines in authorized sweeps. Vercel Ready and production alias verified; all 73 recovered runtime source files match the workspace. No real chapter/member settings were modified in testing.

## Readable rankings CSV and submission twins metadata

Production: dpl_BU7UAuwH8P53ayb6L3x6Kym7XZmJ
URL: https://sorora-carip3ywp-yufei-huangs-projects.vercel.app
Verified Ready and aliased to https://sorora.vercel.app.

Rankings CSV now has one row per approved participant: Member, Role, 1st choice, 2nd choice, etc. No UUIDs, chapter/cycle metadata, timestamps or separate status columns. Missing and empty submissions are marked in the first choice cell. The rankings filename is sorora-rankings.csv, without the cycle UUID. Names are preferred; email is included only for missing/duplicate names. Fully indistinguishable available identities receive consistent local member numbers rather than UUIDs. CSV quoting, UTF-8 BOM, embedded newlines/quotes and formula neutralization remain in place.

Submission status and submission CSV now include recorded Big capacity preference, derived from wanted_little_count with the legacy willing_to_take_twins flag as fallback. Labels distinguish up to 2 or 3 Littles, one Little saved/default, and a waiting member without a nondefault opt-in. Littles are not applicable. The model does not record whether an old false/null one-Little value was explicitly answered, so the UI explains saved/default rather than inventing that history. Capacity is membership-level and can carry between cycles; submitted/waiting is current-cycle. No values are inferred from pairings.

Applied 0040_submission_capacity_preferences.sql to production through the existing SQL editor. It adds an admin-only get_submission_status_details RPC without changing the original status RPC, and extends export JSON with capacity fields. It retains cycle ownership checks, exclusions and blind-ranking protection; capacity status contains no ranked IDs. Initial migration execution reported Success, no rows returned. A later metadata verification query was corrupted during native editor interaction and was not treated as successful. Direct read-only PostgREST verification against qkizypdwgqhkxwuhzmbr returned 401 / PostgreSQL 42501 / “permission denied for function get_submission_status_details,” confirming the new endpoint is installed and anonymous execution is blocked. No real member rows were requested or mutated. Authenticated production member rows were not inspected.

Validation: all 27 frontend suites / 168 tests passed, TypeScript passed, local and production builds succeeded. PostgreSQL integration tests covered legacy flags and exact counts, waiting/default values, Little applicability, blind status without ordered choices, protected rankings export, cycle isolation, exclusions and admin/anonymous access. CSV tests cover readable matrix ordering, no internal metadata, duplicate/missing names, growing ordinal choice columns, escaping/formulas, missing vs empty submissions, submission capacity and UUID-free download filename. All 74 recovered deployed runtime source files match the workspace. Actual Submission status component rendered with sample records; screenshot saved as submission-twins-preview.jpg.

## Superuser organization settings, searchable member picker, single download

Final deployment: dpl_9S8gBFLqn1bUtdrqaQbZYG82o6fa
URL: https://sorora-jqmwd29xo-yufei-huangs-projects.vercel.app
Production https://sorora.vercel.app verified Ready and aliased to this deployment. All 76 recovered deployed runtime files match the workspace.

Superusers: Superuser → Organizations → Edit settings opens /superuser/organizations/:groupId/settings. The shared settings editor uses the explicit URL target and a visible target banner; it never changes the active chapter or invents a membership. Drafts remount when the target or signed-in user changes. Supported settings are name/school, description, blind-ranking privacy, minimum ranking rules, exact zoned deadlines, maximum Littles per Big, and reveal email template. Chapter admins retain cycle/approval workflows. Ownership transfer remains in the pre-existing superuser directory. No separate approval-setting toggle exists in the current settings model.

Applied 0041_superuser_organization_settings.sql through a fresh production SQL editor. New superuser-specific group read/update policies use the existing verified is_superuser() grant check; existing column UPDATE grants still protect owner_id, active_cycle_id and join codes. is_group_admin and ranking/matching access are unchanged. New admin-independent settings read RPC returns the selected group and approved Big/Little counts. The existing maximum/deadline settings RPCs accept verified superusers while retaining capacity, locking, timezone and finite-instant checks. Anonymous RPC access was verified directly via PostgREST: 401 / 42501 / permission denied for function superuser_organization_settings. No real organization settings were edited to verify this. Settings direct updates now require a returned row, so revoked permission cannot appear to save successfully after updating zero rows.

Member picker: compact left-aligned trigger, desktop width bounded to 22rem, mobile width within the card; search lives inside the popup and matches name/email/role. Includes keyboard arrow/Home/End/Enter selection, Escape with focus restoration, click/Tab-out dismissal, no-results feedback and Clear search. Actual component preview verified keyboard selection and retained ranking details. At a 390px viewport, list bounds were x=58..332 and document width remained 390px; viewport override was reset. Sample screenshots saved as searchable-ranking-selector.jpg, searchable-ranking-selector-mobile.jpg, compact-ranking-selector.jpg and superuser-organization-settings-preview.jpg.

Final export UI follows the user's last direction: a single Button labeled exactly Download ranked choices; no separate submissions CSV download. The on-screen submission tracker remains. The rankings matrix columns are Member, Role, Twins / triplets preference, 1st choice, 2nd choice, etc. Both internal CSV serializers include the capacity helper for compatibility, but only ranked choices is exposed in the UI. Labels use up to 2 Littles (twins), up to 3 (triplets), 1 Little (saved/default), waiting/default or not applicable. Unknown legacy defaults are not labelled Boolean No. UUIDs and unnecessary metadata stay absent from the rankings CSV; blind-ranking export restrictions remain unchanged.

Validation: final full frontend suite 29 suites / 181 tests passed; TypeScript passed; final local and production builds compiled successfully. Isolated PostgreSQL tests used the real verified-grant is_superuser definition and covered superuser without membership, normal admin, member/nonmember/unverified/revoked denials, target isolation, protected lifecycle columns, invalid timezones/maxima and existing-pairing capacity checks. UI tests covered permission gating, target/draft isolation, target-specific save paths, directory navigation, popup filtering/keyboard/dismissal and final export controls/columns. Authenticated production settings mutations were deliberately not exercised. A preliminary deployment failed on a hook lint warning; the corrected final deployment compiled successfully and is the production alias.
