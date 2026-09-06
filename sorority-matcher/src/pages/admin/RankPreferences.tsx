import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMatching } from '../../contexts/MatchingContext';
import { Link } from 'react-router-dom';
import Progressbar from '../../components/Progressbar';

const RankPreferences = () => {
  const navigate = useNavigate();
  const {
    bigs,
    littles,
    setBigRankings,
    currentBigIndex,
    setCurrentBigIndex,
    minBigRankings,
  } = useMatching();

  const [rankingInput, setRankingInput] = useState('');
  const [validationError, setValidationError] = useState('');

  // Reachable directly from the side panel without ever visiting Enter
  // Bigs — without this, currentBigIndex/bigs.length math below goes
  // negative/0 and renders "Big: undefined".
  useEffect(() => {
    if (bigs.length === 0) {
      navigate('/admin/enter-bigs', { replace: true });
    }
  }, [bigs, navigate]);

  const currentBig = bigs[currentBigIndex];

  if (bigs.length === 0) {
    return null;
  }

  const handleSubmit = () => {
    if (rankingInput.includes(',')) {
      setValidationError('Please enter one person (first and last name) per line instead of using commas');
      return;
    }

    const rankings = rankingInput
      .split('\n')
      .map(name => name.trim())
      .filter(name => name !== '');

    if (rankings.length < minBigRankings) {
      setValidationError(`Please rank at least ${minBigRankings} ${minBigRankings === 1 ? 'little' : 'littles'}`);
      return;
    }

    const invalidNames: string[] = [];
    const duplicates: string[] = [];
    const seen = new Set<string>();

    for (const name of rankings) {
      if (!littles.some(little => little.toLowerCase() === name.toLowerCase())) {
        invalidNames.push(name);
      }
      const lowerName = name.toLowerCase();
      if (seen.has(lowerName)) {
        duplicates.push(name);
      }
      seen.add(lowerName);
    }

    if (invalidNames.length > 0) {
      setValidationError(`Invalid names not in system: ${invalidNames.join(', ')}`);
      return;
    }

    if (duplicates.length > 0) {
      setValidationError(`Duplicate names found: ${duplicates.join(', ')}`);
      return;
    }

    setValidationError('');
    setBigRankings(prev => ({
      ...prev,
      [currentBig]: rankings
    }));

    if (currentBigIndex < bigs.length - 1) {
      setCurrentBigIndex(currentBigIndex + 1);
      setRankingInput('');
    } else {
      navigate('/admin/rank-bigs');
    }
  };

  const handleBack = () => {
    if (currentBigIndex === 0) {
      navigate('/admin/ranking-requirements');
    } else {
      setCurrentBigIndex(currentBigIndex - 1);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center p-8 pt-16">
      <header className="mb-12">
        <Link to="/">
        <h1 className="text-4xl font-bold text-center">Sorora</h1>
        </Link>
      </header>

      <Progressbar currentStep={5} />

      <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8">
        <h2 className="text-2xl font-semibold mb-2">Big: {currentBig}</h2>
        <p className="text-gray-600 mb-6">
          Progress: {currentBigIndex + 1} / {bigs.length}
        </p>

        <div className="mb-4">
          <h3 className="text-xl font-semibold mb-2">Rank Littles (one name per line, in order of preference)</h3>
          <p className="text-gray-700 mb-4">Available Littles: {littles.join(', ')}</p>
          <textarea
            value={rankingInput}
            onChange={(e) => setRankingInput(e.target.value)}
            rows={10}
            className="w-full p-4 border-2 border-gray-300 rounded-md focus:border-black focus:outline-none"
            placeholder="Enter names, one per line, in order of preference"
          />
          {validationError && (
            <p className="text-red-600 mt-2">{validationError}</p>
          )}
        </div>
      </div>

      <div className="mt-8 flex gap-4">
        <button
          onClick={handleBack}
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

export default RankPreferences;
