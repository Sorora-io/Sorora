// Edge Function: send-contact-message
//
// Public contact form — no login required, so anyone (a prospective
// chapter, a member with a question, a bug report) can reach you. Emails
// CONTACT_TO via Resend, with reply-to set to the sender's own address so
// you can just hit reply.
//
// Required secrets (set via `supabase secrets set` or the dashboard):
//   RESEND_API_KEY   — same one send-ranking-reminders uses, if you've
//                      already set that up. From resend.com.
//   CONTACT_FROM     — a verified sender, e.g. "Sorora <contact@yourdomain.com>"
//   CONTACT_TO       — where messages land, e.g. your own inbox
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are already injected
// automatically for every Edge Function — don't set those.

import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const CONTACT_FROM = Deno.env.get('CONTACT_FROM') ?? 'Sorora <onboarding@resend.dev>';
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
    if (!RESEND_API_KEY) return json({ error: 'RESEND_API_KEY is not configured' }, 500);

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

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: CONTACT_FROM,
        to: CONTACT_TO,
        reply_to: email,
        subject: `Sorora contact form: ${name}`,
        html: `<p><strong>${escapeHtml(name)}</strong> (${escapeHtml(email)}) wrote:</p>
<p style="white-space:pre-wrap;">${escapeHtml(message)}</p>`,
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return json({ error: `Could not send: ${detail || res.statusText}` }, 502);
    }

    return json({ ok: true });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Unknown error' }, 500);
  }
});
