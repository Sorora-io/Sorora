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

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const REMINDER_FROM = Deno.env.get('REMINDER_FROM') ?? 'Sorora <onboarding@resend.dev>';
const APP_URL = Deno.env.get('APP_URL') ?? 'https://sorora.vercel.app';

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

async function remindGroup(
  admin: ReturnType<typeof createClient>,
  group: { id: string; name: string; ranking_deadline: string | null }
) {
  const { data: members } = await admin
    .from('memberships')
    .select('user_id, role, profiles(email, name)')
    .eq('group_id', group.id)
    .eq('status', 'approved')
    .in('role', ['big', 'little']);

  if (!members || members.length === 0) return { sent: 0, total: 0 };

  const { data: rankings } = await admin.from('rankings').select('ranker_id').eq('group_id', group.id);
  const submittedIds = new Set((rankings ?? []).map(r => r.ranker_id as string));

  const toRemind = (members as unknown as MemberRow[]).filter(m => !submittedIds.has(m.user_id) && m.profiles?.email);

  let sent = 0;
  for (const m of toRemind) {
    const email = m.profiles!.email;
    const roleWord = m.role === 'big' ? 'Little' : 'Big';
    const greeting = m.profiles?.name ? `Hi ${m.profiles.name},` : 'Hi,';
    const dueLine = group.ranking_deadline
      ? ` — due ${new Date(group.ranking_deadline + 'T00:00:00').toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}`
      : '';

    if (!RESEND_API_KEY) continue; // dry-run mode if no key is configured yet

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
    if (res.ok) sent++;
  }

  return { sent, total: toRemind.length };
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
      const { data: groups } = await admin
        .from('groups')
        .select('id, name, ranking_deadline')
        .not('ranking_deadline', 'is', null);

      const results = await Promise.all((groups ?? []).map(g => remindGroup(admin, g)));
      const sent = results.reduce((sum, r) => sum + r.sent, 0);
      return json({ groups: groups?.length ?? 0, sent });
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
      .select('id, name, ranking_deadline')
      .eq('id', groupId)
      .single();
    if (groupError || !group) return json({ error: 'Group not found' }, 404);

    const result = await remindGroup(admin, group);
    return json(result);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Unknown error' }, 500);
  }
});
