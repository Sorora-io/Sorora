import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMatching } from '../../contexts/MatchingContext';
import { Link } from 'react-router-dom';

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
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <header className="mb-12">
        <Link to="/">
        <h1 className="text-4xl font-bold text-center">Sorora</h1>
        </Link>
      </header>

      <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8">
        <h2 className="text-2xl font-semibold mb-6">Set Minimum Ranking Requirements</h2>

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
              className="w-32 p-2 border-2 border-gray-300 rounded-md focus:border-black focus:outline-none"
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
              className="w-32 p-2 border-2 border-gray-300 rounded-md focus:border-black focus:outline-none"
            />
          </div>

          {error && (
            <p className="text-red-600">{error}</p>
          )}
        </div>
      </div>

      <div className="mt-8 flex gap-4">
        <button
          onClick={() => navigate('/admin/twins')}
          className="px-8 py-3 bg-gray-300 text-black rounded-md hover:bg-gray-400 transition-colors text-xl"
        >
          ⟵
        </button>
        <button
          onClick={handleSubmit}
          className="px-8 py-3 bg-black text-white rounded-md hover:bg-gray-800 transition-colors text-xl"
        >
          ⟶
        </button>
      </div>
    </div>
  );
};

export default RankingRequirements;
