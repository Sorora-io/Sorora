import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const AccountMenu = () => {
  const { signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  const handleSignOut = async () => {
    setBusy(true);
    setError('');
    try {
      await signOut();
      setOpen(false);
    } catch {
      setError('Could not sign out. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={container} className="relative shrink-0" onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false);
    }}>
      <button
        ref={trigger}
        type="button"
        aria-label={open ? 'Close navigation' : 'Open navigation'}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(value => !value)}
        className="flex h-11 w-11 items-center justify-center rounded-full border border-[color:var(--ss-jade-line)] bg-white/50 text-[color:var(--ss-ink-2)] hover:bg-white/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jade-700"
      >
        {open ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
      </button>
      {open && (
        <nav id={id} aria-label="Account navigation" className="absolute right-0 top-full z-50 mt-2 w-56 max-w-[calc(100vw-3rem)] rounded-2xl border border-[color:var(--ss-surface-border)] bg-[color:var(--ss-surface-hi)] p-2 shadow-lg text-left">
          {['Dashboard', 'Profile', 'Rankings', 'Roster', 'FAQ'].map(label => (
            <Link key={label} to={`/dashboard?tab=${label.toLowerCase()}`} onClick={() => setOpen(false)} className="flex min-h-[44px] items-center rounded-xl px-4 py-2 text-sm text-[color:var(--ss-ink-2)] hover:bg-[color:var(--ss-pill-bg)] focus-visible:bg-[color:var(--ss-pill-bg)]">
              {label}
            </Link>
          ))}
          <div className="mt-1 border-t border-[color:var(--ss-surface-border)] pt-1">
            <button type="button" onClick={handleSignOut} disabled={busy} className="flex min-h-[44px] w-full items-center gap-3 rounded-xl px-4 py-2 text-sm text-brick hover:bg-brick-50 disabled:opacity-50">
              <LogOut size={16} aria-hidden="true" />{busy ? 'Signing out…' : 'Sign out'}
            </button>
            {error && <p role="alert" className="px-4 py-2 text-xs text-brick">{error}</p>}
          </div>
        </nav>
      )}
    </div>
  );
};

export default AccountMenu;
