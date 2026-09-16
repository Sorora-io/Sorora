# send-contact-message

Public "Contact Us" form handler — no login required. Emails you via **Gmail SMTP** whenever someone submits the form at `/contact`, with reply-to set to their address so you can just hit reply.

## One-time setup (you'll need to do this — I can't create accounts or run deploys)

### 1. Get a Gmail App Password

Gmail no longer accepts your regular password for SMTP. You need a 16-character *App Password*, which requires 2-Step Verification on the account.

1. Turn on 2-Step Verification: <https://myaccount.google.com/signinoptions/twosv>
2. Create an App Password: <https://myaccount.google.com/apppasswords>
   - App: **Mail**
   - Device: **Other** — name it "Sorora contact form" or similar
3. Google shows a 16-character password (with spaces, e.g. `abcd efgh ijkl mnop`). Copy it — you won't see it again. The spaces are cosmetic; Gmail accepts it with or without them.

> Using Google Workspace instead of a personal @gmail.com account? Same flow, but your admin may need to allow App Passwords under Security → Less secure apps / App passwords.

### 2. Set the secrets

```bash
supabase secrets set GMAIL_USER=you@gmail.com
supabase secrets set GMAIL_APP_PASSWORD="abcd efgh ijkl mnop"
supabase secrets set CONTACT_TO=you@gmail.com
```

- `GMAIL_USER` — the Gmail address that sends the mail. Must match the account the App Password was generated for.
- `GMAIL_APP_PASSWORD` — the 16-character App Password from step 1. Quote it so the shell keeps the spaces (they're allowed).
- `CONTACT_TO` — where messages land. Can be the same as `GMAIL_USER` or a different inbox.
- `CONTACT_FROM` (optional) — a friendly display name, e.g. `"Sorora <you@gmail.com>"`. Defaults to `GMAIL_USER`. **The address part must equal `GMAIL_USER`** — Gmail silently rewrites `from` to the authenticated account, so setting it to `noreply@yourdomain.com` won't work.

### 3. Deploy

```bash
supabase functions deploy send-contact-message
```

Until `GMAIL_USER`, `GMAIL_APP_PASSWORD`, and `CONTACT_TO` are all set, the form shows a clear error instead of silently failing — nothing "looks like it worked" when it didn't.

## Sending limits

Gmail caps outbound SMTP at ~500 messages/day for personal accounts and ~2,000/day for Workspace. That's plenty for a contact form. If you outgrow it later, swap the SMTP block for a transactional provider (Resend, Postmark, SES) — only the `client.send(...)` call in `index.ts` needs to change.

## Abuse guardrail

There's a honeypot field (`website`) hidden in the form — invisible to a real visitor, but a bot filling every field in the DOM trips it. The function reports success without sending anything, so the bot doesn't learn to skip that field on the next attempt.
