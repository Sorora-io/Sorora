# Local Sorora demo

Open http://127.0.0.1:3001/login. These accounts exist only in the local demo:

| Role | Name | Email | Password |
| --- | --- | --- | --- |
| Chapter admin / owner | Demo Admin | admin@demo.sorora.test | SororaDemo2026! |
| Big | Adeline Bennett | big@demo.sorora.test | SororaDemo2026! |
| Little | Estelle Sullivan | little@demo.sorora.test | SororaDemo2026! |

All belong to **Sorora Demo Chapter · Demo University**, join code `SORORA-DEMO`.
Use separate browser profiles/private windows to show different roles simultaneously; tabs in the same browser session share sign-in state.

## Demonstration

1. Sign in as admin and open **Submissions**.
2. Click **Run matching**. This calls the actual private PostgreSQL matching function.
3. View the generated pairings. Big/Little accounts can show their existing ranking lists and edit their own preferences.

The import contains 35 Bigs, 42 Littles, and 75 submitted rankings. Names and preference order come from the anonymized spreadsheet. The latest duplicate Little submission wins, repeated choices are removed, and `-` means blank. Two Bigs referenced by others have no submitted ranking; the algorithm uses its existing fallback behavior. WANTING Yes imports as wanting 2 Littles and takes precedence over WILLING. No three-Little preferences were invented. Original spreadsheet pairing results are not imported. Free-text notes and real contact details are omitted.

This demo runs real local Supabase Auth, Postgres, and row-level access rules. It does not use the production database. The local migration copy omits only migration 0025's existing-superuser bootstrap guard for the fresh database; the source migration and matching/privacy rules remain unchanged. The admin is a chapter admin, not a platform superuser. Email-based reveal requires a separately configured email function and is not part of this local matching demo.

## Start again

Start Docker Desktop. From the repository root:

```sh
node sorority-matcher/demo/local.mjs setup
node sorority-matcher/demo/local.mjs start
```

On a fresh machine, install the app dependencies first with `npm ci --prefix sorority-matcher`, then run `setup`, `seed`, and `start`.

To restore the imported preferences and clear generated demo pairings (also resets demo passwords):

```sh
node sorority-matcher/demo/local.mjs seed
```

To test all three logins, privacy, member permissions, and real SQL matching:

```sh
node sorority-matcher/demo/local.mjs verify
```

Verification removes its generated pairing results afterward. Run it before, not during, a demonstration.

Local database files are kept under ignored `.demo/` and Docker volumes. Scripts obtain keys from that local stack and reject non-loopback database URLs. The app starts with explicit local environment variables; existing production environment files are not edited. Stop the app with Ctrl-C; stop the local database with `npx --yes supabase@2.117.0 stop --workdir .demo`.
