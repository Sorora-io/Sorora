# Superuser account directory

Apply `migrations/0020_superusers.sql` after the existing migrations, then deploy the frontend. The migration is safe to reapply. It does not require a service-role key in the browser.

## Seeding the first superuser

Access comes from the `superuser_grants` table. `grant_superuser()` refuses to run unless the caller is already a superuser, so the first one has to be seeded out of band — in the Supabase SQL editor you are connected as the table owner, where RLS and that guard do not apply:

```sql
insert into public.superuser_grants (user_id)
select id from auth.users
where lower(email) = lower('you@example.com')
  and email_confirmed_at is not null
on conflict (user_id) do nothing;
```

Confirm it landed before relying on it:

```sql
select u.email, s.granted_at
from public.superuser_grants s
join auth.users u on u.id = s.user_id;
```

Zero rows means no *confirmed* account matches that address — sign up and confirm the email first, then re-run.

Authorization reads `auth.users.email_confirmed_at`, never the editable profile email or user metadata, so a spoofed profile cannot grant access. Unverified accounts are refused even if a grant row exists for them.

> Earlier revisions of `0020` hardcoded a handful of addresses to solve this bootstrap problem. That put personal emails in a public repo, so `migrations/0025_superuser_remove_allowlist.sql` retires it. If you applied the original `0020`, seed yourself as above **before** running `0025` — it guards against running on an empty `superuser_grants` and locking you out, but the seed is still yours to do.

Sign in and select **Superuser** in the page header, or visit `/superuser`. The directory searches names/emails and displays 50 accounts per page, including accounts without memberships. Each account shows verification, platform access, chapter roles (including combined Admin + Big/Little), ownership, membership status, and pending role requests.

**Make superuser** followed by **Confirm promotion** grants a verified account access to the directory and permission to promote others. This is separate from chapter membership and does not alter chapter roles. Grants record the caller and timestamp in `superuser_grants`; direct client reads and writes are prohibited. All directory and promotion calls independently check database authorization.

Validation:

```sh
# With @electric-sql/pglite installed, or PGLITE_MODULE pointing to its entry:
node supabase/tests/superusers.mjs
node supabase/tests/superuser-transfer.mjs
cd sorority-matcher
CI=true npm test -- --watchAll=false --runInBand --testPathIgnorePatterns=src/App.test.tsx
npm run build
```

The excluded App.test.tsx is the existing Create React App starter test, which has an incompatible router test setup and still asserts a Learn React link.
