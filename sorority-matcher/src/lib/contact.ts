import { supabase } from './supabase';

// Public — no auth required, so this works for a signed-out prospect too.
// See supabase/functions/send-contact-message/README.md for the Gmail SMTP
// setup this depends on.
//
// `website` is the form's honeypot: real visitors never see the field, so
// forward whatever they typed (empty for humans, filled for the naive bot
// that types into every input). The Edge Function reports success without
// sending anything when it's filled.
export async function sendContactMessage(
  name: string,
  email: string,
  message: string,
  website: string = ''
): Promise<{ error: string | null }> {
  const { data, error } = await supabase.functions.invoke('send-contact-message', {
    body: { name, email, message, website },
  });

  if (error) return { error: error.message };
  if (data?.error) return { error: data.error };
  return { error: null };
}
