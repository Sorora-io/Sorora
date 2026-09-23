import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import Button from './Button';
import Avatar from './Avatar';
import SuperuserLink from './SuperuserLink';
import { useMyProfile } from '../hooks/useMyProfile';
import { useAuth } from '../contexts/AuthContext';

const ARM_MS = 3000;

const AccountMenu = ({ superuserMode = false }: { superuserMode?: boolean }) => {
  const { signOut, user } = useAuth();
  const { data: profile } = useMyProfile();
  const [open, setOpen] = useState(false);
  const accountTrigger = useRef<HTMLButtonElement>(null);
  const accountContainer = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!accountContainer.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); accountTrigger.current?.focus(); }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const timer = useRef<number | undefined>(undefined);

  const displayName =
    profile?.name?.trim() || (user?.user_metadata?.name as string | undefined)?.trim() || user?.email || '';

  useEffect(() => {
    if (!armed) return;
    timer.current = window.setTimeout(() => setArmed(false), ARM_MS);
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setArmed(false);
        accountTrigger.current?.focus();
      }
    };
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('keydown', escape);
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [armed]);

  const handleClick = async () => {
    setError('');
    if (!armed) {
      setArmed(true);
      return;
    }
    setBusy(true);
    try {
      await signOut();
    } catch {
      setError('Could not sign out. Please try again.');
    } finally {
      setBusy(false);
      setArmed(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-left">
      <div ref={accountContainer} className="relative">
        <button ref={accountTrigger} type="button" onClick={() => setOpen(value => !value)}
          aria-label={`Account options for ${displayName || 'you'}`} aria-expanded={open}
          className="flex min-w-0 items-center gap-2 rounded-full px-2 py-1 hover:bg-white/60 transition-colors">
          <Avatar src={profile?.avatar_url} name={displayName} email={user?.email} size="sm" />
          <span className="max-w-[9rem] truncate text-sm text-[color:var(--ss-ink-2)]">
            {displayName || 'Account'}
          </span>
          <ChevronDown aria-hidden="true" size={14} className="block shrink-0 text-[color:var(--ss-ink-5)]" />
        </button>
        {open && (
          <div className="absolute right-0 top-full mt-2 z-50 min-w-[180px] rounded-2xl border border-[color:var(--ss-input-border)] bg-white p-2 shadow-lg" onClick={event => { if ((event.target as HTMLElement).closest('a')) setOpen(false); }}>
            {superuserMode ? (
              <a href="/dashboard" className="block rounded-xl px-3 py-2 text-sm text-[color:var(--ss-ink-2)] hover:bg-stone-100">Main app</a>
            ) : <>
            <a href="/profile" className="block rounded-xl px-3 py-2 text-sm text-[color:var(--ss-ink-2)] hover:bg-stone-100">My profile</a>
            <SuperuserLink />
            </>}
      <Button
        variant={armed ? 'danger-outline' : 'ghost'}
        size="sm"
        onClick={handleClick}
        disabled={busy}
        aria-live="polite"
        className="!w-full !justify-start !rounded-xl !px-3 !text-sm"
      >
        {busy ? 'Signing out…' : armed ? 'Click again to confirm' : 'Sign out'}
      </Button>
      {error && <p role="alert" className="text-xs text-brick">{error}</p>}
          </div>
        )}
      </div>

    </div>
  );
};

export default AccountMenu;
