import { QueryClient } from '@tanstack/react-query';
import { invalidateChapter } from './cache';
import { queryKeys } from './queryKeys';

test('chapter changes invalidate related data but leave other users and chapters alone', async () => {
  const client = new QueryClient();
  const affected = [queryKeys.fullRoster('a', 'chapter'), queryKeys.groupRoster('a', 'chapter', 'big'), queryKeys.groupRoster('a', 'chapter', 'little'), queryKeys.approvals('a', 'chapter'), queryKeys.submissionStatus('a', 'cycle')];
  const untouched = [queryKeys.fullRoster('b', 'chapter'), queryKeys.fullRoster('a', 'other'), queryKeys.myRanking('a', 'cycle')];
  [...affected, ...untouched].forEach(key => client.setQueryData(key, []));
  await invalidateChapter(client, 'a', 'chapter', 'cycle');
  affected.forEach(key => expect(client.getQueryState(key)?.isInvalidated).toBe(true));
  untouched.forEach(key => expect(client.getQueryState(key)?.isInvalidated).toBe(false));
});
