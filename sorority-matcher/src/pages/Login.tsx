import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { stashPendingGroupAction } from '../contexts/GroupContext';
import { findGroupByJoinCode, groupLabel, MembershipRole } from '../lib/groups';
import Button from '../components/Button';

const Login = () => {
  const navigate = useNavigate();
  const { signIn, signUp, continueAsGuest, sendPasswordReset } = useAuth();
  const [searchParams] = useSearchParams();
  const joinCodeFromLink = searchParams.get('join')?.toUpperCase() ?? '';
  const modeFromLink = searchParams.get('mode');

  const [mode, setMode] = useState<'signin' | 'signup'>(
    joinCodeFromLink || modeFromLink === 'signup' ? 'signup' : 'signin'
  );
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showGuestWarning, setShowGuestWarning] = useState(false);

  const [groupMode, setGroupMode] = useState<'create' | 'join'>(joinCodeFromLink ? 'join' : 'create');
  const [groupName, setGroupName] = useState('');
  const [school, setSchool] = useState('');
  const [joinCode, setJoinCode] = useState(joinCodeFromLink);
  const [role, setRole] = useState<MembershipRole>('big');
  const [invitedGroupLabel, setInvitedGroupLabel] = useState('');

  const [forgotMode, setForgotMode] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    if (!joinCodeFromLink) return;
    findGroupByJoinCode(joinCodeFromLink).then(({ group }) => {
      if (group) setInvitedGroupLabel(groupLabel(group));
    });
  }, [joinCodeFromLink]);

  const handleContinueAsGuest = () => {
    continueAsGuest();
    navigate('/admin/enter-bigs');
  };

  const handleSendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true);
    setResetError('');
    const { error } = await sendPasswordReset(resetEmail.trim());
    if (error) {
      setResetError(error.message);
    } else {
      setResetSent(true);
    }
    setResetLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setLoading(true);

    if (mode === 'signup') {
      if (groupMode === 'create' && groupName.trim() === '') {
        setError('Please enter a name for your sorority group.');
        setLoading(false);
        return;
      }
      if (groupMode === 'create' && school.trim() === '') {
        setError('Please enter the school this chapter is at.');
        setLoading(false);
        return;
      }

      let resolvedGroupId: string | undefined;
      let resolvedGroupLabel: string | undefined;
      if (groupMode === 'join') {
        if (joinCode.trim() === '') {
          setError("Please enter your group's join code.");
          setLoading(false);
          return;
        }
        const { group, error: codeError } = await findGroupByJoinCode(joinCode);
        if (codeError || !group) {
          setError(codeError ?? 'No group found with that code.');
          setLoading(false);
          return;
        }
        resolvedGroupId = group.id;
        resolvedGroupLabel = groupLabel(group);
      }

      const { error } = await signUp(email, password, name);
      if (error) {
        setError(error.message);
      } else {
        stashPendingGroupAction(
          groupMode === 'create'
            ? { mode: 'create', groupName: groupName.trim(), school: school.trim() }
            : { mode: 'join', groupId: resolvedGroupId, role }
        );
        setSuccessMessage(
          groupMode === 'create'
            ? 'Check your email to confirm your account. Once confirmed, your group will be created automatically.'
            : `Check your email to confirm your account. Once confirmed, your request to join ${resolvedGroupLabel} will be submitted automatically.`
        );
        setMode('signin');
      }
    } else {
      const { error } = await signIn(email, password);
      if (error) {
        setError(error.message);
      } else {
        navigate('/group/onboarding');
      }
    }

    setLoading(false);
  };

  const kicker = forgotMode
    ? 'Reset your password'
    : mode === 'signin'
    ? 'Sign back in'
    : groupMode === 'create'
    ? 'Set up your chapter'
    : 'Join your chapter';

  const heading = forgotMode
    ? 'Send me a reset link.'
    : mode === 'signin'
    ? 'Welcome back to sorora.'
    : "Make yourself at home.";

  const subheading = forgotMode
    ? "Enter your email and we'll send you a link to set a new password."
    : mode === 'signin'
    ? 'Sign in to jump back into your chapter.'
    : 'Start with the basics. You can add more to your profile later.';

  return (
    <div className="min-h-screen w-full flex flex-col items-center px-6 py-10">
      <header className="w-full max-w-xl mb-6 flex items-center justify-between">
        <Link
          to="/"
          className="font-display text-xl font-semibold text-[color:var(--ss-ink-1)] tracking-wide"
        >
          sorora
        </Link>
        <Link to="/" className="text-sm text-[color:var(--ss-ink-5)] hover:text-[color:var(--ss-ink-2)] underline underline-offset-4">
          Start over
        </Link>
      </header>

      <section className="ss-frost w-full max-w-xl rounded-[24px] px-6 py-10 md:px-10 md:py-12 shadow-card">
        <div className="ss-kicker">{kicker}</div>
        <h1 className="font-display text-[32px] md:text-[38px] leading-[1.1] font-semibold text-[color:var(--ss-ink-1)] mb-2">
          {heading}
        </h1>
        <p className="text-[color:var(--ss-ink-5)] mb-6">{subheading}</p>

        {!forgotMode && invitedGroupLabel && (
          <p className="mb-5 ss-surface text-[color:var(--ss-ink-2)] text-sm">
            You've been invited to join <strong>{invitedGroupLabel}</strong>. Create an account below to request to join.
          </p>
        )}

        {!forgotMode && successMessage && (
          <p className="mb-5 ss-surface text-[color:var(--ss-ink-2)] text-sm">
            {successMessage}
          </p>
        )}

        {forgotMode ? (
          resetSent ? (
            <div className="flex flex-col gap-4">
              <p className="ss-surface text-[color:var(--ss-ink-2)] text-sm">
                Check {resetEmail} for a link to set a new password.
              </p>
              <button
                onClick={() => { setForgotMode(false); setResetSent(false); setResetEmail(''); }}
                className="text-sm text-[color:var(--ss-ink-5)] underline underline-offset-4 hover:text-[color:var(--ss-ink-2)] self-start"
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <form onSubmit={handleSendReset} className="flex flex-col gap-4">
              <div>
                <label className="ss-label" htmlFor="reset-email">Email</label>
                <input
                  id="reset-email"
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="ss-input"
                />
              </div>
              {resetError && <p className="text-[color:var(--ss-error)] text-sm">{resetError}</p>}
              <Button type="submit" disabled={resetLoading} fullWidth>
                {resetLoading ? '...' : 'Send reset link'}
              </Button>
              <button
                type="button"
                onClick={() => { setForgotMode(false); setResetError(''); }}
                className="text-sm text-[color:var(--ss-ink-5)] underline underline-offset-4 hover:text-[color:var(--ss-ink-2)] self-start"
              >
                Back to sign in
              </button>
            </form>
          )
        ) : (
          <>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {mode === 'signup' && (
                <div>
                  <label className="ss-label" htmlFor="name">Name</label>
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="ss-input"
                  />
                </div>
              )}

              {mode === 'signup' && (
                <div className="ss-surface">
                  <div className="ss-kicker">Your chapter</div>
                  <div className="flex gap-2 mb-4 p-1 rounded-pill bg-white/50 border border-[color:var(--ss-input-border)]">
                    <button
                      type="button"
                      onClick={() => setGroupMode('create')}
                      className={`flex-1 py-2 rounded-pill text-sm font-medium transition-colors ${
                        groupMode === 'create'
                          ? 'bg-[color:var(--ss-jade-deep)] text-white'
                          : 'text-[color:var(--ss-ink-4)] hover:bg-white/50'
                      }`}
                    >
                      Create a chapter
                    </button>
                    <button
                      type="button"
                      onClick={() => setGroupMode('join')}
                      className={`flex-1 py-2 rounded-pill text-sm font-medium transition-colors ${
                        groupMode === 'join'
                          ? 'bg-[color:var(--ss-jade-deep)] text-white'
                          : 'text-[color:var(--ss-ink-4)] hover:bg-white/50'
                      }`}
                    >
                      Join a chapter
                    </button>
                  </div>

                  {groupMode === 'create' ? (
                    <div className="flex flex-col gap-3">
                      <div>
                        <label className="ss-label" htmlFor="group-name">Sorority group name</label>
                        <input
                          id="group-name"
                          type="text"
                          value={groupName}
                          onChange={(e) => setGroupName(e.target.value)}
                          placeholder="e.g. Alpha Chi Omega"
                          className="ss-input"
                        />
                      </div>
                      <div>
                        <label className="ss-label" htmlFor="school">School</label>
                        <input
                          id="school"
                          type="text"
                          value={school}
                          onChange={(e) => setSchool(e.target.value)}
                          placeholder="e.g. New York University"
                          className="ss-input"
                        />
                      </div>
                      <p className="ss-caption">
                        You'll become this chapter's admin and get a join code to share.
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      <div>
                        <label className="ss-label" htmlFor="join-code">Chapter code</label>
                        <input
                          id="join-code"
                          type="text"
                          value={joinCode}
                          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                          placeholder="e.g. XK7P2QRT"
                          className="ss-input uppercase tracking-widest"
                        />
                      </div>
                      <div>
                        <span className="ss-label">I'm a</span>
                        <div className="flex gap-2">
                          {(['big', 'little', 'admin'] as const).map(r => (
                            <button
                              key={r}
                              type="button"
                              onClick={() => setRole(r)}
                              aria-pressed={role === r}
                              className={`flex-1 py-2 rounded-pill text-sm font-medium border transition-colors ${
                                role === r
                                  ? 'bg-[color:var(--ss-jade-deep)] text-white border-transparent'
                                  : 'bg-white/50 text-[color:var(--ss-ink-4)] border-[color:var(--ss-input-border)] hover:bg-white/70'
                              }`}
                            >
                              {r === 'big' ? 'Big' : r === 'little' ? 'Little' : 'Admin'}
                            </button>
                          ))}
                        </div>
                      </div>
                      <p className="ss-caption">
                        The chapter's admin will need to approve you before you can rank.
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="ss-label" htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="ss-input"
                />
              </div>

              <div>
                <label className="ss-label" htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="ss-input"
                />
                {mode === 'signin' && (
                  <button
                    type="button"
                    onClick={() => { setForgotMode(true); setError(''); }}
                    className="mt-2 text-sm text-[color:var(--ss-ink-5)] underline underline-offset-4 hover:text-[color:var(--ss-ink-2)]"
                  >
                    Forgot password?
                  </button>
                )}
              </div>

              {error && (
                <p className="text-[color:var(--ss-error)] text-sm">{error}</p>
              )}

              <Button type="submit" disabled={loading} fullWidth>
                {loading ? '...' : mode === 'signin' ? 'Sign in' : 'Create my profile'}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-[color:var(--ss-ink-5)]">
              {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}{' '}
              <button
                onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setSuccessMessage(''); }}
                className="underline underline-offset-4 font-medium text-[color:var(--ss-ink-2)]"
              >
                {mode === 'signin' ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </>
        )}

        {!forgotMode && (
          <div className="mt-8 pt-6 border-t border-[color:var(--ss-surface-border)]">
            {!showGuestWarning ? (
              <button
                onClick={() => setShowGuestWarning(true)}
                className="w-full text-center text-sm text-[color:var(--ss-ink-5)] underline underline-offset-4 hover:text-[color:var(--ss-ink-2)]"
              >
                Continue without an account
              </button>
            ) : (
              <div className="ss-surface text-sm">
                <h3 className="font-semibold mb-2 text-[color:var(--ss-ink-2)]">Continue without an account?</h3>
                <p className="text-[color:var(--ss-ink-5)] mb-4">
                  Your progress stays on this device only. You won't be able to open it from another browser
                  or recover it if this browser's data is cleared.
                </p>
                <div className="flex flex-col gap-2">
                  <Button fullWidth size="sm" onClick={() => { setShowGuestWarning(false); setMode('signup'); }}>
                    Create an account and save my work
                  </Button>
                  <Button fullWidth size="sm" variant="quiet" onClick={handleContinueAsGuest}>
                    Continue on this device
                  </Button>
                  <button
                    onClick={() => setShowGuestWarning(false)}
                    className="text-[color:var(--ss-ink-5)] text-sm hover:text-[color:var(--ss-ink-2)]"
                  >
                    Go back
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
};

export default Login;
