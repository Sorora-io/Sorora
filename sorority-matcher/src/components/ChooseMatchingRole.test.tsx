import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ChooseMatchingRole from './ChooseMatchingRole';
import { resolveRoleChange } from '../lib/groups';
const mockRefresh = jest.fn();
jest.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'admin-user' } }) }));
jest.mock('../contexts/GroupContext', () => ({ useGroup: () => ({ membership: { id: 'own-membership', user_id: 'admin-user', group_id: 'chapter', role: 'admin', is_admin: true, group: { active_cycle_id: 'cycle' } }, refresh: mockRefresh }) }));
jest.mock('../lib/groups', () => ({ isEffectiveAdmin: () => true, resolveRoleChange: jest.fn() }));
beforeEach(() => jest.clearAllMocks());
test('chooses the admin’s own matching role without selecting another member', async () => {
  (resolveRoleChange as jest.Mock).mockResolvedValue({ error: null });
  render(<QueryClientProvider client={new QueryClient()}><ChooseMatchingRole /></QueryClientProvider>);
  fireEvent.change(screen.getByLabelText('My matching role'), { target: { value: 'little' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continue to my rankings' }));
  await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
  expect(resolveRoleChange).toHaveBeenCalledWith('own-membership', true, 'little');
});
test('shows role-save failures without pretending the role changed', async () => {
  (resolveRoleChange as jest.Mock).mockResolvedValue({ error: 'Could not save role' });
  render(<QueryClientProvider client={new QueryClient()}><ChooseMatchingRole /></QueryClientProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'Continue to my rankings' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not save role');
  expect(mockRefresh).not.toHaveBeenCalled();
});
