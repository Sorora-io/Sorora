// Edge Function: send-ranking-reminders
//
// Emails every approved Big/Little in a group who hasn't submitted their
// ranking yet. Callable two ways:
//   1. By a group admin from the app (Status page "Send reminders" button)
//      — the caller's JWT is forwarded and checked against memberships.
//   2. On a schedule (Supabase cron) with the service role — pass
//      { "all": true } to sweep every group that has a ranking_deadline
//      set, instead of one groupId. See README.md in this folder for how
//      to wire up the cron trigger.
//
// Required secrets (set via `supabase secrets set` or the dashboard):
//   RESEND_API_KEY   — from resend.com (free tier is enough to start)
//   REMINDER_FROM    — a verified sender, e.g. "Sorora <reminders@yourdomain.com>"
//   APP_URL          — e.g. "https://sorora.vercel.app" (no trailing slash)
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY are already
// injected automatically for every Edge Function — don't set those.

import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const GMAIL_USER = Deno.env.get('GMAIL_USER');
const GMAIL_APP_PASSWORD = Deno.env.get('GMAIL_APP_PASSWORD');
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const REMINDER_FROM = Deno.env.get('REMINDER_FROM') ?? GMAIL_USER ?? 'Sorora <onboarding@resend.dev>';
const APP_URL = Deno.env.get('APP_URL') ?? 'https://sorora.vercel.app';

// An admin re-clicking "Send reminder emails" (or a misbehaving client
// retrying) shouldn't be able to spam members or burn through the Resend
// quota — enforced here, server-side, since a client-side disabled button
// alone is trivially bypassed by calling the function directly.
const COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

interface MemberRow {
  user_id: string;
  role: 'big' | 'little';
  profiles: { email: string; name: string | null } | null;
}

interface RemindableGroup {
  id: string;
  name: string;
  ranking_deadline: string | null;
  ranking_deadline_at?: string | null;
  ranking_deadline_timezone?: string | null;
  active_cycle_id: string | null;
  reminders_last_sent_at: string | null;
}

function cooldownRemaining(group: RemindableGroup): number {
  if (!group.reminders_last_sent_at) return 0;
  const elapsed = Date.now() - new Date(group.reminders_last_sent_at).getTime();
  return Math.max(0, COOLDOWN_MS - elapsed);
}

