import PageHeader from '../components/PageHeader';
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import Button from '../components/Button';

// Reached only via the link in a password-reset email — Supabase's client
// picks up the recovery token from the URL on its own (detectSessionInUrl,
// on by default) and establishes a temporary session, which is what lets
// updatePassword() below work without the user re-entering their old one.
const ResetPassword = () => {
  const navigate = useNavigate();
  const { updatePassword } = useAuth();

  const [ready, setReady] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [sessionError, setSessionError] = useState('');
  const [sessionAttempt, setSessionAttempt] = useState(0);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let active = true;
    setSessionError('');
    setReady(false);
    setInvalid(false);
    supabase.auth.getSession().then(({ data: { session }, error: checkError }) => {
      if (!active) return;
      if (checkError) setSessionError('Could not verify your reset link. Check your connection and try again.');
      else if (session) setReady(true);
      else setInvalid(true);
    }).catch(() => {
      if (active) setSessionError('Could not verify your reset link. Check your connection and try again.');
    });
    return () => { active = false; };
  }, [sessionAttempt]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || !ready) return;
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords don’t match.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const { error: saveError } = await updatePassword(password);
      if (saveError) {
        setError(saveError.message);
        return;
      }
      setDone(true);
    } catch {
      setError('Could not update your password. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <PageHeader className="mb-12">
        <Link to="/">
          <h1 className="text-4xl font-display font-semibold text-center text-jade-800">Sorora</h1>
        </Link>
      </PageHeader>

      <div className="max-w-md w-full bg-white rounded-lg shadow-sm p-5">
        <h2 className="text-2xl font-semibold mb-6">Set a New Password</h2>

        {sessionError ? (
          <div className="flex flex-col gap-3">
            <p role="alert" className="text-brick text-sm">{sessionError}</p>
            <Button variant="outline" onClick={() => setSessionAttempt(attempt => attempt + 1)}>Try again</Button>
          </div>
        ) : invalid ? (
          <div className="flex flex-col gap-3">
            <p className="text-brick text-sm">
              This reset link is invalid or has expired. Request a new one from the sign-in page.
            </p>
            <Button onClick={() => navigate('/login')} fullWidth>Back to Sign In</Button>
          </div>
        ) : done ? (
          <div className="flex flex-col gap-3">
            <p role="status" className="text-jade-700 bg-jade-50 border border-jade-200 rounded-md p-3 text-sm">
              Your password has been updated.
            </p>
            <Button onClick={() => navigate('/login')} fullWidth>
              Continue to Sign In
            </Button>
          </div>
        ) : !ready ? (
          <p role="status" className="text-gray-500">Loading...</p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label htmlFor="new-password" className="block text-sm font-medium mb-1">New password</label>
              <input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full p-3 border border-jade-300 rounded-md focus:border-jade-500 focus:outline-none focus:ring-2 focus:ring-jade-100"
              />
            </div>
            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium mb-1">Confirm new password</label>
              <input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full p-3 border border-jade-300 rounded-md focus:border-jade-500 focus:outline-none focus:ring-2 focus:ring-jade-100"
              />
            </div>
            {error && <p role="alert" className="text-brick text-sm">{error}</p>}
            <Button type="submit" disabled={saving} fullWidth>
              {saving ? '...' : 'Update Password'}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
