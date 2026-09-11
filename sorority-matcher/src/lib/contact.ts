import { supabase } from './supabase';

// Public — no auth required, so this works for a signed-out prospect too.
// See supabase/functions/send-contact-message/README.md for the Resend
// setup this depends on.
export async function sendContactMessage(
  name: string,
  email: string,
  message: string
): Promise<{ error: string | null }> {
  const { data, error } = await supabase.functions.invoke('send-contact-message', {
    body: { name, email, message },
  });

  if (error) return { error: error.message };
  if (data?.error) return { error: data.error };
  return { error: null };
}
