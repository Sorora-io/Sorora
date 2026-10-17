import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MemberProfile from './MemberProfile';
import { getRosterProfile } from '../../lib/profile';
let mockMemberId = 'member';
let mockGroup: any = { membership: { group_id: 'chapter', status: 'approved' } };
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate, useParams: () => ({ memberId: mockMemberId }), useSearchParams: () => [new URLSearchParams('from=dashboard')] }), { virtual: true });
jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'viewer' } }) }));
jest.mock('../../contexts/GroupContext', () => ({ useGroup: () => mockGroup }));
jest.mock('../../lib/profile', () => ({ getRosterProfile: jest.fn() }));
const profile = { name: 'Alex', email: 'alex@example.com', bio: 'A real bio.\nSecond line.', major: 'History' };
const setup = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemberProfile /></QueryClientProvider>);
beforeEach(() => { jest.clearAllMocks(); mockGroup = { membership: { group_id: 'chapter', status: 'approved' } }; });
test('reads actual bio with current chapter and returns to dashboard roster', async () => {
  (getRosterProfile as jest.Mock).mockResolvedValue({ profile, error: null }); setup();
  expect(await screen.findByRole('heading', { name: 'Alex' })).toBeInTheDocument();
  expect(screen.getByText(/A real bio/)).toHaveTextContent('Second line.');
  expect(getRosterProfile).toHaveBeenCalledWith('chapter', 'member');
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Back to roster' }));
  expect(mockNavigate).toHaveBeenCalledWith('/dashboard?tab=roster');
});
test('missing bio has an explicit empty state', async () => {
  (getRosterProfile as jest.Mock).mockResolvedValue({ profile: { ...profile, bio: '  ' }, error: null }); setup();
  expect(await screen.findByText('No bio added yet.')).toBeInTheDocument();
});
test('missing or server-hidden profile does not expose account details', async () => {
  (getRosterProfile as jest.Mock).mockResolvedValue({ profile: null, error: null }); setup();
  expect(await screen.findByText('Profile unavailable')).toBeInTheDocument();
  expect(screen.queryByText('Alex')).not.toBeInTheDocument();
});
test('network error offers retry', async () => {
  (getRosterProfile as jest.Mock).mockResolvedValueOnce({ profile: null, error: 'error' }).mockResolvedValue({ profile, error: null }); setup();
  fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('heading', { name: 'Alex' })).toBeInTheDocument();
});
test('revoked or pending membership cannot fetch profile', async () => {
  mockGroup = { membership: { group_id: 'chapter', status: 'pending' } }; setup();
  expect(screen.getByText('Profile unavailable')).toBeInTheDocument();
  expect(getRosterProfile).not.toHaveBeenCalled();
});
