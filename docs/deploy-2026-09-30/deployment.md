# Production deployment — September 30, 2026

- Site: https://sorora.vercel.app
- Vercel deployment: dpl_4wstoLKgGF5NMNMUA2g1pKgZETvK
- Deployment URL: https://sorora-c9qhtthby-yufei-huangs-projects.vercel.app
- Verified Vercel status: Ready; production alias attached.
- Deployed the current tested working tree, including consistent arrow/back buttons. No Git commit or push was made.
- Production environment points to Supabase qkizypdwgqhkxwuhzmbr. The old repository link to vlqmcemaguzzgmunrwmi was not used or changed.
- Production already had approved-admin matching role and pairing-editor functions. Applied migrations 0031 (UTC deadline) and 0032 (distinct unnotified recipients) through the authenticated Supabase SQL Editor. Both succeeded. Read-only follow-up returned true for deadline enforcement, recipient-count output, admin role function, and pairing editor function.
- Before-change function definitions saved in pre-deploy-functions.txt.
- Deployed send-pairing-reveal source exactly matches the local tested source (13,438 characters), including the permanent edit lock. No redeployment or invocation was necessary; no emails were sent.
- Live FAQ loads and renders two shared Back to dashboard buttons. Screenshot: live-faq.png. Database verification screenshot: database-verification.png.
- The proposed admin Organization tab is not part of this release; it was discussed after deployment began.

## Organization navigation and roster arrow follow-up

Production deployment `dpl_6TdtLb8t5jbp4qcgnAJrPgtgG9Sx` is Ready and aliased to https://sorora.vercel.app (September 30, 2026).

- Kept Roster in shared navigation; added admin-only Organization with Submissions and Pairings shortcuts, pending Approvals count, secondary settings.
- Replaced the dashboard's flat admin action row with Manage organization; retained urgent contextual actions.
- Renamed Rankings navigation to My rankings; FAQ remains in the global footer and legacy FAQ tab URLs still work.
- Roster sorting uses an inset, vertically centered ChevronDown instead of the native edge-aligned arrow.
- 20 test suites / 88 tests pass; production build and diff whitespace check pass.
- Browser verified non-admin Organization URL redirects to Dashboard, admin hub and count render, and narrow 390px layout fits. Verified live production with Big + Admin account. Screenshot: organization-live.png.

## Admin exports and superuser join codes

Added `0033_ranking_exports.sql`: authenticated chapter admins only, chapter/cycle scoped, preference exports blocked when blind rankings are on. Status exports omit preferences. No privacy settings were changed. SQL is applied to production and tested in isolated PGlite. Production's old `superuser_organizations` definition was missing `join_code`; reapplied existing migration 0023 and verified the live Copy button success.

Added CSV download controls under Submissions, ordered preference rows, waiting members, cycle identity, UTF-8 BOM, CSV escaping, and formula neutralization. 22 frontend suites / 92 tests pass; strict CI production build passes. Downloaded local status CSV contains 77 members, 75 submitted and 2 waiting, no preference columns. Backend export authorization/privacy/order checks and superuser tests pass.

Export production deployment `dpl_537k82gXjRJZy5XCdeyLoebigv9W` verified Ready at https://sorora.vercel.app. First deployment was rejected by CI for the intentional control-character CSV safety regex lint warning; added a documented, line-scoped lint exception and reran the strict build successfully before redeploying.

## Privacy Save changes interaction

Blind rankings now uses a draft toggle. Save changes explicitly persists it; Cancel restores the saved setting. Both actions appear only for unsaved changes, and failed saves retain the draft for retry. Removed the Edit privacy gate. Browser verified toggling and cancelling without changing privacy settings. All 22 suites / 93 tests and strict production build pass.

## Organization settings consistency

Standardized section headings, separators, field labels, compact edit buttons, and shared Save changes / Cancel action rows across organization details, description, privacy, email template, and ranking rules. Privacy actions now sit below explanatory text like other sections. Pending privacy changes block starting another edit. Cycle and ownership confirmations retain specific action labels while sharing sizing and primary/cancel order. Cancel is disabled during those pending requests. Added accessible input labels and cancellation coverage for every ordinary editor.

22 suites / 97 tests and CI production build pass. Browser checked organization and ranking editors and mobile description editor at 390px. No chapter settings were changed during verification.

## Button hover palette

Replaced white hover backgrounds with subtle jade/sage tint tokens across shared buttons, account menu, roster filters, ranking choices, login controls, and other standalone actions. Primary buttons darken slightly. Shared disabled buttons do not change on hover; keyboard focus remains clearly outlined and reduced-motion preferences disable their transitions. Member tabs no longer inherit conflicting ghost variant colors, preserving the selected green state. Build and all 97 tests pass; browser verified selected Organization styling.
