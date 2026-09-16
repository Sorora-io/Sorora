import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useGroup } from '../contexts/GroupContext';
import { getMyProfile } from '../lib/profile';
import { queryKeys } from '../lib/queryKeys';
import Button from '../components/Button';

const STEPS = [
  { kicker: '01', label: 'Add or invite your members' },
  { kicker: '02', label: 'Collect everyone’s preferences' },
  { kicker: '03', label: 'Review and generate pairings' },
];

const Index = () => {
  const navigate = useNavigate();
  const { user, isGuest, signOut } = useAuth();
  const { memberships } = useGroup();
  const [signOutConfirming, setSignOutConfirming] = useState(false);
  const [logoSpinning, setLogoSpinning] = useState(false);

  const { data: profile } = useQuery({
    queryKey: queryKeys.myProfile(),
    queryFn: () => getMyProfile().then(({ profile: p }) => p),
    enabled: !!user && !isGuest,
  });

  const signedIn = !!user && !isGuest;

  return (
    <div className="min-h-screen w-full flex flex-col items-center px-6 py-10">
      <header className="w-full max-w-3xl mb-8 flex items-center justify-between">
        <span className="font-display text-xl font-semibold text-[color:var(--ss-ink-1)] tracking-wide">
          sorora
        </span>
        {signedIn ? (
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-sm text-[color:var(--ss-ink-5)]">{user!.email}</span>
            {signOutConfirming ? (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-[color:var(--ss-ink-5)]">Sign out?</span>
                <button onClick={() => signOut()} className="font-medium text-brick hover:underline">
                  Yes
                </button>
                <button onClick={() => setSignOutConfirming(false)} className="text-[color:var(--ss-ink-5)] hover:underline">
                  Cancel
                </button>
              </div>
            ) : (
              <Button variant="quiet" size="sm" onClick={() => setSignOutConfirming(true)}>
                Sign out
              </Button>
            )}
          </div>
        ) : (
          <Button variant="quiet" size="sm" onClick={() => navigate('/login')}>
            Sign in
          </Button>
        )}
      </header>

      <section className="ss-frost w-full max-w-3xl rounded-[28px] px-6 py-14 md:px-16 md:py-20 text-center shadow-card">
        <svg
          width="72" height="40" viewBox="0 0 72 40" fill="none"
          className="mx-auto mb-8 cursor-pointer"
          role="button"
          aria-label="Spin the Sorora logo"
          onClick={() => setLogoSpinning(true)}
        >
          <g
            className={logoSpinning ? 'animate-logo-spin-once' : ''}
            style={{ transformOrigin: '36px 20px' }}
            onAnimationEnd={() => setLogoSpinning(false)}
          >
            <circle cx="24" cy="20" r="14" fill="#DCEDE8" />
            <circle cx="48" cy="20" r="14" fill="#F2E6C6" />
          </g>
          <circle cx="36" cy="20" r="6" fill="#173e2a" />
        </svg>

        {signedIn ? (
          <>
            <h1 className="font-display text-[44px] md:text-[56px] leading-[1.05] font-semibold text-[color:var(--ss-ink-1)] mb-4">
              Welcome back{profile?.name ? `, ${profile.name.split(' ')[0]}` : ''}.
            </h1>
            <p className="text-[color:var(--ss-ink-5)] text-lg mb-10 max-w-md mx-auto">
              {memberships.length > 0
                ? `You're part of ${memberships.length} ${memberships.length === 1 ? 'chapter' : 'chapters'}. Everything you need is a click away.`
                : "You haven't joined a chapter yet. Start below."}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={() => navigate('/dashboard')}>
                Go to my dashboard
              </Button>
              <Button variant="link" onClick={() => navigate('/admin/enter-bigs')}>
                Or run a one-off quick match
              </Button>
            </div>

            {memberships.length > 0 && (
              <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-3 text-left max-w-xl mx-auto">
                {memberships.slice(0, 4).map(m => (
                  <button
                    key={m.id}
                    onClick={() => navigate('/dashboard')}
                    className="ss-surface hover:bg-white/60 transition-colors flex items-center justify-between gap-3"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-[color:var(--ss-ink-2)]">
                        {m.group.name}
                      </span>
                      {m.group.school && (
                        <span className="block text-xs text-[color:var(--ss-ink-5)] truncate">
                          {m.group.school}
                        </span>
                      )}
                    </span>
                    <span className="flex-shrink-0 text-[color:var(--ss-ink-5)]">→</span>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <h1 className="font-display text-[54px] md:text-[76px] leading-[0.95] font-semibold text-[color:var(--ss-ink-1)] mb-6 tracking-tight">
              sorora
            </h1>
            <p className="text-[color:var(--ss-ink-4)] text-lg md:text-xl mb-10 max-w-lg mx-auto">
              Big–Little matching for your chapter, without the spreadsheets.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
              <Button onClick={() => navigate('/login?mode=signup')}>
                Meet sorora ↓
              </Button>
              <Button variant="quiet" onClick={() => navigate('/admin/enter-bigs')}>
                Run a quick match
              </Button>
            </div>
            <button
              onClick={() => navigate('/login')}
              className="mt-6 text-sm text-[color:var(--ss-ink-5)] hover:text-[color:var(--ss-ink-2)] underline underline-offset-4"
            >
              I already have an account
            </button>

            <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-3 text-left">
              {STEPS.map(step => (
                <div key={step.kicker} className="ss-surface">
                  <div className="ss-kicker">{step.kicker}</div>
                  <p className="text-[color:var(--ss-ink-2)] font-medium leading-snug">
                    {step.label}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <nav className="mt-8 flex gap-5 text-sm text-[color:var(--ss-ink-5)]">
        <button onClick={() => navigate('/about')} className="underline underline-offset-4 hover:text-[color:var(--ss-ink-2)]">
          How It Works
        </button>
        <span aria-hidden="true">·</span>
        <button onClick={() => navigate('/faq')} className="underline underline-offset-4 hover:text-[color:var(--ss-ink-2)]">
          FAQ
        </button>
        <span aria-hidden="true">·</span>
        <button onClick={() => navigate('/contact')} className="underline underline-offset-4 hover:text-[color:var(--ss-ink-2)]">
          Contact Us
        </button>
      </nav>
    </div>
  );
};

export default Index;
