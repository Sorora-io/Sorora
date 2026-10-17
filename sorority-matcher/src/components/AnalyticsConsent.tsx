import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Button from './Button';
import { CONSENT_EVENT, CONSENT_KEY, getConsent, initializeAnalytics, isAnalyticsEnabled, setConsent, syncConsent, trackPage } from '../lib/analytics';

export default function AnalyticsConsent() {
  const [consent, updateConsent] = useState(getConsent);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const { loading } = useAuth();
  const { pathname } = useLocation();
  const preferences = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const refresh = () => { syncConsent(); updateConsent(getConsent()); };
    const storage = (event: StorageEvent) => { if (event.key === CONSENT_KEY || event.key === null) refresh(); };
    window.addEventListener(CONSENT_EVENT, refresh);
    window.addEventListener('storage', storage);
    return () => { window.removeEventListener(CONSENT_EVENT, refresh); window.removeEventListener('storage', storage); };
  }, []);
  useEffect(() => {
    if (!loading && isAnalyticsEnabled() && initializeAnalytics()) trackPage(pathname);
  }, [consent, loading, pathname]);
  useEffect(() => { if (editing) heading.current?.focus(); }, [editing]);
  const choose = (choice: 'accepted' | 'declined') => {
    if (!setConsent(choice)) { setError('Your browser could not save this choice. Optional analytics remain off.'); return; }
    setError(''); setEditing(false); preferences.current?.focus();
  };
  return <aside aria-label="Analytics preferences" className="w-full px-5 md:px-8 pb-6">
    <div className="mx-auto max-w-4xl">
      <Button ref={preferences} variant="ghost" size="sm" onClick={() => setEditing(true)} aria-expanded={editing}>Analytics preferences</Button>
      {editing && <section aria-labelledby="analytics-heading" className="mt-3 rounded-2xl border border-[color:var(--ss-surface-border)] bg-white p-5 shadow-sm">
        <h2 ref={heading} tabIndex={-1} id="analytics-heading" className="font-display text-2xl">Analytics preferences</h2>
        <p className="mt-2 text-sm text-[color:var(--ss-ink-3)]">Sorora uses Mixpanel to understand page visits and actions such as signing in, submitting rankings, and running matching. We use a random browser identifier, never your account ID, name, email, ranking choices, or pairing details.</p>
        <p className="mt-2 text-sm text-[color:var(--ss-ink-3)]">Your choice is saved in this browser. Change it here anytime. Sorora works either way.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button variant="outline" size="sm" onClick={() => choose('declined')}>Decline analytics</Button>
          <Button variant="outline" size="sm" onClick={() => choose('accepted')}>Allow analytics</Button>
          <Button variant="ghost" size="sm" onClick={() => { setEditing(false); preferences.current?.focus(); }}>Close</Button>
        </div>
        {error && <p role="alert" className="mt-3 text-sm">{error}</p>}
      </section>}
    </div>
  </aside>;
}
