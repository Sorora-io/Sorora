import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMatching } from '../../contexts/MatchingContext';
import { Link } from 'react-router-dom';
import Progressbar from '../../components/Progressbar';

const RankingRequirements = () => {
  const navigate = useNavigate();
  const { minBigRankings, setMinBigRankings, minLittleRankings, setMinLittleRankings } = useMatching();
  const [minBigInput, setMinBigInput] = useState(minBigRankings.toString());
  const [minLittleInput, setMinLittleInput] = useState(minLittleRankings.toString());
  const [error, setError] = useState('');

  const handleSubmit = () => {
    const minBig = parseInt(minBigInput);
    const minLittle = parseInt(minLittleInput);

    if (isNaN(minBig) || minBig < 1) {
      setError('Minimum big rankings must be at least 1');
      return;
    }

    if (isNaN(minLittle) || minLittle < 1) {
      setError('Minimum little rankings must be at least 1');
      return;
    }

    setError('');
    setMinBigRankings(minBig);
    setMinLittleRankings(minLittle);
    navigate('/admin/rank-preferences');
  };

  return (
    <div className="min-h-screen flex flex-col items-center p-8 pt-16">
      <header className="mb-12">
        <Link to="/">
        <h1 className="text-4xl font-display font-semibold text-center text-jade-800">Sorora</h1>
        </Link>
      </header>

      <Progressbar currentStep={4} />

      <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8">
        <h2 className="text-2xl font-semibold mb-2">Set ranking rules</h2>
        <p className="text-gray-600 mb-6">
          Everyone will need to rank at least this many people before their preferences count toward
          matching.
        </p>

        <div className="space-y-6">
          <div>
            <label className="block text-lg mb-2">
              Minimum number of littles each big must rank:
            </label>
            <input
              type="number"
              min="1"
              value={minBigInput}
              onChange={(e) => setMinBigInput(e.target.value)}
              className="w-32 p-2 border-2 border-jade-300 rounded-md focus:border-jade-500 focus:outline-none focus:ring-2 focus:ring-jade-100"
            />
          </div>

          <div>
            <label className="block text-lg mb-2">
              Minimum number of bigs each little must rank:
            </label>
            <input
              type="number"
              min="1"
              value={minLittleInput}
              onChange={(e) => setMinLittleInput(e.target.value)}
              className="w-32 p-2 border-2 border-jade-300 rounded-md focus:border-jade-500 focus:outline-none focus:ring-2 focus:ring-jade-100"
            />
          </div>

          {error && (
            <p className="text-brick">{error}</p>
          )}
        </div>
      </div>

      <div className="mt-8 flex gap-4">
        <button
          onClick={() => navigate('/admin/twins')}
          className="px-6 py-3 border-2 border-jade-300 rounded-md hover:bg-jade-50 transition-colors font-medium"
        >
          Back
        </button>
        <button
          onClick={handleSubmit}
          className="px-6 py-3 bg-jade-600 text-white rounded-md hover:bg-jade-700 transition-colors font-medium"
        >
          Continue to Enter Preferences
        </button>
      </div>
    </div>
  );
};

export default RankingRequirements;
