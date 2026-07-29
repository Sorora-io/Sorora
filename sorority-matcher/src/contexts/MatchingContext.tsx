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

  // Deferred-acceptance (Gale-Shapley) stable matching, generalized to
  // multi-slot "programs" — the same algorithm family the NRMP uses to
  // match residency applicants to programs. Littles play the role of
  // applicants and propose; bigs play the role of programs and hold their
  // best offers, replacing a held offer only when a better one arrives.
  // This produces the little-optimal stable matching (every little ends up
  // with the best big it could get in any stable matching).
  const runMatchingAlgorithm = () => {
    // Complete each person's preference list: explicit rankings first, in
    // order, followed by everyone unranked (so a partial ranking doesn't
    // leave that person with no one to propose to / accept).
    const completeList = (ranked: string[], universe: string[]): string[] => {
      const rankedValid = ranked.filter(name => universe.includes(name));
      const rankedSet = new Set(rankedValid);
      const unranked = universe.filter(name => !rankedSet.has(name));
      return [...rankedValid, ...unranked];
    };

    const littlePrefs: Ranking = {};
    for (const little of littles) {
      littlePrefs[little] = completeList(littleRankings[little] ?? [], bigs);
    }

    const bigPrefs: Ranking = {};
    const bigRankOf: { [big: string]: { [little: string]: number } } = {};
    for (const big of bigs) {
      bigPrefs[big] = completeList(bigRankings[big] ?? [], littles);
      bigRankOf[big] = {};
      bigPrefs[big].forEach((little, idx) => {
        bigRankOf[big][little] = idx;
      });
    }

    const capacity: { [big: string]: number } = {};
    for (const big of bigs) {
      capacity[big] = bigsWillingToTakeTwins.has(big) ? 2 : 1;
    }

    const nextProposalIndex: { [little: string]: number } = {};
    for (const little of littles) {
      nextProposalIndex[little] = 0;
    }

    const bigToLittles: { [big: string]: string[] } = {};
    for (const big of bigs) {
      bigToLittles[big] = [];
    }

    const freeLittles: string[] = [...littles];

    while (freeLittles.length > 0) {
      const little = freeLittles.shift()!;
      const prefs = littlePrefs[little];

      if (nextProposalIndex[little] >= prefs.length) {
        // Exhausted every big without being accepted; stays unmatched.
        continue;
      }

      const big = prefs[nextProposalIndex[little]];
      nextProposalIndex[little] += 1;

      const held = bigToLittles[big];
      const littleRank = bigRankOf[big][little];

      if (held.length < capacity[big]) {
        held.push(little);
      } else {
        let worstIdx = 0;
        let worstRank = -1;
        held.forEach((heldLittle, idx) => {
          const rank = bigRankOf[big][heldLittle];
          if (rank > worstRank) {
            worstRank = rank;
            worstIdx = idx;
          }
        });

        if (littleRank < worstRank) {
          const rejected = held[worstIdx];
          held[worstIdx] = little;
          freeLittles.push(rejected);
        } else {
          freeLittles.push(little);
        }
      }
    }

    const result: Pairing[] = [];
    for (const big of bigs) {
      if (bigToLittles[big].length > 0) {
        const sortedLittles = [...bigToLittles[big]].sort(
          (a, b) => bigRankOf[big][a] - bigRankOf[big][b]
        );
        result.push({ big, littles: sortedLittles });
      }
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
