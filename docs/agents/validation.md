# Validation

- Run checks from `sorority-matcher/`, or use `npm --prefix sorority-matcher` from the repo root.
- Run the focused tests relevant to the change. For a coordinated release, run `CI=true npm --prefix sorority-matcher test -- --watchAll=false --runInBand`.
- Type-check with `sorority-matcher/node_modules/.bin/tsc --project sorority-matcher --noEmit`; build with `npm --prefix sorority-matcher run build`.
- Database regressions are isolated scripts under `supabase/tests/`. PGlite scripts accept `PGLITE_MODULE` pointing to an external installed module; do not commit that dependency tree or a machine-specific path.
- Use the relevant SQL regression scripts for authorization, privacy, deadlines, matching/capacity or lifecycle changes. Email-function scripts use mocks; never send real emails or alter real members/settings merely to test.
- Test denied users as well as allowed users. Include absent/expired sessions, role revocation, cross-organization targeting and partial/network failure where relevant.
- For UI changes, verify the real component at relevant desktop/mobile sizes and keyboard states. Mark sample data clearly. Keep test artifacts separate from production source.
- Before shipping, check `git diff --check` and scan the exact staged files for secrets and generated/private artifacts. Explain unresolved failures; do not claim unverified checks passed.