async function remindGroup(admin: ReturnType<typeof createClient>, group: RemindableGroup) {
  const remaining = cooldownRemaining(group);
  if (remaining > 0) {
    return { sent: 0, total: 0, skipped: true, retryAfterSeconds: Math.ceil(remaining / 1000) };
  }

  if (!group.active_cycle_id) return { sent: 0, total: 0, skipped: false };
  const { data: members, error: memberError } = await admin
    .from('memberships')
    .select('user_id, role, profiles(email, name)')
    .eq('group_id', group.id)
    .eq('status', 'approved')
    .in('role', ['big', 'little']);

  if (memberError) throw memberError;
  if (!members || members.length === 0) return { sent: 0, total: 0, skipped: false };

  const { data: rankings, error: rankingError } = await admin.from('rankings').select('ranker_id').eq('group_id', group.id).eq('cycle_id', group.active_cycle_id);
  const { data: exclusions, error: exclusionError } = await admin.from('cycle_exclusions').select('user_id').eq('group_id', group.id).eq('cycle_id', group.active_cycle_id).eq('excluded', true);
  if (rankingError || exclusionError) throw rankingError || exclusionError;
  const excludedIds = new Set((exclusions ?? []).map(e => e.user_id as string));
  const submittedIds = new Set((rankings ?? []).map(r => r.ranker_id as string));

  const toRemind = (members as unknown as MemberRow[]).filter(m => !excludedIds.has(m.user_id) && !submittedIds.has(m.user_id) && m.profiles?.email);

  // Nothing to send (everyone's submitted) — don't start the cooldown for
  // no reason, so a legitimate click right after the last holdout submits
  // isn't blocked.
  if (toRemind.length === 0) return { sent: 0, total: 0, skipped: false };

  if (!RESEND_API_KEY && (!GMAIL_USER || !GMAIL_APP_PASSWORD)) throw new Error('Reminder email is not configured.');
  const smtp = !RESEND_API_KEY ? new SMTPClient({ connection: { hostname: 'smtp.gmail.com', port: 465, tls: true, auth: { username: GMAIL_USER!, password: GMAIL_APP_PASSWORD! } } }) : null;
  let sent = 0;
  try {
  for (const m of toRemind) {
    const email = m.profiles!.email;
    const roleWord = m.role === 'big' ? 'Little' : 'Big';
    const greeting = m.profiles?.name ? `Hi ${m.profiles.name},` : 'Hi,';
    const cutoff = group.ranking_deadline_at || (group.ranking_deadline
      ? new Date(Date.parse(group.ranking_deadline + 'T00:00:00Z') + 86_400_000).toISOString() : null);
    const zone = group.ranking_deadline_timezone || 'UTC';
    const dueLine = cutoff ? ` — due ${new Intl.DateTimeFormat('en-US', {
      timeZone: zone, month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
    }).format(new Date(cutoff))} (${zone})` : '';

    if (smtp) {
      await smtp.send({ from: REMINDER_FROM, to: email,
        subject: `Reminder: submit your ${roleWord} rankings for ${group.name}${dueLine}`,
        content: `${greeting}\n\nYou haven't submitted your ${roleWord} rankings for ${group.name} yet${dueLine}.\n\n${APP_URL}/group/submit-ranking`,
      });
      sent++; continue;
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: REMINDER_FROM,
        to: email,
        subject: `Reminder: submit your ${roleWord} rankings for ${group.name}${dueLine}`,
        html: `<p>${greeting}</p>
<p>You haven't submitted your ${roleWord} rankings for <strong>${group.name}</strong> yet${dueLine}.</p>
<p><a href="${APP_URL}/group/submit-ranking">Submit your rankings</a></p>
<p style="color:#888;font-size:12px;">Sent by Sorora on behalf of ${group.name}.</p>`,
      }),
    });
    if (!res.ok) throw new Error('Reminder email delivery failed.');
    sent++;
  }
  } finally { if (smtp) await smtp.close(); }

  await admin.from('groups').update({ reminders_last_sent_at: new Date().toISOString() }).eq('id', group.id);

  return { sent, total: toRemind.length, skipped: false };
}

serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const body = await req.json().catch(() => ({}));

    // Scheduled sweep (service-role only — see README) walks every group
    // with a deadline set, so admins don't have to remember to click the
    // button themselves.
    if (body.all === true) {
      if (req.headers.get('Authorization') !== `Bearer ${SERVICE_ROLE_KEY}`) return json({ error: 'Service role required' }, 403);
      const { data: groups } = await admin
        .from('groups')
        .select('id, name, ranking_deadline, ranking_deadline_at, ranking_deadline_timezone, reminders_last_sent_at, active_cycle_id')
        .or('ranking_deadline.not.is.null,ranking_deadline_at.not.is.null');

      const results = await Promise.all((groups ?? []).map(g => remindGroup(admin, g)));
      const sent = results.reduce((sum, r) => sum + r.sent, 0);
      const skipped = results.filter(r => r.skipped).length;
      return json({ groups: groups?.length ?? 0, sent, skipped });
    }

    const { groupId } = body;
    if (!groupId) return json({ error: 'groupId is required' }, 400);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing Authorization header' }, 401);

    // A client scoped to the caller's own JWT — used only to confirm who
    // they are. The actual query/send below always goes through the
    // service-role `admin` client, never this one.
    const callerClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
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

    const { data: group, error: groupError } = await admin
      .from('groups')
      .select('id, name, ranking_deadline, ranking_deadline_at, ranking_deadline_timezone, reminders_last_sent_at, active_cycle_id')
      .eq('id', groupId)
      .single();
    if (groupError || !group) return json({ error: 'Group not found' }, 404);

    const result = await remindGroup(admin, group);
    if (result.skipped) {
      const minutes = Math.ceil((result.retryAfterSeconds ?? 0) / 60);
      return json(
        { error: `Reminders for this group were already sent recently. Try again in about ${minutes} minute${minutes === 1 ? '' : 's'}.` },
        429
      );
    }
    return json(result);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Unknown error' }, 500);
  }
});
