import { useNavigate } from 'react-router-dom';

const Mission = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <header className="mb-12">
        <h1 className="text-4xl font-bold text-center">
          Sorora: <i>Our Mission</i>
        </h1>
      </header>

      <div className="max-w-3xl w-full bg-white rounded-lg shadow-lg p-8">
        <div className="space-y-6 text-lg">
          <p>1. Streamline and optimize the big-little process for collegiate fraternities and sororities</p>
          <p>2. Eliminate potential biases in the matching process</p>
          <p>3. Standardize sorority practices</p>
        </div>
        <p className="mt-8 text-base text-gray-700">
          Sorora uses a smart matching algorithm to create the best possible Big-Little pairings based on mutual preferences.
        </p>
      </div>

      <div className="mt-8 flex gap-4">
        <button
          onClick={() => navigate('/')}
          className="px-8 py-3 bg-gray-300 text-black rounded-md hover:bg-gray-400 transition-colors text-xl"
        >
          ⟵
        </button>
        <button
          onClick={() => navigate('/how-it-works')}
          className="px-8 py-3 bg-black text-white rounded-md hover:bg-gray-800 transition-colors text-xl"
        >
          ⟶
        </button>
      </div>
    </div>
  );
};

export default Mission;
