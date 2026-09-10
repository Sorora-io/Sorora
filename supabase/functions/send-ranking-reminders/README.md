# send-ranking-reminders

Emails every approved Big/Little in a group who hasn't submitted their ranking yet.

## One-time setup (you'll need to do this — I can't create accounts or run deploys)

1. **Create a Resend account** at [resend.com](https://resend.com) (free tier: 3,000 emails/month, 100/day). Verify a sending domain, or start with their shared `onboarding@resend.dev` sender for testing (real domain required before this reaches inboxes reliably in production).
2. **Install the Supabase CLI** if you don't have it: `brew install supabase/tap/supabase`
3. **Link this project**: from the repo root, `supabase link --project-ref <your-project-ref>` (find the ref in your Supabase project's URL or Settings → General).
4. **Set secrets**:
   ```bash
   supabase secrets set RESEND_API_KEY=re_xxxxxxxx
   supabase secrets set REMINDER_FROM="Sorora <reminders@yourdomain.com>"
   supabase secrets set APP_URL=https://sorora.vercel.app
   ```
5. **Deploy the function**:
   ```bash
   supabase functions deploy send-ranking-reminders
   ```

Alternative to steps 2–5: paste `index.ts`'s contents into the Supabase dashboard's Edge Functions editor (Project → Edge Functions → New Function) and set the same secrets under Project Settings → Edge Functions → Secrets.

## How it's called

The frontend already calls this as `send-ranking-reminders` with `{ groupId }` from the group's Status page (see `src/lib/reminders.ts`) — an admin clicks "Send reminders," the function checks they're actually an admin of that group, then emails everyone in it who hasn't submitted.

## Optional: automatic reminders on a schedule

Right now reminders only go out when an admin clicks the button. To also send them automatically (e.g. daily) for every group with a deadline set, without anyone clicking anything:

1. In the Supabase SQL Editor, enable the extensions (usually already on): `create extension if not exists pg_cron; create extension if not exists pg_net;`
2. Schedule a daily call to this function with `{ "all": true }` in the body, using your project's service-role key:
   ```sql
   select cron.schedule(
     'ranking-reminders-daily',
     '0 14 * * *', -- 9am ET / 2pm UTC — adjust to taste
     $$
     select net.http_post(
       url := 'https://<your-project-ref>.supabase.co/functions/v1/send-ranking-reminders',
       headers := jsonb_build_object('Authorization', 'Bearer <your-service-role-key>', 'Content-Type', 'application/json'),
       body := jsonb_build_object('all', true)
     );
     $$
   );
   ```
   Keep the service-role key out of anywhere client-visible — this SQL only lives in the database itself.

Without RESEND_API_KEY set, the function runs in "dry-run" mode: it still reports who *would* have been emailed, but sends nothing — safe to deploy and test the reminder-counting logic before wiring up Resend.
