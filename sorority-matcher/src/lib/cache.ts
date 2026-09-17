import { QueryClient } from '@tanstack/react-query';
import { queryKeys } from './queryKeys';

export const invalidateChapter = (client: QueryClient, userId: string, groupId: string, cycleId?: string | null) => Promise.all([
  client.invalidateQueries({ queryKey: queryKeys.fullRoster(userId, groupId) }),
  client.invalidateQueries({ queryKey: queryKeys.groupRoster(userId, groupId) }),
  client.invalidateQueries({ queryKey: queryKeys.approvals(userId, groupId) }),
  ...(cycleId ? [client.invalidateQueries({ queryKey: queryKeys.submissionStatus(userId, cycleId) })] : []),
]);
