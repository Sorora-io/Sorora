import React, { useState } from 'react';
import './App.css';

type Step = 'about' | 'input-bigs' | 'input-littles' | 'select-twins' | 'set-minimums' | 'rank-bigs' | 'rank-littles' | 'review' | 'results';

interface Ranking {
  [person: string]: string[];
}

interface Pairing {
  big: string;
  littles: string[];
}

function App() {
  const [step, setStep] = useState<Step>('about');
  const [bigsInput, setBigsInput] = useState('');
  const [littlesInput, setLittlesInput] = useState('');
  const [bigsError, setBigsError] = useState('');
  const [littlesError, setLittlesError] = useState('');
  const [bigs, setBigs] = useState<string[]>([]);
  const [littles, setLittles] = useState<string[]>([]);
  const [bigsWillingToTakeTwins, setBigsWillingToTakeTwins] = useState<Set<string>>(new Set());
  const [minBigRankings, setMinBigRankings] = useState(5);
  const [minLittleRankings, setMinLittleRankings] = useState(5);
  const [minBigRankingsInput, setMinBigRankingsInput] = useState('5');
  const [minLittleRankingsInput, setMinLittleRankingsInput] = useState('5');
  const [minimumsError, setMinimumsError] = useState('');
  const [bigRankings, setBigRankings] = useState<Ranking>({});
  const [littleRankings, setLittleRankings] = useState<Ranking>({});
  const [currentBigIndex, setCurrentBigIndex] = useState(0);
  const [currentLittleIndex, setCurrentLittleIndex] = useState(0);
  const [pairings, setPairings] = useState<Pairing[]>([]);
  const [exportMessage, setExportMessage] = useState('');

  const handleBigsSubmit = () => {
    const bigsList = bigsInput.split('\n').filter(name => name.trim() !== '');
    if (bigsList.length === 0) {
      setBigsError('Please enter at least 1 big');
      return;
    }
    setBigsError('');
    setBigs(bigsList);
    setStep('input-littles');
  };

  const handleLittlesSubmit = () => {
    const littlesList = littlesInput.split('\n').filter(name => name.trim() !== '');
    if (littlesList.length === 0) {
      setLittlesError('Please enter at least 1 little');
      return;
    }
    setLittlesError('');
    setLittles(littlesList);
    setStep('select-twins');
  };

  const handleTwinsSelectionSubmit = () => {
    setStep('set-minimums');
  };

  const handleMinimumsSubmit = () => {
    const minBig = parseInt(minBigRankingsInput);
    const minLittle = parseInt(minLittleRankingsInput);

    if (isNaN(minBig) || minBig < 1) {
      setMinimumsError('Minimum big rankings must be at least 1');
      return;
    }

    if (isNaN(minLittle) || minLittle < 1) {
      setMinimumsError('Minimum little rankings must be at least 1');
      return;
    }

    setMinimumsError('');
    setMinBigRankings(minBig);
    setMinLittleRankings(minLittle);
    setStep('rank-bigs');
  };

  const toggleTwinSelection = (big: string) => {
    setBigsWillingToTakeTwins(prev => {
      const newSet = new Set(prev);
      if (newSet.has(big)) {
        newSet.delete(big);
      } else {
        newSet.add(big);
      }
      return newSet;
    });
  };


  const handleBigRankingSubmit = (rankings: string[]) => {
    setBigRankings(prev => ({
      ...prev,
      [bigs[currentBigIndex]]: rankings
    }));

    if (currentBigIndex < bigs.length - 1) {
      setCurrentBigIndex(currentBigIndex + 1);
    } else {
      setStep('rank-littles');
    }
  };

  const handleLittleRankingSubmit = (rankings: string[]) => {
    setLittleRankings(prev => ({
      ...prev,
      [littles[currentLittleIndex]]: rankings
    }));

    if (currentLittleIndex < littles.length - 1) {
      setCurrentLittleIndex(currentLittleIndex + 1);
    } else {
      setStep('review');
    }
  };

  const exportResults = () => {
    // Create text format
    let text = 'Big-Little Pairings\n';
    text += '===================\n\n';

    pairings.forEach((pairing, index) => {
      const twinLabel = pairing.littles.length > 1 ? ' (TWINS)' : '';
      text += `${index + 1}. ${pairing.big} ← ${pairing.littles.join(', ')}${twinLabel}\n`;
    });

    // Add summary statistics
    const totalMatched = pairings.reduce((sum, p) => sum + p.littles.length, 0);
    text += `\n\nSummary\n`;
    text += `-------\n`;
    text += `Total Bigs Matched: ${pairings.length}\n`;
    text += `Total Littles Matched: ${totalMatched}\n`;
    text += `Twin Pairings: ${pairings.filter(p => p.littles.length > 1).length}\n`;

    // Copy to clipboard
    navigator.clipboard.writeText(text).then(() => {
      setExportMessage('Results copied to clipboard!');
      setTimeout(() => setExportMessage(''), 3000);
    }).catch(() => {
      // Fallback: create downloadable file
      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'sorora-pairings.txt';
      a.click();
      URL.revokeObjectURL(url);
      setExportMessage('Results downloaded as file!');
      setTimeout(() => setExportMessage(''), 3000);
    });
  };

  const runMatchingAlgorithm = () => {
    const result: Pairing[] = [];
    const availableBigs = new Set(bigs);
    const availableLittles = new Set(littles);

    // Step 1: Find all 1:1 mutual first-choice pairings
    for (const big of bigs) {
      if (!availableBigs.has(big)) continue;

      const bigFirstChoice = bigRankings[big]?.[0];
      if (bigFirstChoice && availableLittles.has(bigFirstChoice)) {
        const littleFirstChoice = littleRankings[bigFirstChoice]?.[0];
        if (littleFirstChoice === big) {
          // Mutual first choice - create pairing
          result.push({ big, littles: [bigFirstChoice] });
          availableBigs.delete(big);
          availableLittles.delete(bigFirstChoice);
        }
      }
    }

    // Step 2: For remaining people, minimize total distance
    const remainingBigs = Array.from(availableBigs);
    const remainingLittles = Array.from(availableLittles);

    if (remainingBigs.length > 0 && remainingLittles.length > 0) {
      const bestPairings = findOptimalPairings(
        remainingBigs,
        remainingLittles,
        bigRankings,
        littleRankings,
        bigsWillingToTakeTwins
      );
      result.push(...bestPairings);
    }

    setPairings(result);
  };

  const findOptimalPairings = (
    remainingBigs: string[],
    remainingLittles: string[],
    bigRankings: Ranking,
    littleRankings: Ranking,
    bigsWillingToTakeTwins: Set<string>
  ): Pairing[] => {
    // Use greedy approach: iteratively find pairing with minimum distance
    const result: Pairing[] = [];
    const availableBigs = new Set(remainingBigs);
    const availableLittles = new Set(remainingLittles);
    const bigToLittles: { [big: string]: string[] } = {};

    // Initialize each big with an empty array
    for (const big of availableBigs) {
      bigToLittles[big] = [];
    }

    while (availableBigs.size > 0 && availableLittles.size > 0) {
      let bestBig = '';
      let bestLittle = '';
      let minDistance = Infinity;

      // Find the pairing with minimum total distance
      for (const big of availableBigs) {
        for (const little of availableLittles) {
          const bigRank = bigRankings[big]?.indexOf(little) ?? Infinity;
          const littleRank = littleRankings[little]?.indexOf(big) ?? Infinity;
          const distance = bigRank + littleRank;

          if (distance < minDistance) {
            minDistance = distance;
            bestBig = big;
            bestLittle = little;
          }
        }
      }

      if (bestBig && bestLittle) {
        bigToLittles[bestBig].push(bestLittle);
        availableLittles.delete(bestLittle);

        // Check if this big should be removed from consideration
        // Remove if: not willing to take twins OR already has 1 little and is willing to take twins (but has 1 now) OR already has 2 littles
        const currentLittleCount = bigToLittles[bestBig].length;
        if (!bigsWillingToTakeTwins.has(bestBig) || currentLittleCount >= 2) {
          availableBigs.delete(bestBig);
        }
      } else {
        break;
      }
    }

    // Convert to result format
    for (const big of Object.keys(bigToLittles)) {
      if (bigToLittles[big].length > 0) {
        result.push({ big, littles: bigToLittles[big] });
      }
    }

    return result;
  };

  return (
    <div className="App">
      <h1>Sorora</h1>

      {step === 'about' && (
        <div>
          <h2>How Our Algorithm Works</h2>
          <div style={{ textAlign: 'left', maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
            <p>
              Sorora uses a smart matching algorithm to create the best possible Big-Little pairings based on mutual preferences.
            </p>

            <h3>The Algorithm Process:</h3>

            <div style={{ marginBottom: '20px' }}>
              <h4>Step 1: Mutual First-Choice Matches</h4>
              <p>
                We start by identifying all <strong>mutual first-choice pairings</strong>. If a Big ranks a Little as their #1 choice
                AND that Little ranks the Big as their #1 choice, we immediately create that pairing. These are the strongest possible
                matches and are guaranteed to be included in the final results.
              </p>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <h4>Step 2: Minimizing Total Distance</h4>
              <p>
                For everyone not matched in Step 1, we use a <strong>greedy optimization approach</strong> to minimize the total "distance"
                between preferences. The distance is calculated as:
              </p>
              <p style={{ marginLeft: '20px', fontFamily: 'monospace', background: '#f0f0f0', padding: '10px', borderRadius: '5px' }}>
                Distance = Big's ranking position + Little's ranking position
              </p>
              <p>
                For example, if a Big ranks a Little as their 3rd choice (position 2) and that Little ranks the Big as their 2nd choice
                (position 1), the total distance is 3.
              </p>
              <p>
                The algorithm iteratively finds the pairing with the <strong>minimum distance</strong>, creates that match, and repeats
                until everyone is matched.
              </p>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <h4>Twin Support</h4>
              <p>
                Bigs who are willing to take twins (2 littles) remain in the matching pool after their first match. They can receive
                a second little if that creates a better overall matching compared to pairing that little with a different big.
              </p>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <h4>Why This Works</h4>
              <ul style={{ textAlign: 'left' }}>
                <li>Perfect matches (mutual first choices) are always preserved</li>
                <li>The greedy approach ensures each decision optimizes for the strongest remaining preference</li>
                <li>By minimizing total distance, we maximize overall satisfaction across all pairings</li>
                <li>Twin support allows flexibility without sacrificing match quality</li>
              </ul>
            </div>
          </div>

          <div style={{ marginTop: '30px' }}>
            <button onClick={() => setStep('input-bigs')} style={{ fontSize: '18px', padding: '10px 20px' }}>
              Get Started →
            </button>
          </div>
        </div>
      )}

      {step === 'input-bigs' && (
        <div>
          <h2>Enter all Bigs (one per line)</h2>
          <textarea
            value={bigsInput}
            onChange={(e) => setBigsInput(e.target.value)}
            rows={10}
            cols={50}
            placeholder="Enter big names, one per line"
          />
          {bigsError && (
            <p style={{ color: 'red', marginTop: '10px' }}>{bigsError}</p>
          )}
          <br />
          <button onClick={handleBigsSubmit}>Next</button>
        </div>
      )}

      {step === 'select-twins' && (
        <div>
          <h2>Select Bigs Willing to Take Twins</h2>
          <p>Check all bigs who are willing to take 2 littles:</p>
          <div style={{ marginTop: '20px' }}>
            {bigs.map(big => (
              <div key={big} style={{ marginBottom: '10px' }}>
                <label>
                  <input
                    type="checkbox"
                    checked={bigsWillingToTakeTwins.has(big)}
                    onChange={() => toggleTwinSelection(big)}
                  />
                  {' '}{big}
                </label>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '20px' }}>
            <button onClick={() => setStep('input-littles')}>Back</button>
            <button onClick={handleTwinsSelectionSubmit}>Next</button>
          </div>
        </div>
      )}

      {step === 'set-minimums' && (
        <div>
          <h2>Set Minimum Ranking Requirements</h2>
          <div style={{ marginTop: '20px' }}>
            <div style={{ marginBottom: '20px' }}>
              <label>
                Minimum number of littles each big must rank:{' '}
                <input
                  type="number"
                  min="1"
                  value={minBigRankingsInput}
                  onChange={(e) => setMinBigRankingsInput(e.target.value)}
                  style={{ width: '80px' }}
                />
              </label>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label>
                Minimum number of bigs each little must rank:{' '}
                <input
                  type="number"
                  min="1"
                  value={minLittleRankingsInput}
                  onChange={(e) => setMinLittleRankingsInput(e.target.value)}
                  style={{ width: '80px' }}
                />
              </label>
            </div>
            {minimumsError && (
              <p style={{ color: 'red', marginTop: '10px' }}>{minimumsError}</p>
            )}
          </div>
          <div style={{ marginTop: '20px' }}>
            <button onClick={() => setStep('select-twins')}>Back</button>
            <button onClick={handleMinimumsSubmit}>Next</button>
          </div>
        </div>
      )}

      {step === 'input-littles' && (
        <div>
          <h2>Enter all Littles (one per line)</h2>
          <textarea
            value={littlesInput}
            onChange={(e) => setLittlesInput(e.target.value)}
            rows={10}
            cols={50}
            placeholder="Enter little names, one per line"
          />
          {littlesError && (
            <p style={{ color: 'red', marginTop: '10px' }}>{littlesError}</p>
          )}
          <br />
          <button onClick={() => setStep('input-bigs')}>Back</button>
          <button onClick={handleLittlesSubmit}>Next</button>
        </div>
      )}

      {step === 'rank-bigs' && (
        <RankingInput
          person={bigs[currentBigIndex]}
          personType="Big"
          peopleToRank={littles}
          peopleToRankType="Littles"
          minRankings={minBigRankings}
          onSubmit={handleBigRankingSubmit}
          onBack={currentBigIndex === 0 ? () => setStep('set-minimums') : () => setCurrentBigIndex(currentBigIndex - 1)}
          progress={`${currentBigIndex + 1} / ${bigs.length}`}
        />
      )}

      {step === 'rank-littles' && (
        <RankingInput
          person={littles[currentLittleIndex]}
          personType="Little"
          peopleToRank={bigs}
          peopleToRankType="Bigs"
          minRankings={minLittleRankings}
          onSubmit={handleLittleRankingSubmit}
          onBack={currentLittleIndex === 0 ? () => { setStep('rank-bigs'); setCurrentBigIndex(bigs.length - 1); } : () => setCurrentLittleIndex(currentLittleIndex - 1)}
          progress={`${currentLittleIndex + 1} / ${littles.length}`}
        />
      )}

      {step === 'review' && (
        <div>
          <h2>Review Summary</h2>
          <div style={{ marginTop: '20px' }}>
            <div style={{ marginBottom: '20px' }}>
              <h3>Bigs ({bigs.length})</h3>
              <p>{bigs.join(', ')}</p>
              <button onClick={() => setStep('input-bigs')}>Edit</button>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <h3>Littles ({littles.length})</h3>
              <p>{littles.join(', ')}</p>
              <button onClick={() => setStep('input-littles')}>Edit</button>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <h3>Bigs Willing to Take Twins ({bigsWillingToTakeTwins.size})</h3>
              <p>{bigsWillingToTakeTwins.size > 0 ? Array.from(bigsWillingToTakeTwins).join(', ') : 'None'}</p>
              <button onClick={() => setStep('select-twins')}>Edit</button>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <h3>Minimum Rankings</h3>
              <p>Bigs must rank at least {minBigRankings} littles</p>
              <p>Littles must rank at least {minLittleRankings} bigs</p>
              <button onClick={() => setStep('set-minimums')}>Edit</button>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <h3>Rankings Collected</h3>
              <p>Big rankings: {Object.keys(bigRankings).length} / {bigs.length}</p>
              <p>Little rankings: {Object.keys(littleRankings).length} / {littles.length}</p>
              {(Object.keys(bigRankings).length < bigs.length || Object.keys(littleRankings).length < littles.length) && (
                <button onClick={() => setStep('rank-bigs')}>Continue Rankings</button>
              )}
            </div>
          </div>

          <div style={{ marginTop: '30px' }}>
            <button onClick={() => setStep('rank-littles')}>Back</button>
            <button onClick={() => { runMatchingAlgorithm(); setStep('results'); }} style={{ marginLeft: '10px', fontWeight: 'bold' }}>
              Run Matching Algorithm
            </button>
          </div>
        </div>
      )}

      {step === 'results' && (
        <div>
          <h2>Pairings</h2>
          {pairings.length === 0 ? (
            <p>No pairings yet</p>
          ) : (
            <>
              <ul>
                {pairings.map((pairing, index) => (
                  <li key={index}>
                    {pairing.big} ← {pairing.littles.join(', ')}
                    {pairing.littles.length > 1 && ' (TWINS)'}
                  </li>
                ))}
              </ul>
              <div style={{ marginTop: '20px' }}>
                <button onClick={exportResults}>Export Results</button>
                {exportMessage && (
                  <p style={{ color: 'red', marginTop: '10px' }}>{exportMessage}</p>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

interface RankingInputProps {
  person: string;
  personType: 'Big' | 'Little';
  peopleToRank: string[];
  peopleToRankType: 'Bigs' | 'Littles';
  minRankings: number;
  onSubmit: (rankings: string[]) => void;
  onBack?: () => void;
  progress: string;
}

function RankingInput({ person, personType, peopleToRank, peopleToRankType, minRankings, onSubmit, onBack, progress }: RankingInputProps) {
  const [rankingInput, setRankingInput] = useState('');
  const [validationError, setValidationError] = useState('');

  const handleSubmit = () => {
    const rankings = rankingInput
      .split('\n')
      .map(name => name.trim())
      .filter(name => name !== '');

    // Validate that we have at least minimum rankings
    if (rankings.length < minRankings) {
      setValidationError(`Please rank at least ${minRankings} people`);
      return;
    }

    // Validate that all names exist in the system
    const invalidNames: string[] = [];
    const duplicates: string[] = [];
    const seen = new Set<string>();

    for (const name of rankings) {
      if (!peopleToRank.includes(name)) {
        invalidNames.push(name);
      }
      if (seen.has(name)) {
        duplicates.push(name);
      }
      seen.add(name);
    }

    if (invalidNames.length > 0) {
      setValidationError(`Invalid names not in system: ${invalidNames.join(', ')}`);
      return;
    }

    if (duplicates.length > 0) {
      setValidationError(`Duplicate names found: ${duplicates.join(', ')}`);
      return;
    }

    // All validations passed
    setValidationError('');
    onSubmit(rankings);
    setRankingInput('');
  };

  return (
    <div>
      <h2>{personType}: {person}</h2>
      <p>Progress: {progress}</p>

      <div style={{ marginTop: '20px' }}>
        <h3>Rank {peopleToRankType} (one name per line, in order of preference)</h3>
        <p>Available {peopleToRankType}: {peopleToRank.join(', ')}</p>
        <textarea
          value={rankingInput}
          onChange={(e) => setRankingInput(e.target.value)}
          rows={10}
          cols={50}
          placeholder="Enter names, one per line, in order of preference"
          style={{ width: '100%', maxWidth: '500px' }}
        />
        {validationError && (
          <p style={{ color: 'red', marginTop: '10px' }}>{validationError}</p>
        )}
      </div>

      <div style={{ marginTop: '20px' }}>
        {onBack && <button onClick={onBack}>Back</button>}
        <button onClick={handleSubmit}>Submit Rankings</button>
      </div>
    </div>
  );
}

export default App;
