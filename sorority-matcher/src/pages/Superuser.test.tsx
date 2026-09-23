import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Superuser from './Superuser';
import { getSuperuserAccounts, grantSuperuser, deleteSuperuserAccount, getSuperuserOrganizations, deleteSuperuserOrganization } from '../lib/superusers';
let mockAccess: any = { data: true };
let mockUser: any = { id: 'seed' };
jest.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: mockUser, loading: false }) }));
jest.mock('../hooks/useSuperuser', () => ({ useSuperuser: () => mockAccess }));
jest.mock('../components/PageHeader', () => ({ __esModule: true, default: ({ children }: any) => <header>{children}</header> }));
jest.mock('react-router-dom', () => ({ Link: ({ to, children }: any) => <a href={to}>{children}</a>, Navigate: ({ to }: any) => <div>Redirect {to}</div> }), { virtual: true });
jest.mock('../lib/superusers', () => ({ getSuperuserAccounts: jest.fn(), grantSuperuser: jest.fn(), deleteSuperuserAccount: jest.fn(), getSuperuserOrganizations: jest.fn(), deleteSuperuserOrganization: jest.fn() }));
const show = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}><Superuser /></QueryClientProvider>);
beforeEach(() => {
  jest.clearAllMocks(); mockUser = { id: 'seed' }; mockAccess = { data: true };
  (getSuperuserAccounts as jest.Mock).mockResolvedValue({ total: 1, accounts: [{ id: 'member', email: 'member@example.com', name: 'Member', verified: true, is_superuser: false, created_at: '2026-01-01', memberships: [{ group_id: 'chapter', group_name: 'Chapter', role: 'big', is_admin: true, status: 'approved' }] }] });
  (grantSuperuser as jest.Mock).mockResolvedValue(undefined);
  (deleteSuperuserAccount as jest.Mock).mockResolvedValue(undefined);
  (deleteSuperuserOrganization as jest.Mock).mockResolvedValue(undefined);
  (getSuperuserOrganizations as jest.Mock).mockResolvedValue({ total: 1, organizations: [{ id: 'org', name: 'Test chapter', school: 'Test school', owner_email: 'owner@example.com', join_code: 'TESTCODE', member_count: 8 }] });
});
test('denies ordinary users without fetching the directory', () => {
  mockAccess = { data: false }; show();
  expect(screen.getByText('Superuser access required')).toBeInTheDocument();
  expect(getSuperuserAccounts).not.toHaveBeenCalled();
});
test('redirects signed-out users without fetching the directory', () => {
  mockUser = null; show(); expect(screen.getByText('Redirect /login')).toBeInTheDocument();
  expect(getSuperuserAccounts).not.toHaveBeenCalled();
});
test('shows combined chapter roles and confirms promotion before granting', async () => {
  show(); expect(await screen.findByText('big + Admin · approved')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Make superuser' }));
  expect(grantSuperuser).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Confirm promotion' }));
  await waitFor(() => expect(grantSuperuser).toHaveBeenCalledWith('member', expect.anything()));
  expect(await screen.findByRole('status')).toHaveTextContent('member@example.com is now a superuser.');
});
test('shows server errors when promotion is denied', async () => {
  (grantSuperuser as jest.Mock).mockRejectedValue(new Error('Only a superuser can promote accounts.'));
  show(); fireEvent.click(await screen.findByRole('button', { name: 'Make superuser' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm promotion' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Only a superuser');
});

test('account deletion requires exact typed confirmation and refreshes', async () => {
  show(); fireEvent.click(await screen.findByRole('button', { name: 'Delete account' }));
  const confirm = screen.getByRole('button', { name: 'Permanently delete account' });
  expect(confirm).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Type delete to confirm'), { target: { value: 'DELETE' } });
  expect(confirm).toBeDisabled();
  expect(deleteSuperuserAccount).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Type delete to confirm'), { target: { value: 'delete' } });
  fireEvent.click(confirm);
  await waitFor(() => expect(deleteSuperuserAccount).toHaveBeenCalledWith({ userId: 'member', confirmation: 'delete' }, expect.anything()));
  expect(await screen.findByText('member@example.com was deleted.')).toBeInTheDocument();
});
test('cancel clears confirmation before another deletion', async () => {
  show(); fireEvent.click(await screen.findByRole('button', { name: 'Delete account' }));
  fireEvent.change(screen.getByLabelText('Type delete to confirm'), { target: { value: 'delete' } });
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  fireEvent.click(screen.getByRole('button', { name: 'Delete account' }));
  expect(screen.getByLabelText('Type delete to confirm')).toHaveValue('');
  expect(deleteSuperuserAccount).not.toHaveBeenCalled();
});
test('organizations directory lists ownership and requires confirmation to delete', async () => {
  show(); fireEvent.click(screen.getByRole('button', { name: 'Organizations' }));
  expect(await screen.findByText('Test chapter')).toBeInTheDocument();
  expect(screen.getByText('owner@example.com')).toBeInTheDocument();
  expect(screen.getByText('TESTCODE')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Copy join code for Test chapter' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Delete organization' }));
  expect(screen.getByRole('button', { name: 'Permanently delete organization' })).toBeDisabled();
  expect(deleteSuperuserOrganization).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Type delete to confirm'), { target: { value: 'delete' } });
  fireEvent.click(screen.getByRole('button', { name: 'Permanently delete organization' }));
  await waitFor(() => expect(deleteSuperuserOrganization).toHaveBeenCalledWith({ groupId: 'org', confirmation: 'delete' }, expect.anything()));
  expect(await screen.findByText('Test chapter was deleted.')).toBeInTheDocument();
});

test('verified accounts without a chapter can reach promotion confirmation', async () => {
  (getSuperuserAccounts as jest.Mock).mockResolvedValue({ total: 1, accounts: [{ id: 'no-chapter', email: 'solo@example.com', name: 'Solo', verified: true, is_superuser: false, created_at: '2026-01-01', memberships: [] }] });
  show();
  fireEvent.click(await screen.findByRole('button', { name: 'Make superuser' }));
  expect(screen.getByRole('dialog', { name: 'Confirm promotion' })).toHaveFocus();
  fireEvent.click(screen.getByRole('button', { name: 'Confirm promotion' }));
  await waitFor(() => expect(grantSuperuser).toHaveBeenCalledWith('no-chapter', expect.anything()));
});
