// Every authenticated cache entry belongs to one user, including chapter
// data whose visibility can differ with membership permissions.
export const queryKeys = {
  myProfile: (userId: string) => ['user', userId, 'my-profile'] as const,
  submissionStatus: (userId: string, cycleId: string) => ['user', userId, 'submission-status', cycleId] as const,
  myRanking: (userId: string, cycleId: string) => ['user', userId, 'my-ranking', cycleId] as const,
  fullRoster: (userId: string, groupId: string) => ['user', userId, 'full-roster', groupId] as const,
  groupRoster: (userId: string, groupId: string, role?: string) => role
    ? ['user', userId, 'group-roster', groupId, role] as const
    : ['user', userId, 'group-roster', groupId] as const,
  myNotes: (userId: string, groupId: string) => ['user', userId, 'my-notes', groupId] as const,
  approvals: (userId: string, groupId: string) => ['user', userId, 'approvals', groupId] as const,
};
