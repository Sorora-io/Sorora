import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { runDeferredAcceptance } from '../lib/matching';

export interface Ranking {
  [person: string]: string[];
}

export interface Pairing {
  big: string;
  littles: string[];
}

const STORAGE_KEY = 'sorora-matching-state';

interface PersistedMatchingState {
  bigsInput: string;
  littlesInput: string;
  bigs: string[];
  littles: string[];
  bigsWillingToTakeTwins: string[];
  minBigRankings: number;
  minLittleRankings: number;
  bigRankings: Ranking;
  littleRankings: Ranking;
  currentBigIndex: number;
  currentLittleIndex: number;
  pairings: Pairing[];
}

const loadPersistedState = (): Partial<PersistedMatchingState> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

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
  const [persisted] = useState<Partial<PersistedMatchingState>>(loadPersistedState);

  const [bigsInput, setBigsInput] = useState(persisted.bigsInput ?? '');
  const [littlesInput, setLittlesInput] = useState(persisted.littlesInput ?? '');
  const [bigs, setBigs] = useState<string[]>(persisted.bigs ?? []);
  const [littles, setLittles] = useState<string[]>(persisted.littles ?? []);
  const [bigsWillingToTakeTwins, setBigsWillingToTakeTwins] = useState<Set<string>>(
    new Set(persisted.bigsWillingToTakeTwins ?? [])
  );
  const [minBigRankings, setMinBigRankings] = useState(persisted.minBigRankings ?? 5);
  const [minLittleRankings, setMinLittleRankings] = useState(persisted.minLittleRankings ?? 5);
  const [bigRankings, setBigRankings] = useState<Ranking>(persisted.bigRankings ?? {});
  const [littleRankings, setLittleRankings] = useState<Ranking>(persisted.littleRankings ?? {});
  const [currentBigIndex, setCurrentBigIndex] = useState(persisted.currentBigIndex ?? 0);
  const [currentLittleIndex, setCurrentLittleIndex] = useState(persisted.currentLittleIndex ?? 0);
  const [pairings, setPairings] = useState<Pairing[]>(persisted.pairings ?? []);

  useEffect(() => {
    const toPersist: PersistedMatchingState = {
      bigsInput,
      littlesInput,
      bigs,
      littles,
      bigsWillingToTakeTwins: Array.from(bigsWillingToTakeTwins),
      minBigRankings,
      minLittleRankings,
      bigRankings,
      littleRankings,
      currentBigIndex,
      currentLittleIndex,
      pairings,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toPersist));
    } catch {
      // localStorage unavailable (private browsing, quota) — data just won't survive a refresh
    }
  }, [
    bigsInput, littlesInput, bigs, littles, bigsWillingToTakeTwins,
    minBigRankings, minLittleRankings, bigRankings, littleRankings,
    currentBigIndex, currentLittleIndex, pairings,
  ]);

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

  const runMatchingAlgorithm = () => {
    const result = runDeferredAcceptance(bigs, littles, bigRankings, littleRankings, bigsWillingToTakeTwins);
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
