import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useGroup } from '../contexts/GroupContext';
import { getMyProfile } from '../lib/profile';
import { queryKeys } from '../lib/queryKeys';

const STEPS = [
  'Add or invite your members',
  'Collect everyone’s preferences',
  'Review and generate pairings',
];

const Index = () => {
  const navigate = useNavigate();
  const { user, isGuest, signOut } = useAuth();
  const { memberships } = useGroup();
  const [signOutConfirming, setSignOutConfirming] = useState(false);
  const [logoSpinning, setLogoSpinning] = useState(false);

  // Shares its cache key with Dashboard, so a signed-in visitor lands on a
  // warm cache instead of triggering a fresh fetch just to say their name.
  const { data: profile } = useQuery({
    queryKey: queryKeys.myProfile(),
    queryFn: () => getMyProfile().then(({ profile: p }) => p),
    enabled: !!user && !isGuest,
  });

  return (
    <div className="min-h-screen flex flex-col items-center p-8">
      <header className="mb-12 w-full max-w-2xl flex items-center justify-between">
        <h1 className="text-4xl font-display font-semibold text-jade-800">Sorora</h1>
        {user ? (
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user.email}</span>
            {signOutConfirming ? (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500">Sign out?</span>
                <button onClick={() => signOut()} className="font-medium text-brick hover:underline">
                  Yes
                </button>
                <button onClick={() => setSignOutConfirming(false)} className="text-gray-500 hover:underline">
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setSignOutConfirming(true)}
                className="px-4 py-2 border border-jade-600 rounded-md hover:bg-jade-50 transition-colors text-sm"
              >
                Sign out
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={() => navigate('/login')}
            className="px-4 py-2 bg-jade-600 text-white rounded-md hover:bg-jade-700 transition-colors text-sm"
          >
            Sign in
          </button>
        )}
      </header>

      {user && !isGuest ? (
        <div className="max-w-2xl w-full bg-white rounded-lg shadow-sm p-5 md:p-10 text-center">
          <svg
            width="56" height="32" viewBox="0 0 72 40" fill="none"
            className="mx-auto mb-4 cursor-pointer"
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
            <circle cx="36" cy="20" r="6" fill="#296F62" />
          </svg>
          <h2 className="text-2xl font-display font-semibold mb-2 text-jade-800">
            Welcome back{profile?.name ? `, ${profile.name}` : ''}.
          </h2>
          <p className="text-gray-600 mb-8">
            {memberships.length > 0
              ? `You're part of ${memberships.length} ${memberships.length === 1 ? 'chapter' : 'chapters'}.`
              : "You're not part of a chapter yet."}
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-2">
            <button
              onClick={() => navigate('/dashboard')}
              className="px-6 py-2.5 bg-jade-600 text-white rounded-md hover:bg-jade-700 transition-colors font-medium"
            >
              Go to Dashboard
            </button>
          </div>
          <button
            onClick={() => navigate('/admin/enter-bigs')}
            className="text-sm text-gray-500 underline hover:text-black"
          >
            Or run a one-off quick match
          </button>

          {memberships.length > 0 && (
            <div className="mt-8 pt-6 border-t border-gray-100 flex flex-col gap-1 text-left max-w-sm mx-auto">
              {memberships.slice(0, 4).map(m => (
                <button
                  key={m.id}
                  onClick={() => navigate('/dashboard')}
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-md text-sm text-gray-700 hover:bg-jade-50 transition-colors"
                >
                  <span className="min-w-0 text-left">
                    <span className="block truncate">{m.group.name}</span>
                    {m.group.school && <span className="block text-xs text-gray-400 truncate">{m.group.school}</span>}
                  </span>
                  <span className="flex-shrink-0 text-gray-400">→</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="max-w-2xl w-full bg-white rounded-lg shadow-sm p-5 md:p-10 text-center">
          <svg
            width="72" height="40" viewBox="0 0 72 40" fill="none"
            className="mx-auto mb-4 cursor-pointer"
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
            <circle cx="36" cy="20" r="6" fill="#296F62" />
          </svg>
          <h2 className="text-3xl font-display font-semibold mb-3 text-jade-800">
            Big–Little matching, without the spreadsheets.
          </h2>
          <p className="text-gray-600 text-lg mb-8">
            Collect preferences, account for twins, and create thoughtful matches for your chapter.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-4">
            <button
              onClick={() => navigate('/login?mode=signup')}
              className="px-6 py-2.5 bg-jade-600 text-white rounded-md hover:bg-jade-700 transition-colors font-medium"
            >
              Set up my chapter
            </button>
            <button
              onClick={() => navigate('/admin/enter-bigs')}
              className="px-6 py-2.5 border border-jade-300 rounded-md hover:bg-jade-50 transition-colors font-medium"
            >
              Run a quick match
            </button>
          </div>

          <button
            onClick={() => navigate('/login')}
            className="text-sm text-gray-500 underline hover:text-black"
          >
            I already have an account
          </button>

          <div className="mt-10 pt-8 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
            {STEPS.map((step, i) => (
              <div key={step} className="flex gap-3 items-start">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-jade-100 text-jade-700 text-sm font-semibold flex items-center justify-center">
                  {i + 1}
                </span>
                <p className="text-sm text-gray-600">{step}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 flex gap-4 text-sm text-gray-500">
        <button onClick={() => navigate('/about')} className="underline hover:text-black">
          How It Works
        </button>
        <span aria-hidden="true">·</span>
        <button onClick={() => navigate('/faq')} className="underline hover:text-black">
          FAQ
        </button>
        <span aria-hidden="true">·</span>
        <button onClick={() => navigate('/contact')} className="underline hover:text-black">
          Contact Us
        </button>
      </div>
    </div>
  );
};

export default Index;
