import { useNavigate } from 'react-router-dom';
import { useMatching } from '../../contexts/MatchingContext';
import { Link } from 'react-router-dom';
import Progressbar from '../../components/Progressbar';

const ReviewSummary = () => {
  const navigate = useNavigate();
  const {
    bigs,
    littles,
    bigsWillingToTakeTwins,
    minBigRankings,
    minLittleRankings,
    bigRankings,
    littleRankings,
    runMatchingAlgorithm,
  } = useMatching();

  const handleRunAlgorithm = () => {
    runMatchingAlgorithm();
    navigate('/admin/pairings');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <header className="mb-12">
        <Link to="/">
        <h1 className="text-4xl font-bold text-center">Sorora</h1>
        </Link>
      </header>

      <Progressbar currentStep={7} className="max-w-4xl" />

      <div className="max-w-4xl w-full bg-white rounded-lg shadow-lg p-8">
        <h2 className="text-3xl font-semibold mb-8">Review Summary</h2>

        <div className="space-y-6">
          <div className="border-b pb-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-xl font-semibold">Bigs ({bigs.length})</h3>
              <button
                onClick={() => navigate('/admin/enter-bigs')}
                className="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
              >
                Edit
              </button>
            </div>
            <p className="text-gray-700">{bigs.join(', ')}</p>
          </div>

          <div className="border-b pb-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-xl font-semibold">Littles ({littles.length})</h3>
              <button
                onClick={() => navigate('/admin/enter-littles')}
                className="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
              >
                Edit
              </button>
            </div>
            <p className="text-gray-700">{littles.join(', ')}</p>
          </div>

          <div className="border-b pb-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-xl font-semibold">Bigs Willing to Take Twins ({bigsWillingToTakeTwins.size})</h3>
              <button
                onClick={() => navigate('/admin/twins')}
                className="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
              >
                Edit
              </button>
            </div>
            <p className="text-gray-700">
              {bigsWillingToTakeTwins.size > 0 ? Array.from(bigsWillingToTakeTwins).join(', ') : 'None'}
            </p>
          </div>

          <div className="border-b pb-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-xl font-semibold">Minimum Rankings</h3>
              <button
                onClick={() => navigate('/admin/ranking-requirements')}
                className="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
              >
                Edit
              </button>
            </div>
            <p className="text-gray-700">Bigs must rank at least {minBigRankings} littles</p>
            <p className="text-gray-700">Littles must rank at least {minLittleRankings} bigs</p>
          </div>

          <div className="border-b pb-4">
            <h3 className="text-xl font-semibold mb-2">Rankings Collected</h3>
            <p className="text-gray-700">Big rankings: {Object.keys(bigRankings).length} / {bigs.length}</p>
            <p className="text-gray-700">Little rankings: {Object.keys(littleRankings).length} / {littles.length}</p>
            {(Object.keys(bigRankings).length < bigs.length || Object.keys(littleRankings).length < littles.length) && (
              <button
                onClick={() => navigate('/admin/rank-preferences')}
                className="mt-2 px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
              >
                Continue Rankings
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mt-8 flex gap-4">
        <button
          onClick={() => navigate('/admin/rank-bigs')}
          className="px-8 py-3 bg-gray-300 text-black rounded-md hover:bg-gray-400 transition-colors text-xl"
        >
          ⟵
        </button>
        <button
          onClick={handleRunAlgorithm}
          className="px-8 py-3 bg-black text-white rounded-md hover:bg-gray-800 transition-colors text-xl"
        >
          ⟶
        </button>
      </div>
    </div>
  );
};

export default ReviewSummary;
