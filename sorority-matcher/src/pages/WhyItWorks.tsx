import { useNavigate } from 'react-router-dom';

const WhyItWorks = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <header className="mb-12">
        <h1 className="text-4xl font-bold text-center">
          Sorora: <i>Why It Works</i>
        </h1>
      </header>

      <div className="max-w-4xl w-full bg-white rounded-lg shadow-lg p-8">
        <h2 className="text-2xl font-semibold mb-6">Why Our Algorithm Works</h2>
        <ul className="space-y-4 text-lg leading-relaxed list-disc list-inside">
          <li>Perfect matches (mutual first choices) are always preserved</li>
          <li>The greedy approach ensures each decision optimizes for the strongest remaining preference</li>
          <li>By minimizing total distance, we maximize overall satisfaction across all pairings</li>
          <li>Twin support allows flexibility without sacrificing match quality</li>
        </ul>
      </div>

      <div className="mt-8 flex gap-4">
        <button
          onClick={() => navigate('/how-it-works')}
          className="px-8 py-3 bg-gray-300 text-black rounded-md hover:bg-gray-400 transition-colors text-xl"
        >
          ⟵
        </button>
        <button
          onClick={() => navigate('/admin/enter-bigs')}
          className="px-8 py-3 bg-black text-white rounded-md hover:bg-gray-800 transition-colors text-xl"
        >
          ⟶
        </button>
      </div>
    </div>
  );
};

export default WhyItWorks;
