# Shipping and Git

- Inspect branch, remotes, upstream, status and recent history before shipping. `origin` is the Sorora repository; verify its actual URL instead of assuming a fork.
- Review and stage explicit intended paths. Preserve unrelated work, including pre-existing cleanup and deleted tracked dependency trees; do not use indiscriminate `git add .` or reset them.
- Do not commit private `.env` files, credentials, `.vercel` state, Supabase local state, generated builds/dependencies, or incidental screenshots. Small intentional release notes are useful; audit them too.
- Commit the complete reproducible feature: frontend source/config/lockfile, tests, migrations and deployed Edge Function source. Capture edits made through hosted editors back into source before the release is considered reconciled.
- Fetch before pushing; preserve remote changes. Use the existing primary branch when requested and permitted. Never force-push. If protected, use a `codex/` branch and a PR, then attach the PR to the chat.
- Push and verify the remote SHA and GitHub-visible commit. A local commit or a successful deployment alone is not completion. If pushing is blocked, report that explicitly instead of silently deploying local-only code.
- Root `vercel.json` builds `sorority-matcher/`. Prefer a clean checkout/export of the pushed commit for deployment; do not deploy unrelated workspace changes. Associate the deployment with that exact commit and verify the production alias, Ready status and shipped assets.
- Supabase migrations and Edge Functions deploy separately. Read the relevant release/function notes, verify the actual target project, apply necessary backend changes before dependent frontend changes, and verify permissions/endpoints without editing real member data.
- Do not blindly apply all migrations to an existing production project. Review the deployed schema and release history. Migration 0025 requires a verified initial superuser grant on a fresh project; never commit a personal bootstrap email or credential.
- Record commit SHA, deployment ID/URL, backend migration/function scope, checks, source discrepancies and limitations in release notes. If a hosted/source comparison is unavailable, state the limitation rather than inventing parity.
- At completion, report the pushed branch/commit link, deployed revision, validation and any remaining unrelated local work.

Consult only the relevant [deployment records](../deploy-2026-10-16/deployment.md), [main deployment instructions](../../README.md) and [Edge Function guides](../../supabase/functions) for the task at hand. Deployment records are historical evidence, not permission to modify unrelated data.
