import { useEffect, useRef, useState } from 'react';
import Button from './Button';
import { useAuth } from '../contexts/AuthContext';

const ARM_MS = 3000;

const AccountMenu = () => {
  const { signOut } = useAuth();
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const trigger = useRef<HTMLButtonElement>(null);
  const timer = useRef<number | undefined>(undefined);

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
    <div className="shrink-0 flex flex-col items-end gap-1">
      <Button
        ref={trigger}
        variant={armed ? 'danger-outline' : 'outline'}
        size="sm"
        onClick={handleClick}
        disabled={busy}
        aria-live="polite"
        className="min-w-[10rem]"
      >
        {busy ? 'Signing out…' : armed ? 'Click again to confirm' : 'Sign out'}
      </Button>
      {error && <p role="alert" className="text-xs text-brick">{error}</p>}
    </div>
  );
};

export default AccountMenu;
