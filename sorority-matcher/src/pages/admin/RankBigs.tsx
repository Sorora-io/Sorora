import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMatching } from '../../contexts/MatchingContext';
import { Link } from 'react-router-dom';
import Progressbar from '../../components/Progressbar';

const RankBigs = () => {
  const navigate = useNavigate();
  const {
    bigs,
    littles,
    setLittleRankings,
    currentLittleIndex,
    setCurrentLittleIndex,
    setCurrentBigIndex,
    minLittleRankings,
  } = useMatching();

  const [rankingInput, setRankingInput] = useState('');
  const [validationError, setValidationError] = useState('');

  // Reachable directly from the side panel without ever visiting Enter
  // Bigs/Littles — without this, currentLittleIndex/littles.length math
  // below goes negative/0 and renders "Little: undefined". handleBack also
  // sets currentBigIndex to bigs.length - 1, which is -1 when bigs is empty.
  useEffect(() => {
    if (bigs.length === 0) {
      navigate('/admin/enter-bigs', { replace: true });
    } else if (littles.length === 0) {
      navigate('/admin/enter-littles', { replace: true });
    }
  }, [bigs, littles, navigate]);

  const currentLittle = littles[currentLittleIndex];

  if (bigs.length === 0 || littles.length === 0) {
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

    if (rankings.length < minLittleRankings) {
      setValidationError(`Please rank at least ${minLittleRankings} ${minLittleRankings === 1 ? 'big' : 'bigs'}`);
      return;
    }

    const invalidNames: string[] = [];
    const duplicates: string[] = [];
    const seen = new Set<string>();

    for (const name of rankings) {
      if (!bigs.some(big => big.toLowerCase() === name.toLowerCase())) {
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
    setLittleRankings(prev => ({
      ...prev,
      [currentLittle]: rankings
    }));

    if (currentLittleIndex < littles.length - 1) {
      setCurrentLittleIndex(currentLittleIndex + 1);
      setRankingInput('');
    } else {
      navigate('/admin/review-summary');
    }
  };

  const handleBack = () => {
    if (currentLittleIndex === 0) {
      navigate('/admin/rank-preferences');
      setCurrentBigIndex(bigs.length - 1);
    } else {
      setCurrentLittleIndex(currentLittleIndex - 1);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center p-8 pt-16">
      <header className="mb-12">
        <Link to="/">
        <h1 className="text-4xl font-display font-semibold text-center text-jade-800">Sorora</h1>
        </Link>
      </header>

      <Progressbar currentStep={6} />

      <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8">
        <h2 className="text-2xl font-semibold mb-1">Enter {currentLittle}'s Big rankings</h2>
        <p className="text-gray-500 text-sm mb-6">
          Little {currentLittleIndex + 1} of {littles.length}
        </p>

        <div className="mb-4">
          <h3 className="text-lg font-semibold mb-2">Rank order, most preferred first</h3>
          <p className="text-gray-700 mb-4">Available Bigs: {bigs.join(', ')}</p>
          <textarea
            value={rankingInput}
            onChange={(e) => setRankingInput(e.target.value)}
            rows={10}
            className="w-full p-4 border-2 border-jade-300 rounded-md focus:border-jade-500 focus:outline-none focus:ring-2 focus:ring-jade-100"
            placeholder="Enter names, one per line, in order of preference"
          />
          {validationError && (
            <p className="text-brick mt-2">{validationError}</p>
          )}
        </div>
      </div>

      <div className="mt-8 flex gap-4">
        <button
          onClick={handleBack}
          className="px-6 py-3 border-2 border-jade-300 rounded-md hover:bg-jade-50 transition-colors font-medium"
        >
          Back
        </button>
        <button
          onClick={handleSubmit}
          className="px-6 py-3 bg-jade-600 text-white rounded-md hover:bg-jade-700 transition-colors font-medium"
        >
          {currentLittleIndex < littles.length - 1 ? 'Continue to Next Little' : 'Review everything'}
        </button>
      </div>
    </div>
  );
};

export default RankBigs;
