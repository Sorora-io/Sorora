import { supabase } from './supabase';

export interface RevealStatus {
  total: number;
  sent: number;
  lastSentAt: string | null;
  scheduledAt: string | null;
  completedAt: string | null;
}

export interface RevealSendResult {
  sent: number;
  total: number;
  bigs?: number;
  unsent?: number;
  failures?: string[];
}

export async function getPairingRevealStatus(
  groupId: string,
  cycleId: string,
): Promise<{ status: RevealStatus | null; error: string | null }> {
  const { data, error } = await supabase.rpc('get_pairing_reveal_status', {
    p_group_id: groupId,
    p_cycle_id: cycleId,
  });
  if (error) return { status: null, error: error.message };
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { status: { total: 0, sent: 0, lastSentAt: null, scheduledAt: null, completedAt: null }, error: null };
  return {
    status: {
      total: row.total ?? 0,
      sent: row.sent ?? 0,
      lastSentAt: row.last_sent_at ?? null,
      scheduledAt: row.scheduled_at ?? null,
      completedAt: row.completed_at ?? null,
    },
    error: null,
  };
}

// Invokes the send-pairing-reveal Edge Function — see the function's
// README for its deploy + Gmail SMTP setup. `supabase.functions.invoke`
// forwards the caller's own JWT, which the function uses to confirm they
// admin this group before sending anything.
export async function sendPairingReveal(
  groupId: string,
  cycleId: string,
): Promise<{ result: RevealSendResult | null; error: string | null }> {
  const { data, error } = await supabase.functions.invoke('send-pairing-reveal', {
    body: { groupId, cycleId },
  });
  if (error) return { result: null, error: error.message };
  if (data?.error) return { result: null, error: data.error };
  return { result: data as RevealSendResult, error: null };
}

export async function schedulePairingReveal(
  groupId: string,
  cycleId: string,
  when: Date,
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('schedule_pairing_reveal', {
    p_group_id: groupId,
    p_cycle_id: cycleId,
    p_when: when.toISOString(),
  });
  return { error: error?.message ?? null };
}

export async function cancelPairingReveal(
  groupId: string,
  cycleId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('cancel_pairing_reveal', {
    p_group_id: groupId,
    p_cycle_id: cycleId,
  });
  return { error: error?.message ?? null };
}
