import { supabase } from './supabase';

export interface ReminderResult {
  sent: number;
  total: number;
}

// Calls the send-ranking-reminders Edge Function (supabase/functions/) —
// see its README for the one-time Resend/deploy setup this depends on.
// supabase.functions.invoke forwards the caller's own session JWT, which
// the function uses to confirm they're actually an admin of this group
// before sending anything.
export async function sendRankingReminders(
  groupId: string
): Promise<{ result: ReminderResult | null; error: string | null }> {
  const { data, error } = await supabase.functions.invoke('send-ranking-reminders', {
    body: { groupId },
  });

  if (error) {
    return { result: null, error: error.message };
  }
  if (data?.error) {
    return { result: null, error: data.error };
  }
  return { result: data as ReminderResult, error: null };
}
