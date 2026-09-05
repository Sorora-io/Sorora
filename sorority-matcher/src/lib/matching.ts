export interface PreferenceMap {
  [id: string]: string[];
}

export interface DeferredAcceptanceResult {
  big: string;
  littles: string[];
}

// Complete each person's preference list: explicit rankings first, in order,
// followed by everyone unranked (so a partial ranking doesn't leave that
// person with no one to propose to / accept).
const completeList = (ranked: string[], universe: string[]): string[] => {
  const rankedValid = ranked.filter(id => universe.includes(id));
  const rankedSet = new Set(rankedValid);
  const unranked = universe.filter(id => !rankedSet.has(id));
  return [...rankedValid, ...unranked];
};

// Deferred-acceptance (Gale-Shapley) stable matching, generalized to
// multi-slot "programs" — the same algorithm family the NRMP uses to match
// residency applicants to programs. Littles play the role of applicants and
// propose; bigs play the role of programs and hold their best offers,
// replacing a held offer only when a better one arrives. This produces the
// little-optimal stable matching (every little ends up with the best big it
// could get in any stable matching).
//
// Ids are opaque strings — callers may pass names (guest/local mode) or
// database user ids (real group mode); the algorithm doesn't care which.
export function runDeferredAcceptance(
  bigs: string[],
  littles: string[],
  bigRankings: PreferenceMap,
  littleRankings: PreferenceMap,
  bigsWillingToTakeTwins: Set<string>
): DeferredAcceptanceResult[] {
  const littlePrefs: PreferenceMap = {};
  for (const little of littles) {
    littlePrefs[little] = completeList(littleRankings[little] ?? [], bigs);
  }

  const bigPrefs: PreferenceMap = {};
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

  const result: DeferredAcceptanceResult[] = [];
  for (const big of bigs) {
    if (bigToLittles[big].length > 0) {
      const sortedLittles = [...bigToLittles[big]].sort(
        (a, b) => bigRankOf[big][a] - bigRankOf[big][b]
      );
      result.push({ big, littles: sortedLittles });
    }
  }

  return result;
}
