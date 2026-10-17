export interface LittlePreference {
  role: string;
  submitted: boolean;
  willingToTakeTwins?: boolean | null;
  wantedLittleCount?: number | null;
}

// This is the saved membership preference, never an inference from pairings.
// Legacy false/null records cannot distinguish an explicit one-Little answer
// from the default, so the label says so instead of inventing an answer.
export function littlePreferenceLabel(member: LittlePreference, maximum?: number): string {
  if (member.role !== 'big') return 'Not applicable';
  if (member.willingToTakeTwins === undefined && member.wantedLittleCount === undefined) return 'Unavailable';
  const saved = member.wantedLittleCount ?? (member.willingToTakeTwins ? 2 : 1);
  if (maximum !== undefined && saved > maximum) {
    const effective = maximum === 1 ? '1 Little' : 'Up to 2 Littles (twins)';
    return `${effective} — saved choice: ${saved}; capped by chapter rules`;
  }
  if (member.wantedLittleCount === 3) return 'Up to 3 Littles (triplets)';
  if (member.wantedLittleCount === 2 || member.willingToTakeTwins) return 'Up to 2 Littles (twins)';
  return member.submitted ? '1 Little (saved/default)' : 'Not submitted — defaults to 1 Little';
}
