import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const STEPS = [
  'Add or invite your members',
  'Collect everyone’s preferences',
  'Review and generate pairings',
];

const Index = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen flex flex-col items-center p-8">
      <header className="mb-12 w-full max-w-2xl flex items-center justify-between">
        <h1 className="text-4xl font-display font-semibold text-jade-800">Sorora</h1>
        {user ? (
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user.email}</span>
            <button
              onClick={() => signOut()}
              className="px-4 py-2 border border-jade-600 rounded-md hover:bg-jade-50 transition-colors text-sm"
            >
              Sign out
            </button>
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

      <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8 md:p-10 text-center">
        <h2 className="text-3xl font-display font-semibold mb-3 text-jade-800">
          Big–Little matching, without the spreadsheets.
        </h2>
        <p className="text-gray-600 text-lg mb-8">
          Collect preferences, account for twins, and create thoughtful matches for your chapter.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-4">
          <button
            onClick={() => navigate(user ? '/dashboard' : '/login?mode=signup')}
            className="px-6 py-3 bg-jade-600 text-white rounded-md hover:bg-jade-700 transition-colors font-medium"
          >
            Set up my chapter
          </button>
          <button
            onClick={() => navigate('/admin/enter-bigs')}
            className="px-6 py-3 border-2 border-jade-300 rounded-md hover:bg-jade-50 transition-colors font-medium"
          >
            Run a quick match
          </button>
        </div>

        {!user && (
          <button
            onClick={() => navigate('/login')}
            className="text-sm text-gray-500 underline hover:text-black"
          >
            I already have an account
          </button>
        )}

        <div className="mt-10 pt-8 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-3 gap-6 text-left">
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

      <div className="mt-6 flex gap-4 text-sm text-gray-500">
        <button onClick={() => navigate('/about')} className="underline hover:text-black">
          How It Works
        </button>
        <span aria-hidden="true">·</span>
        <button onClick={() => navigate('/faq')} className="underline hover:text-black">
          FAQ
        </button>
      </div>
    </div>
  );
};

export default Index;
