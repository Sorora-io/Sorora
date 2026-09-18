import { useEffect, useRef, useState } from 'react';
import Button from './Button';
import { useAuth } from '../contexts/AuthContext';

const ARM_MS = 3000;

const AccountMenu = () => {
  const { signOut, user } = useAuth();
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const trigger = useRef<HTMLButtonElement>(null);
  const timer = useRef<number | undefined>(undefined);

  const displayName =
    (user?.user_metadata?.name as string | undefined)?.trim() || user?.email || '';

  useEffect(() => {
    if (!armed) return;
    timer.current = window.setTimeout(() => setArmed(false), ARM_MS);
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setArmed(false);
        trigger.current?.focus();
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
      {displayName && (
        <div className="flex min-w-0 items-center gap-2" title={`Signed in as ${displayName}`}>
          <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--ss-pill-bg)] text-xs font-medium text-[color:var(--ss-jade)]">
            {displayName.split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase()}
          </span>
          <span className="max-w-[9rem] truncate text-sm text-[color:var(--ss-ink-2)]" aria-label={`Signed in as ${displayName}`}>
            {displayName}
          </span>
        </div>
      )}
      <Button
        ref={trigger}
        variant={armed ? 'danger-outline' : 'ghost'}
        size="sm"
        onClick={handleClick}
        disabled={busy}
        aria-live="polite"
        className="!px-2 !text-xs"
      >
        {busy ? 'Signing out…' : armed ? 'Click again to confirm' : 'Sign out'}
      </Button>
      {error && <p role="alert" className="text-xs text-brick">{error}</p>}
    </div>
  );
};

export default AccountMenu;
