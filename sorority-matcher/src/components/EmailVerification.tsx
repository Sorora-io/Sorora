import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import Button from './Button';

export default function EmailVerification() {
  const { user } = useAuth();
  const client = useQueryClient();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const status = useQuery({
    queryKey: ['email-verification', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      if (!data.user || data.user.id !== user?.id) throw new Error('Please sign in again to check your email.');
      return { email: data.user.email, verified: !!data.user.email_confirmed_at };
    },
    enabled: !!user, staleTime: 0, refetchOnWindowFocus: true, retry: false,
  });
  useEffect(() => {
    if (!status.data?.verified) return;
    void client.invalidateQueries({ queryKey: ['superuser'] });
    void client.invalidateQueries({ queryKey: ['superuser-accounts'] });
  }, [status.data?.verified, client]);
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown(value => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);
  const send = async () => {
    if (!status.data?.email || sending || cooldown > 0 || status.data.verified) return;
    setSending(true); setError('');
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup', email: status.data.email,
        options: { emailRedirectTo: `${window.location.origin}/profile` },
      });
      if (error) throw error;
      setSent(true); setCooldown(60);
      toast.success('Verification email sent', { duration: 2500 });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not send verification email. Please try again.');
    } finally { setSending(false); }
  };
  const check = async () => {
    setError('');
    const result = await status.refetch();
    if (result.data?.verified && !result.error) toast.success('Email verified', { duration: 2500 });
    else if (!result.error) setError('Your email is not verified yet. Open the latest verification email and follow its link, then check again.');
  };
  return <section aria-label="Email verification" className="mt-4 rounded-xl border border-[color:var(--ss-surface-border)] bg-white/60 p-5 sm:p-7">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="font-display text-xl">Email verification</h2>
      {status.data && <span className="ss-pill">{status.data.verified ? 'Verified' : 'Not verified'}</span>}
    </div>
    <p className="mt-2 text-sm break-words">{status.data?.email || user?.email}</p>
    {status.isPending ? <p role="status" className="mt-3 ss-caption">Checking verification…</p> : status.error ? <>
      <p role="alert" className="mt-3 text-sm text-brick">Could not check verification: {status.error.message}</p>
      <Button size="sm" variant="outline" className="mt-3" disabled={status.isFetching} onClick={() => void check()}>Try again</Button>
    </> : status.data?.verified ? <p className="mt-3 ss-caption">Your email address is verified. You’re all set.</p> : <>
      <p className="mt-3 ss-caption">{sent ? 'Check your inbox and spam folder. Open the verification link, then return here to check your status.' : 'Verify your email address by opening the link we send to your inbox.'}</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Button size="sm" disabled={sending || cooldown > 0 || !status.data?.email} onClick={() => void send()}>{sending ? 'Sending…' : cooldown > 0 ? `Resend in ${cooldown}s` : sent ? 'Resend verification email' : 'Send verification email'}</Button>
        <Button size="sm" variant="outline" disabled={status.isFetching || sending} onClick={() => void check()}>{status.isFetching ? 'Checking…' : 'I’ve verified my email'}</Button>
      </div>
    </>}
    {error && <p role="alert" className="mt-3 text-sm text-brick">{error}</p>}
  </section>;
}
