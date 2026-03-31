import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Index = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <header className="mb-12 w-full max-w-2xl flex items-center justify-between">
        <h1 className="text-4xl font-bold">Sorora</h1>
        {user ? (
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user.email}</span>
            <button
              onClick={() => signOut()}
              className="px-4 py-2 border border-black rounded-md hover:bg-gray-100 transition-colors text-sm"
            >
              Sign out
            </button>
          </div>
        ) : (
          <button
            onClick={() => navigate('/login')}
            className="px-4 py-2 bg-black text-white rounded-md hover:bg-gray-800 transition-colors text-sm"
          >
            Sign in
          </button>
        )}
      </header>

      <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <h2 className="text-3xl font-semibold mb-6">Welcome!</h2>
      </div>

      <div className="mt-8">
        <button
          onClick={() => navigate('/mission')}
          className="px-8 py-3 bg-black text-white rounded-md hover:bg-gray-800 transition-colors text-xl"
        >
          ⟶
        </button>
      </div>
    </div>
  );
};

export default Index;
