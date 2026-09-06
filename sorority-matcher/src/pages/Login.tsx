import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { stashPendingGroupAction } from '../contexts/GroupContext';
import { findGroupByJoinCode, groupLabel, MembershipRole } from '../lib/groups';

const Login = () => {
  const navigate = useNavigate();
  const { signIn, signUp, continueAsGuest } = useAuth();
  const [searchParams] = useSearchParams();
  const joinCodeFromLink = searchParams.get('join')?.toUpperCase() ?? '';

  const [mode, setMode] = useState<'signin' | 'signup'>(joinCodeFromLink ? 'signup' : 'signin');
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

  const handleContinueAsGuest = () => {
    continueAsGuest();
    navigate('/admin/enter-bigs');
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
          setError('Please enter your group\'s join code.');
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
        // Onboarding redirects onward to /group/pending or the right
        // dashboard once membership status is known.
        navigate('/group/onboarding');
      }
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <header className="mb-12">
        <Link to="/">
          <h1 className="text-4xl font-bold text-center">Sorora</h1>
        </Link>
      </header>

      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <h2 className="text-2xl font-semibold mb-6">
          {mode === 'signin' ? 'Sign In' : 'Create Account'}
        </h2>

        {successMessage && (
          <p className="mb-4 text-green-700 bg-green-50 border border-green-200 rounded-md p-3 text-sm">
            {successMessage}
          </p>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {mode === 'signup' && (
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="w-full p-3 border-2 border-gray-300 rounded-md focus:border-black focus:outline-none"
              />
            </div>
          )}

          {mode === 'signup' && (
            <div className="border-2 border-gray-200 rounded-md p-4">
              <div className="flex gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setGroupMode('create')}
                  className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                    groupMode === 'create' ? 'bg-black text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  Create a group
                </button>
                <button
                  type="button"
                  onClick={() => setGroupMode('join')}
                  className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                    groupMode === 'join' ? 'bg-black text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  Join a group
                </button>
              </div>

              {groupMode === 'create' ? (
                <div className="flex flex-col gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Sorority group name</label>
                    <input
                      type="text"
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                      placeholder="e.g. Alpha Beta Chapter"
                      className="w-full p-3 border-2 border-gray-300 rounded-md focus:border-black focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">School</label>
                    <input
                      type="text"
                      value={school}
                      onChange={(e) => setSchool(e.target.value)}
                      placeholder="e.g. New York University"
                      className="w-full p-3 border-2 border-gray-300 rounded-md focus:border-black focus:outline-none"
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    You'll become this group's admin and get a join code to share.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Join code</label>
                    <input
                      type="text"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                      placeholder="e.g. XK7P2QRT"
                      className="w-full p-3 border-2 border-gray-300 rounded-md focus:border-black focus:outline-none uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">I am a</label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as MembershipRole)}
                      className="w-full p-3 border-2 border-gray-300 rounded-md focus:border-black focus:outline-none"
                    >
                      <option value="big">Big</option>
                      <option value="little">Little</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <p className="text-xs text-gray-500">
                    The group's admin will need to approve your request before you can rank.
                  </p>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full p-3 border-2 border-gray-300 rounded-md focus:border-black focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              className="w-full p-3 border-2 border-gray-300 rounded-md focus:border-black focus:outline-none"
            />
          </div>

          {error && (
            <p className="text-red-600 text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-black text-white rounded-md hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {loading ? '...' : mode === 'signin' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600">
          {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button
            onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setSuccessMessage(''); }}
            className="underline font-medium text-black"
          >
            {mode === 'signin' ? 'Sign up' : 'Sign in'}
          </button>
        </p>

        <div className="mt-6 pt-6 border-t border-gray-200">
          {!showGuestWarning ? (
            <button
              onClick={() => setShowGuestWarning(true)}
              className="w-full text-center text-sm text-gray-600 underline hover:text-black"
            >
              Continue without signing in
            </button>
          ) : (
            <div className="text-sm">
              <p className="text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-3 mb-3">
                ⚠️ Without an account, your entries are only saved in this browser — not tied to you. If you switch devices, use a different browser, or clear your browser data, everything will be lost.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowGuestWarning(false)}
                  className="flex-1 py-2 border-2 border-gray-300 rounded-md hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleContinueAsGuest}
                  className="flex-1 py-2 bg-black text-white rounded-md hover:bg-gray-800 transition-colors"
                >
                  Continue anyway
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
