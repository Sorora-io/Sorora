// Edge Function: send-pairing-reveal
//
// Emails each Big in a cycle their matched Little(s). Callable two ways:
//   1. By a group admin from the app (Pairings page "Reveal to Bigs now"
//      button) — the caller's JWT is forwarded and checked against
//      memberships.
//   2. On a cron sweep with the service role — pass { sweep: true } and
//      the function finds every cycle whose reveal_scheduled_at has passed
//      but reveal_completed_at is still null. Stamp completed_at at the
//      end so the same schedule never fires twice. See README.md for how
//      to wire the pg_cron trigger.
//
// Reuses the same Gmail SMTP secrets as send-contact-message
// (GMAIL_USER / GMAIL_APP_PASSWORD). REVEAL_FROM defaults to GMAIL_USER
// but a "Display Name <you@gmail.com>" form works too — the address part
// must match GMAIL_USER or Gmail rewrites it.

import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const GMAIL_USER = Deno.env.get('GMAIL_USER');
const GMAIL_APP_PASSWORD = Deno.env.get('GMAIL_APP_PASSWORD');
const REVEAL_FROM = Deno.env.get('REVEAL_FROM') ?? GMAIL_USER ?? '';
const APP_URL = Deno.env.get('APP_URL') ?? 'https://sorora.vercel.app';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Defaults live in one place so the Settings preview and the actual send
// stay in sync — the client fetches DEFAULT_REVEAL_TEMPLATE from Supabase
// via the get_reveal_email_defaults RPC (migration 0019). Update both
// if you change these.
const DEFAULT_SUBJECT = 'Your Little{{little_plural_s}} {{little_plural_is_are}} here — {{chapter_name}}';
const DEFAULT_BODY = `Hi {{first_name}},

Your Little{{little_plural_s}} {{little_plural_is_are}}: {{little_names}}

Said with love,
{{chapter_name}}`;

function renderTemplate(
  template: string,
  vars: { first_name: string; little_names: string; chapter_name: string; little_count: number },
): string {
  const s = vars.little_count > 1 ? 's' : '';
  const isAre = vars.little_count > 1 ? 'are' : 'is';
  return template
    .replace(/\{\{\s*first_name\s*\}\}/g, vars.first_name)
    .replace(/\{\{\s*little_names\s*\}\}/g, vars.little_names)
    .replace(/\{\{\s*chapter_name\s*\}\}/g, vars.chapter_name)
    .replace(/\{\{\s*little_plural_s\s*\}\}/g, s)
    .replace(/\{\{\s*little_plural_is_are\s*\}\}/g, isAre);
}

interface PairingRow {
  id: string;
  big_id: string;
  little_id: string;
  reveal_sent_at: string | null;
}

interface RevealTarget {
  bigId: string;
  bigEmail: string;
  bigName: string | null;
  littles: { name: string | null; email: string }[];
  pairingIds: string[];
}

