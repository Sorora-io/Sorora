import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Login = () => {
  const navigate = useNavigate();
  const { signIn, signUp, continueAsGuest } = useAuth();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showGuestWarning, setShowGuestWarning] = useState(false);

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
      const { error } = await signUp(email, password, name);
      if (error) {
        setError(error.message);
      } else {
        setSuccessMessage('Check your email to confirm your account, then sign in.');
        setMode('signin');
      }
    } else {
      const { error } = await signIn(email, password);
      if (error) {
        setError(error.message);
      } else {
        navigate('/admin/enter-bigs');
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
                ⚠️ Without an account, your data will not be saved. If you leave or refresh the page, you'll have to start over.
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
