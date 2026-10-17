# send-pairing-reveal

Emails each Big in a cycle the name of their matched Little(s). Two ways to fire:

1. **Admin clicks "Reveal to Bigs now"** on the Pairings page → the function runs immediately with the caller's JWT, and mails every Big whose pairing hasn't already been revealed.
2. **Scheduled sweep** via `pg_cron` (see below) → fires with the service role for every cycle whose `reveal_scheduled_at` is due and `reveal_completed_at` is still null.

Both paths stamp `pairings.reveal_sent_at` after a successful send. Scheduled attempts are consumed before sending and are never retried automatically. A persistent warning appears on the admin dashboard and Pairings page if the outcome is failed or unconfirmed. SMTP acceptance confirms sending, not inbox delivery or later bounces.

## Secrets

Reuses the same Gmail App Password as `send-contact-message`:

- `GMAIL_USER` — the Gmail address that sends the mail
- `GMAIL_APP_PASSWORD` — 16-character App Password for that account
- `REVEAL_FROM` — *optional*, defaults to `GMAIL_USER`. Accepts `"Chapter <you@gmail.com>"`; address part must equal `GMAIL_USER`.
- `APP_URL` — *optional*, defaults to `https://sorora.vercel.app`. Used in the email footer link.

`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_ANON_KEY` are auto-injected.

Nothing to set again if the contact form is already working — this function reads the same three Gmail secrets.

## Deploy

Apply migrations `0026_ranking_write_access.sql`, `0027_reveal_failure_status.sql`, and `0028_pairing_changes.sql` before deploying the updated function and frontend. Pause scheduled jobs and avoid manual reveals during this rollout; deploy the function before the frontend exposes editing. Both reveal paths now permanently lock pairing edits before reading assignments. If this lock fails, no emails are sent. Failed or uncertain attempts remain locked to avoid changing possibly emailed assignments.

```bash
supabase functions deploy send-pairing-reveal
```

## Enable scheduled reveal (one-time)

The admin's "Schedule reveal" UI writes `cycles.reveal_scheduled_at`, but nothing fires it until a cron job sweeps for due schedules. Enable that once, in the SQL editor:

The function refuses a sweep unless the caller presents the **service role**
key — the gateway's default JWT check also accepts the anon key, which is
public in the frontend bundle, so the function checks the bearer token
itself. That key must therefore reach the cron job without ending up in
plaintext anywhere queryable, so it goes through Vault rather than being
pasted into the job body (`cron.job.command` is readable by anyone who can
read that table).

```sql
-- pg_cron + pg_net ship with Supabase; enable them if you haven't yet.
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- One-time: stash the service_role key (Project Settings → API) in Vault.
-- Run this by itself, then clear your SQL editor tab so the key isn't left
-- sitting in the editor's query history.
select vault.create_secret('<SERVICE_ROLE_KEY>', 'service_role_key');

-- Every 5 minutes, POST { sweep: true } to the Edge Function, pulling the
-- key out of Vault at call time. Replace <PROJECT_REF> with your project
-- ref (e.g. qkizypdwgqhkxwuhzmbr).
select cron.schedule(
  'sorora-pairing-reveal-sweep',
  '*/5 * * * *',
  $$
    select net.http_post(
      url := 'https://<PROJECT_REF>.supabase.co/functions/v1/send-pairing-reveal',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          select decrypted_secret from vault.decrypted_secrets
          where name = 'service_role_key'
        )
      ),
      body := jsonb_build_object('sweep', true)
    );
  $$
);
```

A 5-minute cadence means a reveal fires up to 5 minutes after its scheduled
time, never before. Tighten to `* * * * *` if that matters, at the cost of
12x the (free, trivial) invocations.

Sanity-check the schedule with `select * from cron.job;` and its recent runs with `select * from cron.job_run_details order by start_time desc limit 20;`.

To turn it off later: `select cron.unschedule('sorora-pairing-reveal-sweep');`

## Design notes

- The Edge Function is the single sender for both paths — the admin-driven "now" path and the cron sweep share the same code, so a bug fixed in one is fixed in both.
- Each scheduled run atomically consumes its schedule before contacting SMTP. A concurrent sweep or a crash cannot trigger an automatic retry of that schedule. Cancelling or changing the schedule before it is claimed prevents that attempt.
- The cycle stores a public-safe `reveal_failure_message`, readable through the admin-only status RPC. A successful outcome clears it; failed or interrupted attempts remain visible after reload. Previously completed schedules with unconfirmed pairings also show a fallback warning.
- The Pairings page refreshes a schedule's status every 30 seconds without replacing an admin's in-progress schedule edit. The admin dashboard refreshes reveal status every 30 seconds.
- Sending again or creating a new schedule requires an explicit admin action. No retry is started by showing, refreshing, or dismissing a warning.
- `pairings.reveal_sent_at` skips already-recorded sends. Rerunning matching currently replaces pairing rows and can clear these stamps; that separate bug-bash finding is not addressed by these changes.
