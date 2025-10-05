import React, { useState } from 'react';
import './App.css';

type Step = 'input-bigs' | 'input-littles' | 'rank-bigs' | 'rank-littles' | 'results';

interface Ranking {
  [person: string]: string[];
}

interface Pairing {
  big: string;
  little: string;
}

function App() {
  const [step, setStep] = useState<Step>('input-bigs');
  const [bigsInput, setBigsInput] = useState('');
  const [littlesInput, setLittlesInput] = useState('');
  const [bigs, setBigs] = useState<string[]>([]);
  const [littles, setLittles] = useState<string[]>([]);
  const [bigRankings, setBigRankings] = useState<Ranking>({});
  const [littleRankings, setLittleRankings] = useState<Ranking>({});
  const [currentBigIndex, setCurrentBigIndex] = useState(0);
  const [currentLittleIndex, setCurrentLittleIndex] = useState(0);
  const [pairings, setPairings] = useState<Pairing[]>([]);

  const handleBigsSubmit = () => {
    const bigsList = bigsInput.split('\n').filter(name => name.trim() !== '');
    setBigs(bigsList);
    setStep('input-littles');
  };

  const handleLittlesSubmit = () => {
    const littlesList = littlesInput.split('\n').filter(name => name.trim() !== '');
    setLittles(littlesList);
    setStep('rank-bigs');
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
      runMatchingAlgorithm();
      setStep('results');
    }
  };

  const runMatchingAlgorithm = () => {
    const result: Pairing[] = [];
    const availableBigs = new Set(bigs);
    const availableLittles = new Set(littles);

    // Step 1: Find all 1:1 mutual first-choice pairings
    for (const big of bigs) {
      const bigFirstChoice = bigRankings[big]?.[0];
      if (bigFirstChoice && availableLittles.has(bigFirstChoice)) {
        const littleFirstChoice = littleRankings[bigFirstChoice]?.[0];
        if (littleFirstChoice === big) {
          // Mutual first choice - create pairing
          result.push({ big, little: bigFirstChoice });
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
        littleRankings
      );
      result.push(...bestPairings);
    }

    setPairings(result);
  };

  const findOptimalPairings = (
    remainingBigs: string[],
    remainingLittles: string[],
    bigRankings: Ranking,
    littleRankings: Ranking
  ): Pairing[] => {
    // Use greedy approach: iteratively find pairing with minimum distance
    const result: Pairing[] = [];
    const availableBigs = new Set(remainingBigs);
    const availableLittles = new Set(remainingLittles);

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
        result.push({ big: bestBig, little: bestLittle });
        availableBigs.delete(bestBig);
        availableLittles.delete(bestLittle);
      } else {
        break;
      }
    }

    return result;
  };

  return (
    <div className="App">
      <h1>Sorority Big-Little Matcher</h1>

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
          <br />
          <button onClick={handleBigsSubmit}>Next</button>
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
          <br />
          <button onClick={handleLittlesSubmit}>Next</button>
        </div>
      )}

      {step === 'rank-bigs' && (
        <RankingInput
          person={bigs[currentBigIndex]}
          peopleToRank={littles}
          onSubmit={handleBigRankingSubmit}
          progress={`${currentBigIndex + 1} / ${bigs.length}`}
        />
      )}

      {step === 'rank-littles' && (
        <RankingInput
          person={littles[currentLittleIndex]}
          peopleToRank={bigs}
          onSubmit={handleLittleRankingSubmit}
          progress={`${currentLittleIndex + 1} / ${littles.length}`}
        />
      )}

      {step === 'results' && (
        <div>
          <h2>Pairings</h2>
          {pairings.length === 0 ? (
            <p>No pairings yet</p>
          ) : (
            <ul>
              {pairings.map((pairing, index) => (
                <li key={index}>
                  {pairing.big} ← {pairing.little}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

interface RankingInputProps {
  person: string;
  peopleToRank: string[];
  onSubmit: (rankings: string[]) => void;
  progress: string;
}

function RankingInput({ person, peopleToRank, onSubmit, progress }: RankingInputProps) {
  const [rankings, setRankings] = useState<string[]>([]);

  const handleDragStart = (e: React.DragEvent, name: string) => {
    e.dataTransfer.setData('text/plain', name);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const name = e.dataTransfer.getData('text/plain');
    if (!rankings.includes(name)) {
      setRankings([...rankings, name]);
    }
  };

  const removeFromRanking = (name: string) => {
    setRankings(rankings.filter(n => n !== name));
  };

  const handleSubmit = () => {
    if (rankings.length === peopleToRank.length) {
      onSubmit(rankings);
      setRankings([]);
    } else {
      alert('Please rank all people before submitting');
    }
  };

  const availablePeople = peopleToRank.filter(name => !rankings.includes(name));

  return (
    <div>
      <h2>Ranking for: {person}</h2>
      <p>Progress: {progress}</p>

      <div style={{ display: 'flex', gap: '20px', marginTop: '20px' }}>
        <div style={{ flex: 1 }}>
          <h3>Available</h3>
          <div style={{ border: '1px solid #ccc', padding: '10px', minHeight: '200px' }}>
            {availablePeople.map(name => (
              <div
                key={name}
                draggable
                onDragStart={(e) => handleDragStart(e, name)}
                style={{
                  padding: '8px',
                  margin: '4px',
                  backgroundColor: '#f0f0f0',
                  cursor: 'move',
                  border: '1px solid #999'
                }}
              >
                {name}
              </div>
            ))}
          </div>
        </div>

        <div style={{ flex: 1 }}>
          <h3>Rankings (drag here in order)</h3>
          <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            style={{ border: '1px solid #ccc', padding: '10px', minHeight: '200px' }}
          >
            {rankings.map((name, index) => (
              <div
                key={name}
                style={{
                  padding: '8px',
                  margin: '4px',
                  backgroundColor: '#d0f0d0',
                  border: '1px solid #999',
                  display: 'flex',
                  justifyContent: 'space-between'
                }}
              >
                <span>#{index + 1}: {name}</span>
                <button onClick={() => removeFromRanking(name)}>✕</button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <button onClick={handleSubmit} style={{ marginTop: '20px' }}>
        Submit Rankings
      </button>
    </div>
  );
}

export default App;