async function revealCycle(
  admin: ReturnType<typeof createClient>,
  groupId: string,
  cycleId: string,
) {
  const { data: groupRow, error: groupError } = await admin
    .from('groups')
    .select('name, reveal_email_subject, reveal_email_body')
    .eq('id', groupId)
    .maybeSingle();
  if (groupError || !groupRow) return { sent: 0, total: 0, error: 'Group not found' };
  const subjectTemplate = (groupRow.reveal_email_subject as string | null)?.trim() || DEFAULT_SUBJECT;
  const bodyTemplate = (groupRow.reveal_email_body as string | null)?.trim() || DEFAULT_BODY;

  const { data: pairingRows, error: pairingsError } = await admin
    .from('pairings')
    .select('id, big_id, little_id, reveal_sent_at')
    .eq('group_id', groupId)
    .eq('cycle_id', cycleId);
  if (pairingsError) return { sent: 0, total: 0, error: pairingsError.message };

  const pairings = (pairingRows ?? []) as PairingRow[];
  const unsent = pairings.filter(p => !p.reveal_sent_at);
  if (unsent.length === 0) return { sent: 0, total: pairings.length };

  const userIds = Array.from(new Set(unsent.flatMap(p => [p.big_id, p.little_id])));
  const { data: profileRows, error: profilesError } = await admin
    .from('profiles')
    .select('id, name, email')
    .in('id', userIds);
  if (profilesError) return { sent: 0, total: pairings.length, error: profilesError.message };
  const profileById = new Map(
    (profileRows ?? []).map(p => [p.id as string, { name: p.name as string | null, email: p.email as string }]),
  );

  const targets = new Map<string, RevealTarget>();
  for (const p of unsent) {
    const big = profileById.get(p.big_id);
    const little = profileById.get(p.little_id);
    if (!big?.email || !little) continue;
    let target = targets.get(p.big_id);
    if (!target) {
      target = { bigId: p.big_id, bigEmail: big.email, bigName: big.name, littles: [], pairingIds: [] };
      targets.set(p.big_id, target);
    }
    target.littles.push({ name: little.name, email: little.email });
    target.pairingIds.push(p.id);
  }

  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    return { sent: 0, total: pairings.length, error: 'GMAIL_USER / GMAIL_APP_PASSWORD are not configured' };
  }

  const client = new SMTPClient({
    connection: {
      hostname: 'smtp.gmail.com',
      port: 465,
      tls: true,
      auth: { username: GMAIL_USER, password: GMAIL_APP_PASSWORD },
    },
  });

  let sent = 0;
  const failures: string[] = [];
  try {
    for (const t of targets.values()) {
      const firstName = t.bigName?.split(/\s+/)[0] || 'there';
      const littleNames = t.littles.map(l => l.name || l.email).join(', ');
      const vars = {
        first_name: firstName,
        little_names: littleNames,
        chapter_name: groupRow.name as string,
        little_count: t.littles.length,
      };
      const subject = renderTemplate(subjectTemplate, vars);
      const bodyPlain = renderTemplate(bodyTemplate, vars);
      // Preserve paragraph breaks in HTML view — a blank line becomes a new
      // <p>, a single newline becomes a <br>. Everything escaped first so
      // an admin can't inject HTML by editing the template.
      const bodyHtml = bodyPlain
        .split(/\n{2,}/)
        .map(p => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
        .join('');
      try {
        await client.send({
          from: REVEAL_FROM,
          to: t.bigEmail,
          subject,
          content: `${bodyPlain}\n\n${APP_URL}`,
          html: `${bodyHtml}<p style="color:#888;font-size:12px;">Sent by Sorora on behalf of ${escapeHtml(groupRow.name as string)}.</p>`,
        });
        // Stamp before moving on, so a mid-run crash still records progress.
        await admin
          .from('pairings')
          .update({ reveal_sent_at: new Date().toISOString() })
          .in('id', t.pairingIds);
        sent += t.pairingIds.length;
      } catch (e) {
        failures.push(`${t.bigEmail}: ${e instanceof Error ? e.message : 'send failed'}`);
      }
    }
  } finally {
    await client.close();
  }

  return {
    sent,
    total: pairings.length,
    unsent: unsent.length,
    bigs: targets.size,
    failures: failures.length ? failures : undefined,
  };
}

serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const body = await req.json().catch(() => ({}));

    // Scheduled sweep (service-role only — see README) walks every cycle
    // whose reveal_scheduled_at is due but hasn't fired yet.
    if (body.sweep === true) {
      const { data: due, error: dueError } = await admin
        .from('cycles')
        .select('id, group_id')
        .lte('reveal_scheduled_at', new Date().toISOString())
        .is('reveal_completed_at', null)
        .not('reveal_scheduled_at', 'is', null);
      if (dueError) return json({ error: dueError.message }, 500);

      const results = [] as { group_id: string; cycle_id: string; sent: number; total: number }[];
      for (const c of due ?? []) {
        const result = await revealCycle(admin, c.group_id as string, c.id as string);
        results.push({ group_id: c.group_id as string, cycle_id: c.id as string, sent: result.sent, total: result.total });
        // Mark complete even on empty result — the schedule fired, and we
        // don't want the cron to keep retrying an already-satisfied cycle.
        await admin
          .from('cycles')
          .update({ reveal_completed_at: new Date().toISOString() })
          .eq('id', c.id);
      }
      return json({ cycles: results.length, results });
    }

    const { groupId, cycleId } = body;
    if (!groupId || !cycleId) return json({ error: 'groupId and cycleId are required' }, 400);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing Authorization header' }, 401);

    // A client scoped to the caller's own JWT — used only to confirm who
    // they are. The queries/sends below all go through the service-role
    // `admin` client.
    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await callerClient.auth.getUser();
    if (userError || !userData.user) return json({ error: 'Not authenticated' }, 401);

    const { data: membership } = await admin
      .from('memberships')
      .select('role, is_admin')
      .eq('group_id', groupId)
      .eq('user_id', userData.user.id)
      .eq('status', 'approved')
      .maybeSingle();

    const isAdmin = membership && (membership.role === 'admin' || membership.is_admin);
    if (!isAdmin) return json({ error: 'Not an admin of this group' }, 403);

    const result = await revealCycle(admin, groupId, cycleId);
    if (result.error) return json({ error: result.error }, 500);
    return json(result);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Unknown error' }, 500);
  }
});
