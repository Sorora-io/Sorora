import type { PairingDecision } from './pairingConfirmations';
import type { PairingRow } from './rankings';
import type { RankingExport } from './rankingExport';

export function reviewPairings(pairings: PairingRow[], rankings: Pick<RankingExport, 'members'>, decisions: PairingDecision[] = []) {
  const saved = new Map(decisions.map(decision => [`${decision.bigId}:${decision.littleId}`, decision]));
  const members = new Map(rankings.members.map(member => [member.userId, member]));
  const rank = (person: string, partner: string): number | 'Not submitted' | 'Not ranked' | 'Unavailable' => {
    const member = members.get(person);
    if (!member) return 'Unavailable';
    if (!member.submitted) return 'Not submitted';
    return member.preferences?.find(choice => choice.userId === partner)?.rank ?? 'Not ranked';
  };
  return pairings.map(pair => {
    const bigRank = rank(pair.bigId, pair.littleId);
    const littleRank = rank(pair.littleId, pair.bigId);
    const bigRanked = typeof bigRank === 'number';
    const littleRanked = typeof littleRank === 'number';
    const mutualFirst = bigRank === 1 && littleRank === 1;
    const matchType = mutualFirst ? 'Mutual first choice'
      : bigRank === 'Unavailable' || littleRank === 'Unavailable' ? 'Rankings unavailable'
      : bigRanked && littleRanked ? 'Mutually ranked'
      : bigRanked || littleRanked ? 'One-sided ranking'
      : 'Neither ranked the other — review';
    const decision = saved.get(`${pair.bigId}:${pair.littleId}`);
    return { ...pair, bigRank, littleRank, mutualFirst, matchType, decision, confirmed: decision ? decision.confirmed : mutualFirst };
  });
}
