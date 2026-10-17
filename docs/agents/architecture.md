# Architecture and data

- The deployed React/TypeScript app is in `sorority-matcher/`; it talks directly to Supabase. The legacy Express `backend/` is outside the Vercel build.
- Routes live in `sorority-matcher/src/App.tsx`. Chapter pages use `GroupContext`; keep an explicit target organization separate from the active membership when adding platform tools.
- Read the relevant client helper under `src/lib/` and the latest relevant SQL migration before changing data semantics. Migrations are ordered in `supabase/migrations/`; add a new migration rather than editing already-applied SQL to change production behavior.
- Chapter roles and `is_admin` are separate. Preserve `isEffectiveAdmin` behavior for dual-role members.
- Superuser authority comes from the server's verified-account `is_superuser()` grant check. Never infer it from an email, profile field or client flag. Superuser settings access does not imply chapter-admin or ranking access.
- Enforce authorization, chapter/cycle ownership, blind-ranking privacy and lifecycle locks in the database/functions, not just route guards. Preserve column UPDATE grants protecting ownership and cycle fields.
- Rankings and eligibility are cycle-scoped. Capacity is a saved membership preference; never infer twins/triplets willingness from pairings or call an unknown legacy default an explicit No.
- Deadlines use a canonical timestamp plus a named time zone; retain the legacy date-only UTC cutoff fallback. Reject skipped/repeated local times rather than guessing an offset.
- Edge Function source lives in `supabase/functions/`. Keep deployed function edits and schema migrations in Git; secrets stay in Supabase configuration.

Load only the relevant [migration files](../../supabase/migrations), [client helpers](../../sorority-matcher/src/lib) and [function guides](../../supabase/functions). The [README](../../README.md) has setup details.
