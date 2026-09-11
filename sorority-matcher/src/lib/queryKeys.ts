// Centralized so the same fetch reached from different pages (e.g.
// getMyRanking from both Dashboard and SubmitRanking) shares one cache
// entry under react-query — a typo'd duplicate key here would silently
// defeat that sharing and bring back the "reloads every time" flicker.
export const queryKeys = {
  myProfile: () => ['my-profile'] as const,
  // Keyed by cycle, not group — rankings/pairings are per-cycle now, so
  // this also means starting a new cycle naturally busts the cache (a new
  // cycleId is a new key) instead of needing a manual invalidation.
  submissionStatus: (cycleId: string) => ['submission-status', cycleId] as const,
  myRanking: (cycleId: string) => ['my-ranking', cycleId] as const,
  fullRoster: (groupId: string) => ['full-roster', groupId] as const,
  groupRoster: (groupId: string, role: string) => ['group-roster', groupId, role] as const,
  myNotes: (groupId: string) => ['my-notes', groupId] as const,
};
