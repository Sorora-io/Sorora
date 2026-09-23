import { QueryClient } from '@tanstack/react-query';
import { queryKeys } from './queryKeys';

export const invalidateChapter = (client: QueryClient, userId: string, groupId: string, cycleId?: string | null) => Promise.all([
  client.invalidateQueries({ queryKey: queryKeys.fullRoster(userId, groupId) }),
  client.invalidateQueries({ queryKey: queryKeys.groupRoster(userId, groupId) }),
  client.invalidateQueries({ queryKey: queryKeys.approvals(userId, groupId) }),
  client.invalidateQueries({ queryKey: queryKeys.pendingCount(userId, groupId) }),
  ...(cycleId ? [
    client.invalidateQueries({ queryKey: queryKeys.submissionStatus(userId, cycleId) }),
    client.invalidateQueries({ queryKey: queryKeys.revealStatus(userId, cycleId) }),
  ] : []),
]);

// Profiles are shared across chapters: invalidate every cached view of this
// person's photo/name, including chapters other than the currently active one.
export const invalidateProfileViews = (client: QueryClient, userId: string) =>
  client.invalidateQueries({
    predicate: ({ queryKey }) => queryKey[0] === 'user' && queryKey[1] === userId &&
      ['full-roster', 'group-roster', 'submission-status', 'approvals'].includes(String(queryKey[2])),
  });
