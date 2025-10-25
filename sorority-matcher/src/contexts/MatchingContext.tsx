import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface Ranking {
  [person: string]: string[];
}

export interface Pairing {
  big: string;
  littles: string[];
}

interface MatchingContextType {
  // Bigs and Littles data
  bigsInput: string;
  setBigsInput: (value: string) => void;
  littlesInput: string;
  setLittlesInput: (value: string) => void;
  bigs: string[];
  setBigs: (value: string[]) => void;
  littles: string[];
  setLittles: (value: string[]) => void;

  // Twins selection
  bigsWillingToTakeTwins: Set<string>;
  setBigsWillingToTakeTwins: (value: Set<string>) => void;
  toggleTwinSelection: (big: string) => void;

  // Minimum rankings
  minBigRankings: number;
  setMinBigRankings: (value: number) => void;
  minLittleRankings: number;
  setMinLittleRankings: (value: number) => void;

  // Rankings
  bigRankings: Ranking;
  setBigRankings: (value: Ranking | ((prev: Ranking) => Ranking)) => void;
  littleRankings: Ranking;
  setLittleRankings: (value: Ranking | ((prev: Ranking) => Ranking)) => void;
  currentBigIndex: number;
  setCurrentBigIndex: (value: number) => void;
  currentLittleIndex: number;
  setCurrentLittleIndex: (value: number) => void;

  // Results
  pairings: Pairing[];
  setPairings: (value: Pairing[]) => void;

  // Matching algorithm
  runMatchingAlgorithm: () => void;
}

const MatchingContext = createContext<MatchingContextType | undefined>(undefined);

export const useMatching = () => {
  const context = useContext(MatchingContext);
  if (!context) {
    throw new Error('useMatching must be used within a MatchingProvider');
  }
  return context;
};

export const MatchingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [bigsInput, setBigsInput] = useState('');
  const [littlesInput, setLittlesInput] = useState('');
  const [bigs, setBigs] = useState<string[]>([]);
  const [littles, setLittles] = useState<string[]>([]);
  const [bigsWillingToTakeTwins, setBigsWillingToTakeTwins] = useState<Set<string>>(new Set());
  const [minBigRankings, setMinBigRankings] = useState(5);
  const [minLittleRankings, setMinLittleRankings] = useState(5);
  const [bigRankings, setBigRankings] = useState<Ranking>({});
  const [littleRankings, setLittleRankings] = useState<Ranking>({});
  const [currentBigIndex, setCurrentBigIndex] = useState(0);
  const [currentLittleIndex, setCurrentLittleIndex] = useState(0);
  const [pairings, setPairings] = useState<Pairing[]>([]);

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

  const findOptimalPairings = (
    remainingBigs: string[],
    remainingLittles: string[],
    bigRankings: Ranking,
    littleRankings: Ranking,
    bigsWillingToTakeTwins: Set<string>
  ): Pairing[] => {
    const result: Pairing[] = [];
    const availableBigs = new Set(remainingBigs);
    const availableLittles = new Set(remainingLittles);
    const bigToLittles: { [big: string]: string[] } = {};

    for (const big of availableBigs) {
      bigToLittles[big] = [];
    }

    while (availableBigs.size > 0 && availableLittles.size > 0) {
      let bestBig = '';
      let bestLittle = '';
      let minDistance = Infinity;

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

        const currentLittleCount = bigToLittles[bestBig].length;
        if (!bigsWillingToTakeTwins.has(bestBig) || currentLittleCount >= 2) {
          availableBigs.delete(bestBig);
        }
      } else {
        break;
      }
    }

    for (const big of Object.keys(bigToLittles)) {
      if (bigToLittles[big].length > 0) {
        result.push({ big, littles: bigToLittles[big] });
      }
    }

    return result;
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

  const value: MatchingContextType = {
    bigsInput,
    setBigsInput,
    littlesInput,
    setLittlesInput,
    bigs,
    setBigs,
    littles,
    setLittles,
    bigsWillingToTakeTwins,
    setBigsWillingToTakeTwins,
    toggleTwinSelection,
    minBigRankings,
    setMinBigRankings,
    minLittleRankings,
    setMinLittleRankings,
    bigRankings,
    setBigRankings,
    littleRankings,
    setLittleRankings,
    currentBigIndex,
    setCurrentBigIndex,
    currentLittleIndex,
    setCurrentLittleIndex,
    pairings,
    setPairings,
    runMatchingAlgorithm,
  };

  return (
    <MatchingContext.Provider value={value}>
      {children}
    </MatchingContext.Provider>
  );
};
