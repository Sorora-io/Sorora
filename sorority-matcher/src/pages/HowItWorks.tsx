import { useNavigate } from 'react-router-dom';

const HowItWorks = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <header className="mb-12">
        <h1 className="text-4xl font-bold text-center">
          Sorora: <i>How It Works</i>
        </h1>
      </header>

      <div className="max-w-4xl w-full bg-white rounded-lg shadow-lg p-8">
        <div className="flex gap-8 mb-8">
          <div className="text-sm font-semibold text-gray-600">Step 1:</div>
          <div className="text-sm font-semibold text-gray-600">Step 2:</div>
          <div className="text-sm font-semibold text-gray-600">Twins</div>
        </div>

        <div className="space-y-6">
          <h3 className="text-2xl font-semibold">Mutual First-Choice Matches</h3>
          <p className="text-lg leading-relaxed">
            We start by identifying all mutual first-choice pairings. If a Big ranks a Little as their #1 choice AND that Little ranks the Big as their #1 choice, we immediately create that pairing. These are the strongest possible matches and are guaranteed to be included in the final results.
          </p>
        </div>
      </div>

      <div className="mt-8 flex gap-4">
        <button
          onClick={() => navigate('/mission')}
          className="px-8 py-3 bg-gray-300 text-black rounded-md hover:bg-gray-400 transition-colors text-xl"
        >
          ⟵
        </button>
        <button
          onClick={() => navigate('/why-it-works')}
          className="px-8 py-3 bg-black text-white rounded-md hover:bg-gray-800 transition-colors text-xl"
        >
          ⟶
        </button>
      </div>
    </div>
  );
};

export default HowItWorks;
