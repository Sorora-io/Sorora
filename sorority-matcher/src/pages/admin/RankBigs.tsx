import { useState } from 'react';
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

  const currentLittle = littles[currentLittleIndex];

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
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <header className="mb-12">
        <Link to="/">
        <h1 className="text-4xl font-bold text-center">Sorora</h1>
        </Link>
      </header>

      <Progressbar currentStep={6} />

      <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8">
        <h2 className="text-2xl font-semibold mb-2">Little: {currentLittle}</h2>
        <p className="text-gray-600 mb-6">
          Progress: {currentLittleIndex + 1} / {littles.length}
        </p>

        <div className="mb-4">
          <h3 className="text-xl font-semibold mb-2">Rank Bigs (one name per line, in order of preference)</h3>
          <p className="text-gray-700 mb-4">Available Bigs: {bigs.join(', ')}</p>
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

export default RankBigs;
