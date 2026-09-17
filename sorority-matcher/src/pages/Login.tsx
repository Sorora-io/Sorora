import { useEffect, useState, ReactNode } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { stashPendingGroupAction } from '../contexts/GroupContext';
import { findGroupByJoinCode, groupLabel, MembershipRole } from '../lib/groups';
import Button from '../components/Button';
import SceneShell from '../components/SceneShell';

// The design canvas breaks signup into a set of one-question-per-scene
// steps. This component owns that flow AND the plain email/password
// sign-in scene, choosing which to render based on the URL params
// (?mode=signup&path=join|create) and internal step state.
type SignupPath = 'join' | 'create';
type SignupStep =
  | 'find-chapter'
  | 'chapter-name'
  | 'chapter-school'
  | 'role'
  | 'account';

const Heading = ({ text, italic = false }: { text: string; italic?: boolean }) => (
  <h1
    className={`font-display text-[34px] md:text-[46px] leading-[1.1] font-medium text-[color:var(--ss-ink-1)] whitespace-pre-line ${
      italic ? 'italic' : ''
    }`}
  >
    {text}
  </h1>
);

const Sub = ({ text }: { text: string }) => (
  <p className="mt-4 max-w-lg text-[color:var(--ss-ink-5)] text-base leading-relaxed whitespace-pre-line">
    {text}
  </p>
);

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { signIn, signUp, sendPasswordReset } = useAuth();

  const joinCodeFromLink = searchParams.get('join')?.toUpperCase() ?? '';
  const modeFromLink = searchParams.get('mode');
  const pathFromLink = searchParams.get('path') as SignupPath | null;

  const [mode, setMode] = useState<'signin' | 'signup'>(
    joinCodeFromLink || modeFromLink === 'signup' ? 'signup' : 'signin'
  );
  const [path, setPath] = useState<SignupPath>(
    pathFromLink === 'create' ? 'create' : joinCodeFromLink ? 'join' : pathFromLink ?? 'join'
  );

  const initialStep: SignupStep =
    path === 'create' ? 'chapter-name' : joinCodeFromLink ? 'role' : 'find-chapter';
  const [step, setStep] = useState<SignupStep>(initialStep);

  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [joinCode, setJoinCode] = useState(joinCodeFromLink);
  const [invitedGroupLabel, setInvitedGroupLabel] = useState('');
  const [resolvedGroupId, setResolvedGroupId] = useState<string | undefined>();

  const [groupName, setGroupName] = useState('');
  const [school, setSchool] = useState('');
  const [role, setRole] = useState<MembershipRole>('big');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

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

  const backTo = (target: SignupStep | 'exit') => () => {
    setError('');
    if (target === 'exit') {
      // location.key === 'default' means this is the first entry in the
      // history stack (deep-link / bookmark). Otherwise the user came from
      // the tour, so pop history to preserve the slide they were on
      // instead of remounting Index and losing its `step` state.
      if (location.key !== 'default') navigate(-1);
      else navigate('/');
    } else {
      setStep(target);
    }
  };

  const validateJoinCode = async () => {
    if (!joinCode.trim()) {
      setError('Please enter your chapter code.');
      return false;
    }
    setLoading(true);
    const { group, error: codeError } = await findGroupByJoinCode(joinCode);
    setLoading(false);
    if (codeError || !group) {
      setError(codeError ?? 'No chapter found with that code.');
      return false;
    }
    setResolvedGroupId(group.id);
    setInvitedGroupLabel(groupLabel(group));
    return true;
  };

  const submitAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password) {
      setError('Please fill in every field.');
      return;
    }
    setLoading(true);
    const displayName = `${firstName.trim()} ${lastName.trim()}`.trim();
    const { error: signUpError } = await signUp(email.trim(), password, displayName);
    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }
    stashPendingGroupAction(
      path === 'create'
        ? { mode: 'create', groupName: groupName.trim(), school: school.trim() }
        : { mode: 'join', groupId: resolvedGroupId, role }
    );
    setSuccessMessage(
      path === 'create'
        ? 'Check your email to confirm your account. Once confirmed, your chapter will be created automatically.'
        : `Check your email to confirm your account. Once confirmed, your request to join ${invitedGroupLabel} will be submitted automatically.`
    );
    setMode('signin');
    setLoading(false);
  };

  const useSampleProfile = () => {
    setFirstName('Jade');
    setLastName('Leong');
    setEmail('jade.leong@nyu.edu');
    setPassword('SoraraPreview2026');
  };

  // -----------------------------------------------------------------------
  // Forgot-password scene
  // -----------------------------------------------------------------------
  if (mode === 'signin' && forgotMode) {
    const handleSendReset = async (e: React.FormEvent) => {
      e.preventDefault();
      setResetLoading(true);
      setResetError('');
      const { error } = await sendPasswordReset(resetEmail.trim());
      if (error) setResetError(error.message);
      else setResetSent(true);
      setResetLoading(false);
    };

    return (
      <SceneShell
        topRightLabel="Back to sign in"
        onTopRight={() => {
          setForgotMode(false);
          setResetSent(false);
          setResetError('');
        }}
        footer={
          resetSent ? (
            <Button variant="outline" size="lg" onClick={() => setForgotMode(false)}>
              <ArrowLeft size={16} /> Back to sign in
            </Button>
          ) : null
        }
      >
        <Heading text="Send me a reset link." />
        <Sub text="Enter your email and we'll send you a link to set a new password." />

        {resetSent ? (
          <p className="mt-8 ss-surface w-full max-w-md text-[color:var(--ss-ink-2)]">
            Check {resetEmail} for a link to set a new password.
          </p>
        ) : (
          <form
            onSubmit={handleSendReset}
            className="mt-8 w-full max-w-md flex flex-col gap-4 text-left"
          >
            <div>
              <label className="ss-label" htmlFor="reset-email">Email</label>
              <input
                id="reset-email"
                type="email"
                className="ss-input"
                value={resetEmail}
                onChange={e => setResetEmail(e.target.value)}
                placeholder="you@university.edu"
                required
              />
            </div>
            {resetError && (
              <p className="text-[color:var(--ss-error)] text-sm">{resetError}</p>
            )}
            <Button type="submit" size="lg" fullWidth disabled={resetLoading}>
              {resetLoading ? '...' : 'Send reset link'}
            </Button>
          </form>
        )}
      </SceneShell>
    );
  }

  // -----------------------------------------------------------------------
  // Sign-in scene (plain form)
  // -----------------------------------------------------------------------
  if (mode === 'signin') {
    const handleSignIn = async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      setLoading(true);
      const { error: signInError } = await signIn(email, password);
      if (signInError) setError(signInError.message);
      else navigate('/group/onboarding');
      setLoading(false);
    };

    return (
      <SceneShell
        topRightLabel="Start tour"
        footer={
          <Button
            variant="outline"
            size="md"
            onClick={() => {
              setMode('signup');
              setStep(joinCodeFromLink ? 'role' : 'find-chapter');
              setPath(joinCodeFromLink ? 'join' : 'join');
              setError('');
              setSuccessMessage('');
            }}
          >
            Don't have an account? Sign up
          </Button>
        }
      >
        <Heading text="Welcome back to sorora." />
        <Sub text="Sign in to jump back into your chapter." />

        {successMessage && (
          <p className="mt-6 ss-surface w-full max-w-md text-[color:var(--ss-ink-2)] text-sm">
            {successMessage}
          </p>
        )}

        <form
          onSubmit={handleSignIn}
          className="mt-8 w-full max-w-md flex flex-col gap-4 text-left"
        >
          <div>
            <label className="ss-label" htmlFor="signin-email">Email</label>
            <input
              id="signin-email"
              type="email"
              className="ss-input"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@university.edu"
              required
            />
          </div>
          <div>
            <label className="ss-label" htmlFor="signin-password">Password</label>
            <input
              id="signin-password"
              type="password"
              className="ss-input"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>
          {error && <p className="text-[color:var(--ss-error)] text-sm">{error}</p>}
          <Button type="submit" size="lg" fullWidth disabled={loading}>
            {loading ? '...' : 'Sign in'}
          </Button>
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="!min-h-0 !px-3 !py-1 !text-xs"
              onClick={() => {
                setForgotMode(true);
                setError('');
              }}
            >
              Forgot password?
            </Button>
          </div>
        </form>
      </SceneShell>
    );
  }

  // -----------------------------------------------------------------------
  // Signup wizard scenes
  // -----------------------------------------------------------------------

  const BackButton = ({ target }: { target: SignupStep | 'exit' }) => (
    <Button size="lg" variant="outline" onClick={backTo(target)}>
      <ArrowLeft size={16} /> Back
    </Button>
  );

  const NavRow = ({ children }: { children: ReactNode }) => (
    <div className="flex flex-wrap items-center justify-center gap-3">{children}</div>
  );

  if (step === 'find-chapter') {
    const handleContinue = async () => {
      setError('');
      const ok = await validateJoinCode();
      if (ok) setStep('role');
    };
    return (
      <SceneShell
        footer={
          <NavRow>
            <BackButton target="exit" />
            <Button size="lg" onClick={handleContinue} disabled={loading}>
              {loading ? '...' : 'Continue'} <ArrowRight size={16} />
            </Button>
          </NavRow>
        }
      >
        <Heading text="Let’s find your chapter." />
        <Sub text="Enter the code your chapter shared with you." />
        <div className="mt-8 w-full max-w-md text-left">
          <label className="ss-label" htmlFor="join-code">Chapter code</label>
          <input
            id="join-code"
            type="text"
            className="ss-input uppercase tracking-widest"
            value={joinCode}
            onChange={e => setJoinCode(e.target.value.toUpperCase())}
            placeholder="e.g. XK7P2QRT"
          />
          <p className="ss-caption mt-3">
            Don't have a code yet? <button type="button" onClick={() => { setPath('create'); setStep('chapter-name'); }} className="underline underline-offset-4">Create a chapter instead.</button>
          </p>
          {error && <p className="mt-3 text-[color:var(--ss-error)] text-sm">{error}</p>}
        </div>
      </SceneShell>
    );
  }

  if (step === 'chapter-name') {
    return (
      <SceneShell
        footer={
          <NavRow>
            <BackButton target="exit" />
            <Button
              size="lg"
              onClick={() => {
                if (!groupName.trim()) {
                  setError('Please enter your chapter’s name.');
                  return;
                }
                setError('');
                setStep('chapter-school');
              }}
            >
              Continue <ArrowRight size={16} />
            </Button>
          </NavRow>
        }
      >
        <Heading text="What’s your sorority’s name?" italic />
        <Sub text="Use the full name so members know they’re joining the right organization." />
        <div className="mt-8 w-full max-w-md text-left">
          <label className="ss-label" htmlFor="chapter-name-input">Sorority group name</label>
          <input
            id="chapter-name-input"
            type="text"
            className="ss-input"
            value={groupName}
            onChange={e => setGroupName(e.target.value)}
            placeholder="e.g. Alpha Chi Omega"
          />
          {error && <p className="mt-3 text-[color:var(--ss-error)] text-sm">{error}</p>}
        </div>
      </SceneShell>
    );
  }

  if (step === 'chapter-school') {
    return (
      <SceneShell
        footer={
          <NavRow>
            <BackButton target="chapter-name" />
            <Button
              size="lg"
              onClick={() => {
                if (!school.trim()) {
                  setError('Please enter your school.');
                  return;
                }
                setError('');
                setRole('admin');
                setStep('account');
              }}
            >
              Continue <ArrowRight size={16} />
            </Button>
          </NavRow>
        }
      >
        <Heading text="Where’s your chapter?" />
        <Sub text={groupName || 'Your sorority'} />
        <div className="mt-8 w-full max-w-md text-left">
          <label className="ss-label" htmlFor="school-input">School</label>
          <input
            id="school-input"
            type="text"
            className="ss-input"
            value={school}
            onChange={e => setSchool(e.target.value)}
            placeholder="e.g. New York University"
          />
          {error && <p className="mt-3 text-[color:var(--ss-error)] text-sm">{error}</p>}
        </div>
      </SceneShell>
    );
  }

  if (step === 'role') {
    return (
      <SceneShell
        footer={
          <NavRow>
            <BackButton target="find-chapter" />
            <Button size="lg" onClick={() => setStep('account')}>
              Continue <ArrowRight size={16} />
            </Button>
          </NavRow>
        }
      >
        <Heading text="Are you a Big or a Little?" />
        <Sub
          text={
            invitedGroupLabel
              ? `You’re joining ${invitedGroupLabel}.`
              : 'Choose the role you’re joining as.'
          }
        />
        <div className="mt-8 flex flex-col sm:flex-row gap-3">
          {(['big', 'little', 'admin'] as const).map(r => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              aria-pressed={role === r}
              className={`px-8 py-3 rounded-pill text-[15px] font-medium border transition-colors min-h-[48px] ${
                role === r
                  ? 'bg-[color:var(--ss-jade-deep)] text-white border-transparent'
                  : 'bg-transparent text-[color:var(--ss-ink-2)] border-[color:var(--ss-jade-line)] hover:bg-white/60'
              }`}
            >
              {r === 'big' ? "I'm a Big" : r === 'little' ? "I'm a Little" : "I'm an Admin"}
            </button>
          ))}
        </div>
      </SceneShell>
    );
  }

  // step === 'account'
  return (
    <SceneShell
      footer={
        <NavRow>
          <BackButton target={path === 'create' ? 'chapter-school' : 'role'} />
          <Button
            size="lg"
            type="submit"
            form="account-form"
            disabled={loading}
          >
            {loading ? '...' : 'Create my profile'} <ArrowRight size={16} />
          </Button>
        </NavRow>
      }
    >
      <Heading text="Make yourself at home." italic />
      <Sub text="Start with the basics. You can add more to your profile later." />

      <form
        id="account-form"
        onSubmit={submitAccount}
        className="mt-8 w-full max-w-md flex flex-col gap-4 text-left"
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="ss-label" htmlFor="first-name">First name</label>
            <input
              id="first-name"
              type="text"
              className="ss-input"
              value={firstName}
              onChange={e => setFirstName(e.target.value)}
              placeholder="Jade"
              required
            />
          </div>
          <div>
            <label className="ss-label" htmlFor="last-name">Last name</label>
            <input
              id="last-name"
              type="text"
              className="ss-input"
              value={lastName}
              onChange={e => setLastName(e.target.value)}
              placeholder="Leong"
              required
            />
          </div>
        </div>
        <div>
          <label className="ss-label" htmlFor="signup-email">Email</label>
          <input
            id="signup-email"
            type="email"
            className="ss-input"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@university.edu"
            required
          />
        </div>
        <div>
          <label className="ss-label" htmlFor="signup-password">Password</label>
          <input
            id="signup-password"
            type="password"
            className="ss-input"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Choose a password"
            required
            minLength={6}
          />
        </div>
        <p className="ss-caption">Design preview only. Use sample details, not a real password.</p>
        <button type="button" onClick={useSampleProfile} className="ss-link self-start">
          Use sample profile
        </button>
        {error && <p className="text-[color:var(--ss-error)] text-sm">{error}</p>}
      </form>
    </SceneShell>
  );
};

export default Login;
