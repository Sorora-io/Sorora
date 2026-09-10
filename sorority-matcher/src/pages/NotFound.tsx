import { useNavigate } from 'react-router-dom';

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="max-w-2xl w-full bg-white rounded-lg shadow-sm p-5 text-center">
        <h1 className="text-6xl font-bold mb-4">404</h1>
        <h2 className="text-2xl font-semibold mb-6">Page Not Found</h2>
        <p className="text-gray-700 mb-8">
          The page you're looking for doesn't exist.
        </p>
        <button
          onClick={() => navigate('/')}
          className="px-6 py-2.5 bg-jade-600 text-white rounded-md hover:bg-jade-700 transition-colors"
        >
          Go Home
        </button>
      </div>
    </div>
  );
};

export default NotFound;
