# Sorora agent instructions

- Read only the task-relevant guides below **before** changing their area. Follow their linked source files when more detail is needed; do not load every guide by default.
- Check Git status first. Preserve unrelated edits and deletions; never stage the whole checkout blindly.
- UI actions and navigation CTAs use the shared `<Button>`. Underlined links are only for inline prose or footer navigation. Load the UI guide for variants and exceptions.
- Keep credentials, private environment files, generated builds and dependency directories out of commits.
- Before every deployment, commit all intended source changes (including backend migrations and functions), push to GitHub, and verify the remote commit. Deploy that pushed revision; never deploy uncommitted or local-only intended source. Preserve unrelated local work instead of blindly committing it. Record the deployed revision.

| Task | Load first |
|---|---|
| Components, styling, navigation or copy | [UI rules](docs/agents/ui.md) |
| App structure, membership, authorization, database or Edge Functions | [Architecture and data](docs/agents/architecture.md) |
| Tests, build checks or database verification | [Validation](docs/agents/validation.md) |
| Commits, pushes, migrations, deployments or reconciliation | [Shipping and Git](docs/agents/shipping.md) |

## Analytics

- Mixpanel runs when `REACT_APP_MIXPANEL_TOKEN` is set. The product owner removed analytics preferences on 2026-10-20; tracking is default-on and legacy opt-out values are no longer consulted. See [the workspace flows update](docs/releases/2026-10-20-workspace-flows.md). Read the [initial tracking plan and handoff](docs/releases/2026-10-16-mixpanel.md), the [no-prompt follow-up](docs/releases/2026-10-16-mixpanel-no-prompt.md), and the [identified-users follow-up](docs/releases/2026-10-17-mixpanel-identify.md) before changing tracking.
- Use src/lib/analytics.ts wrappers only. The identity surface is `identifyUser`, `setUserProperties`, and `resetAnalyticsSession` wired through `components/AnalyticsIdentity.tsx`. People profiles may carry only the allowlisted fields: `$name`, `$email`, `role`, `is_admin`, `chapter`. Never send rankings, matching results, pairing members, ranking preferences, free text, or arbitrary URLs. Autocapture, page-URL capture, and marketing attribution remain off.
