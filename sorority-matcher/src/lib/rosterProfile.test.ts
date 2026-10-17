import { getRosterProfile } from './profile';
import { supabase } from './supabase';
jest.mock('./supabase', () => ({ supabase: { from: jest.fn() } }));
test('queries approved membership in the specified chapter, with only public roster fields', async () => {
  const query: any = { select: jest.fn(), eq: jest.fn(), maybeSingle: jest.fn().mockResolvedValue({ data: { profile: { bio: 'Saved bio' } }, error: null }) };
  query.select.mockReturnValue(query); query.eq.mockReturnValue(query);
  (supabase.from as jest.Mock).mockReturnValue(query);
  expect((await getRosterProfile('group-a', 'member')).profile?.bio).toBe('Saved bio');
  expect(supabase.from).toHaveBeenCalledWith('memberships');
  expect(query.eq.mock.calls).toEqual([['group_id', 'group-a'], ['user_id', 'member'], ['status', 'approved']]);
  expect(query.select).toHaveBeenCalledWith('profile:profiles(name, email, bio, avatar_url, major, college, year, hometown)');
});
test('server errors are generic and return no profile', async () => {
  const query: any = { select: jest.fn(), eq: jest.fn(), maybeSingle: jest.fn().mockResolvedValue({ data: null, error: { message: 'private details' } }) };
  query.select.mockReturnValue(query); query.eq.mockReturnValue(query); (supabase.from as jest.Mock).mockReturnValue(query);
  expect(await getRosterProfile('a', 'b')).toEqual({ profile: null, error: 'Could not load this profile. Please try again.' });
});
