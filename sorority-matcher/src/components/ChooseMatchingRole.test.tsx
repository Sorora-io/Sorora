import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ChooseMatchingRole from './ChooseMatchingRole';
import { setMyAdminMatchingRole } from '../lib/groups';
const mockRefresh = jest.fn();
jest.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'admin-user' } }) }));
jest.mock('../contexts/GroupContext', () => ({ useGroup: () => ({ membership: { id: 'own-membership', user_id: 'admin-user', group_id: 'chapter', role: 'admin', is_admin: true, group: { active_cycle_id: 'cycle' } }, refresh: mockRefresh }) }));
jest.mock('../lib/groups', () => ({ isEffectiveAdmin: () => true, setMyAdminMatchingRole: jest.fn() }));
beforeEach(() => jest.clearAllMocks());
test('chooses the admin’s own matching role without selecting another member', async () => {
  (setMyAdminMatchingRole as jest.Mock).mockResolvedValue({ error: null });
  render(<QueryClientProvider client={new QueryClient()}><ChooseMatchingRole /></QueryClientProvider>);
  expect(screen.queryByRole('option', {name: /Little/})).not.toBeInTheDocument();
  expect(screen.getByText(/Admins cannot be Littles/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Become a Big' }));
  await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
  expect(setMyAdminMatchingRole).toHaveBeenCalledWith('chapter', 'big');
});
test('shows role-save failures without pretending the role changed', async () => {
  (setMyAdminMatchingRole as jest.Mock).mockResolvedValue({ error: 'Could not save role' });
  render(<QueryClientProvider client={new QueryClient()}><ChooseMatchingRole /></QueryClientProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'Become a Big' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not save role');
  expect(mockRefresh).not.toHaveBeenCalled();
});
