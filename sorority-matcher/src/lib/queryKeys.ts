// Centralized so the same fetch reached from different pages (e.g.
// getMyRanking from both Dashboard and SubmitRanking) shares one cache
// entry under react-query — a typo'd duplicate key here would silently
// defeat that sharing and bring back the "reloads every time" flicker.
export const queryKeys = {
  myProfile: () => ['my-profile'] as const,
  submissionStatus: (groupId: string) => ['submission-status', groupId] as const,
  myRanking: (groupId: string) => ['my-ranking', groupId] as const,
  fullRoster: (groupId: string) => ['full-roster', groupId] as const,
  groupRoster: (groupId: string, role: string) => ['group-roster', groupId, role] as const,
};
