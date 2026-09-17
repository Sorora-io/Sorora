import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import Button from './Button';
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
        aria-expanded={open}
        aria-controls={id}
        onClick={() => { setError(''); setOpen(value => !value); }}
        className="inline-flex min-h-[44px] items-center justify-center gap-2 px-5 py-2 text-sm font-medium rounded-full border border-[color:var(--ss-jade-line)] bg-white/50 text-[color:var(--ss-ink-2)] hover:bg-white/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jade-700"
      >
        Sign out <ChevronDown size={16} aria-hidden="true" className={open ? 'rotate-180' : ''} />
      </button>
      {open && (
        <section id={id} aria-labelledby={`${id}-title`} className="absolute right-0 top-full z-50 mt-2 w-64 max-w-[calc(100vw-3rem)] rounded-2xl border border-[color:var(--ss-surface-border)] bg-[color:var(--ss-surface-hi)] p-4 shadow-lg text-left">
          <h2 id={`${id}-title`} className="text-base font-semibold text-[color:var(--ss-ink-2)]">Sign out?</h2>
          <div className="mt-4 flex gap-2">
            <Button variant="outline" size="sm" className="flex-1 !min-h-[44px]" disabled={busy} onClick={() => { setOpen(false); trigger.current?.focus(); }}>Cancel</Button>
            <Button size="sm" className="flex-1 !min-h-[44px]" onClick={handleSignOut} disabled={busy}>{busy ? 'Signing out…' : 'Confirm'}</Button>
          </div>
          {error && <p role="alert" className="mt-3 text-xs text-brick">{error}</p>}
        </section>
      )}
    </div>
  );
};

export default AccountMenu;
