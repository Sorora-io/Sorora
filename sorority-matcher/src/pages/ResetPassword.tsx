import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

// Reached only via the link in a password-reset email — Supabase's client
// picks up the recovery token from the URL on its own (detectSessionInUrl,
// on by default) and establishes a temporary session, which is what lets
// updatePassword() below work without the user re-entering their old one.
const ResetPassword = () => {
  const navigate = useNavigate();
  const { updatePassword } = useAuth();

  const [ready, setReady] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
      else setInvalid(true);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
    const { error: saveError } = await updatePassword(password);
    if (saveError) {
      setError(saveError.message);
      setSaving(false);
      return;
    }
    setDone(true);
    setSaving(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <header className="mb-12">
        <Link to="/">
          <h1 className="text-4xl font-display font-semibold text-center text-jade-800">Sorora</h1>
        </Link>
      </header>

      <div className="max-w-md w-full bg-white rounded-lg shadow-sm p-5">
        <h2 className="text-2xl font-semibold mb-6">Set a New Password</h2>

        {invalid ? (
          <div className="flex flex-col gap-3">
            <p className="text-brick text-sm">
              This reset link is invalid or has expired. Request a new one from the sign-in page.
            </p>
            <Link
              to="/login"
              className="w-full py-2.5 bg-jade-600 text-white rounded-md hover:bg-jade-700 transition-colors text-center"
            >
              Back to Sign In
            </Link>
          </div>
        ) : done ? (
          <div className="flex flex-col gap-3">
            <p className="text-jade-700 bg-jade-50 border border-jade-200 rounded-md p-3 text-sm">
              Your password has been updated.
            </p>
            <button
              onClick={() => navigate('/login')}
              className="w-full py-2.5 bg-jade-600 text-white rounded-md hover:bg-jade-700 transition-colors"
            >
              Continue to Sign In
            </button>
          </div>
        ) : !ready ? (
          <p className="text-gray-500">Loading...</p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">New password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full p-3 border border-jade-300 rounded-md focus:border-jade-500 focus:outline-none focus:ring-2 focus:ring-jade-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Confirm new password</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full p-3 border border-jade-300 rounded-md focus:border-jade-500 focus:outline-none focus:ring-2 focus:ring-jade-100"
              />
            </div>
            {error && <p className="text-brick text-sm">{error}</p>}
            <button
              type="submit"
              disabled={saving}
              className="w-full py-2.5 bg-jade-600 text-white rounded-md hover:bg-jade-700 transition-colors disabled:opacity-50"
            >
              {saving ? '...' : 'Update Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
