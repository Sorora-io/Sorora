# Workspace onboarding and matching review

Source update prepared for the user-requested GitHub release on main. Includes the workspace redesign from October 19. Deployment monitoring remains stopped at the user's request; production deployment status and asset parity are not verified here.

## Changes

- The dashboard header places the chapter context below the Sorora wordmark. Production will keep the older side-by-side header until this source is shipped.
- Public Meet Sorora slides reserve consistent content/action space. Start over is absent from the first slide. Desktop and 390px mobile button baselines were checked in the browser, including the final join/create slide.
- A separate, dismissible post-login walkthrough visits actual routes: overview, rankings, ranking editor, roster, profile, and FAQ. Admins additionally visit organization, submission status, pairings, and settings. Navigation/actions are highlighted, including after lazy route loads. The tour never clicks operational controls. Completion is stored per account and membership in this browser; the footer replays it.
- Password eye toggles are shared across sign-in, signup, reset, and profile password fields; password fields remain masked initially and preserve standard autocomplete.
- Rankings use an explicit Submit rankings action, submitted confirmation, and unsaved-change status. The dashboard uses matching submission language. There is no new draft persistence or autosave: submitting uses the existing cycle-scoped write flow, with the same minimum, deadline, participation, and capacity checks.
- Running matching displays an indeterminate progress bar while the RPC is pending. The server does not expose live algorithm phases or a percentage, so none are fabricated. Successful matching navigates to pairings at the top; failures keep uncertainty explicit and release the busy state.
- Pairings show 1:1 results first, then larger families based on each Big’s total assigned Littles. All rows remain visible with confirmation state. Existing blind-ranking restrictions, confirmation persistence/versioning, and editing locks remain intact. Unmatched members are visible above the results. Pairing requests ignore stale responses after switching cycles and expose retry on failure.
- Pairing reveal/send/schedule controls are removed from the results UI, regardless of the old email feature flag. Existing delivery warnings/status polling remain so a previously scheduled delivery failure is not hidden. This does not cancel previously scheduled backend jobs.
- Three brief review prompts explain preference-based results, contextual review of unmatched/flagged pairs, consistent reasons for changes, and planning a chapter reveal. About remains linked. No guarantee of bias elimination or national standardization is claimed.

## Shared corner system

Rectangular controls use 6px corners, panels and menus 8px, and small badges 4px. CSS tokens and semantic Tailwind utilities define the shared scale. Existing standard radius utilities map to the scale, and per-page large pixel values and pill controls are removed. Circular avatars, switches, and decorative indicators keep their shapes; flat workspace sections and underline navigation keep square edges. The deadline badge keeps its pale green/dark green colors. The UI guide documents these conventions for later changes.

Computed styles were checked in the real component preview: dashboard buttons/menu items 6px, menu/tour panels 8px, deadline badge 4px, and circular avatar retained. Mobile roster fields/selects are 6px with no horizontal overflow at 390px.

## Analytics direction superseded

The product owner explicitly removed analytics preferences and requested tracking by default with no user toggle. `AnalyticsPageviews` initializes page tracking independently of the footer. The old consent UI and mutation functions are removed; legacy localStorage opt-out values are not consulted, and the existing SDK opt-out is reset during initialization. Without a configured Mixpanel token, nothing initializes.

The three earlier analytics release notes remain historical references. Event/property allowlists, identified-user property restrictions, disabled autocapture/recording/URL/referrer/marketing capture, and failure isolation are unchanged. Rankings, matching members/results, preferences, and free text are never sent.

## Verification

Final frontend suite: 52 suites / 282 tests passed. TypeScript, diff whitespace checks, and strict CI production build passed. Browser checks use explicitly marked sample members in a local harness with mocked data and no analytics or email sends; no real member data was changed.
