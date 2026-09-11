# send-contact-message

Public "Contact Us" form handler — no login required. Emails you (via Resend) whenever someone submits the form at `/contact`, with reply-to set to their address so you can just hit reply.

## One-time setup (you'll need to do this — I can't create accounts or run deploys)

1. If you haven't already set up Resend for `send-ranking-reminders`, do that first (see its README) — this function reuses the same `RESEND_API_KEY`.
2. Set the two secrets specific to this function:
   ```bash
   supabase secrets set CONTACT_FROM="Sorora <contact@yourdomain.com>"
   supabase secrets set CONTACT_TO=you@yourdomain.com
   ```
   `CONTACT_TO` is wherever you want messages to land — your own inbox, a shared support address, whatever you check.
3. Deploy:
   ```bash
   supabase functions deploy send-contact-message
   ```

Until `RESEND_API_KEY` and `CONTACT_TO` are both set, the form will show a clear error instead of silently failing — nothing "looks like it worked" when it didn't.

## Abuse guardrail

There's a honeypot field (`website`) hidden in the form — invisible to a real visitor, but a bot filling every field in the DOM trips it. The function reports success without sending anything, so the bot doesn't learn to skip that field on the next attempt.
