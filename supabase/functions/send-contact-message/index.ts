// Edge Function: send-contact-message
//
// Public contact form — no login required, so anyone (a prospective
// chapter, a member with a question, a bug report) can reach you. Emails
// CONTACT_TO via Gmail SMTP, with reply-to set to the sender's own
// address so you can just hit reply.
//
// Required secrets (set via `supabase secrets set` or the dashboard):
//   GMAIL_USER          — the Gmail address that sends the mail, e.g. you@gmail.com
//   GMAIL_APP_PASSWORD  — a 16-character App Password from Google (NOT your
//                         normal Gmail password — see README for how to get one)
//   CONTACT_TO          — where messages land, e.g. your own inbox
// Optional:
//   CONTACT_FROM        — "Display Name <you@gmail.com>". Defaults to GMAIL_USER.
//                         The address part must equal GMAIL_USER — Gmail
//                         rewrites anything else.
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are already injected
// automatically for every Edge Function — don't set those.

import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

const GMAIL_USER = Deno.env.get('GMAIL_USER');
const GMAIL_APP_PASSWORD = Deno.env.get('GMAIL_APP_PASSWORD');
const CONTACT_FROM = Deno.env.get('CONTACT_FROM') ?? GMAIL_USER ?? '';
const CONTACT_TO = Deno.env.get('CONTACT_TO');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const MAX_LEN = { name: 200, email: 320, message: 5000 };

serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (!CONTACT_TO) return json({ error: 'CONTACT_TO is not configured' }, 500);
    if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
      return json({ error: 'GMAIL_USER / GMAIL_APP_PASSWORD are not configured' }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const name = String(body.name ?? '').trim();
    const email = String(body.email ?? '').trim();
    const message = String(body.message ?? '').trim();
    // Honeypot: a real visitor never sees or fills this field (hidden in
    // the form). A bot filling every field in the DOM trips it — report
    // success so it doesn't learn to skip the field next time, but send
    // nothing.
    const website = String(body.website ?? '').trim();

    if (website) return json({ ok: true });

    if (!name || !email || !message) {
      return json({ error: 'Please fill in your name, email, and message.' }, 400);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: 'That email address doesn\'t look right.' }, 400);
    }
    if (name.length > MAX_LEN.name || email.length > MAX_LEN.email || message.length > MAX_LEN.message) {
      return json({ error: 'One of those fields is too long.' }, 400);
    }

    const escapeHtml = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const client = new SMTPClient({
      connection: {
        hostname: 'smtp.gmail.com',
        port: 465,
        tls: true,
        auth: { username: GMAIL_USER, password: GMAIL_APP_PASSWORD },
      },
    });

    try {
      await client.send({
        from: CONTACT_FROM,
        to: CONTACT_TO,
        replyTo: email,
        subject: `Sorora contact form: ${name}`,
        content: `${name} (${email}) wrote:\n\n${message}`,
        html: `<p><strong>${escapeHtml(name)}</strong> (${escapeHtml(email)}) wrote:</p>
<p style="white-space:pre-wrap;">${escapeHtml(message)}</p>`,
      });
    } finally {
      await client.close();
    }

    return json({ ok: true });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Unknown error' }, 500);
  }
});
