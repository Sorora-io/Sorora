# Mixpanel no-prompt follow-up

## What changed

The first-visit consent panel is gone. When `REACT_APP_MIXPANEL_TOKEN` is set in Vercel Production, Sorora initializes Mixpanel on load and sends `page_viewed` plus the existing action events. Visitors who previously saved an opt-out stay opted out — the stored `sorora.analytics-consent.v1 = declined` choice still fails closed, including across tabs.

The "Analytics preferences" control remains available on every app page, now rendered **below the footer** rather than above the main content. Clicking it opens an inline panel with Decline / Allow / Close actions. The decline path still clears Mixpanel persistence via `opt_out_tracking({delete_user:false})` and prevents further sends. Storage failures still fail closed.

## Why

The consent-gated panel appeared above the dashboard on first visit and read as a header card, which looked out of place and gated analytics behind a click most visitors ignored. Removing the auto-prompt keeps the privacy posture (no names, emails, account IDs, rankings, pairing details; property allowlist; `ip=0`; fresh anonymous identifier on reload) while letting events flow once the production token is set.

## Code touched

- `sorority-matcher/src/lib/analytics.ts` — new `isAnalyticsEnabled()` helper treats null consent as allowed. Every tracking / sanitize / sync path routes through it; the opt-out branch is unchanged.
- `sorority-matcher/src/components/AnalyticsConsent.tsx` — the inline panel only renders when the visitor explicitly opens it. Copy no longer frames the choice as "Help improve Sorora?" and omits the first-visit `aria-expanded` auto-open.
- `sorority-matcher/src/App.tsx` — `<AnalyticsConsent />` moved below `<Footer />`.
- `sorority-matcher/src/lib/analytics.test.ts` and `sorority-matcher/src/components/AnalyticsConsent.test.tsx` — rewritten to assert default-on tracking, that a stored decline keeps the browser silent across reloads, and that re-opting-in resumes tracking.
- `sorority-matcher/.env.example` and `AGENTS.md` — updated to describe the new default.

## Validation

- `npx tsc --noEmit`, Jest full suite, and `npm run build` all passed from `sorority-matcher/`.
- Browser check against the local build: on a clean profile with `REACT_APP_MIXPANEL_TOKEN=test-token`, no panel renders on load; the Analytics preferences button sits below the footer; clicking it opens the Decline / Allow / Close panel; declining is remembered across reloads.

## Deployment

- Vercel Production already has `REACT_APP_MIXPANEL_TOKEN` set. CRA embeds `REACT_APP_*` at build time, so the GitHub-triggered rebuild of this commit is what activates the new behavior.
- No database migration or Edge Function deployment is needed.

## Release record

- Deployed revision: see git log for the "Remove first-visit Mixpanel prompt" commit on `main`.
- Verify in Mixpanel Live View that `page_viewed` events arrive on a fresh browser session without any opt-in click, and that a browser with `sorora.analytics-consent.v1 = declined` stays silent.
