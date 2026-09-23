import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Profile from './Profile';
jest.mock('../components/EmailVerification', () => () => <section>Email verification</section>);
import { toast } from 'sonner';
jest.mock('sonner', () => ({ toast: { success: jest.fn() } }));
import FAQ from './FAQ';
import { queryKeys } from '../lib/queryKeys';
import { act } from '@testing-library/react';
import { getMyProfile, updateMyProfile } from '../lib/profile';

jest.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>,
  useNavigate: () => jest.fn(),
}), { virtual: true });
jest.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-1', email: 'jamie@example.com' }, signOut: jest.fn() }) }));
jest.mock('../contexts/GroupContext', () => ({ useGroup: () => ({ membership: { id: 'member-1', group_id: 'chapter-1', role: 'little', status: 'approved', group: { name: 'Alpha Chi Omega', school: 'New York University' } }, refresh: jest.fn() }) }));
jest.mock('../lib/groups', () => ({ requestRoleChange: jest.fn() }));
jest.mock('../lib/profile', () => ({ getMyProfile: jest.fn(), updateMyProfile: jest.fn(), uploadAvatar: jest.fn(), deleteMyAccount: jest.fn() }));
const profile = { name: 'Jamie Lee', bio: 'Coffee walks and good books.', major: 'Psychology', college: 'New York University', year: '2027', hometown: 'Boston, MA', avatar_url: null };
const mount = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><Profile /></QueryClientProvider>);
beforeEach(() => {
  jest.clearAllMocks();
  (getMyProfile as jest.Mock).mockResolvedValue({ profile, error: null });
  (updateMyProfile as jest.Mock).mockResolvedValue({ profile, error: null });
});
test('saves all profile fields together and shows single chapter membership', async () => {
  (updateMyProfile as jest.Mock).mockResolvedValue({ profile: { ...profile, name: 'Jamie Chen', bio: 'New bio' }, error: null });
  mount();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Edit profile' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Edit profile' }));
  await screen.findByDisplayValue('Jamie Lee');
  expect(screen.queryByText('Add Organization')).not.toBeInTheDocument();
  expect(screen.getByText('Chapter membership')).toBeInTheDocument();
  expect(screen.getByText('Account settings').closest('details')).not.toHaveAttribute('open');
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Jamie Chen' } });
  fireEvent.change(screen.getByLabelText('Bio'), { target: { value: 'New bio' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Changes saved', { duration: 2500 }));
  expect(screen.getByRole('heading', { name: 'Jamie Chen' })).toBeInTheDocument();
  expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Edit profile' })).toBeInTheDocument();
  expect(updateMyProfile).toHaveBeenCalledWith('Jamie Chen', 'New bio', null, 'Psychology', 'New York University', '2027', 'Boston, MA');
});
test('failed loading cannot overwrite existing profile with empty values', async () => {
  (getMyProfile as jest.Mock).mockResolvedValue({ profile: null, error: 'Network unavailable' });
  mount();
  await screen.findByRole('alert');
  expect(screen.getByRole('button', { name: 'Edit profile' })).toBeDisabled();
  expect(updateMyProfile).not.toHaveBeenCalled();
});
test('failed saves show error without claiming success', async () => {
  (updateMyProfile as jest.Mock).mockResolvedValue({ error: 'Could not save' });
  mount();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Edit profile' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Edit profile' }));
  await screen.findByDisplayValue('Jamie Lee');
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Could not save'));
  expect(toast.success).not.toHaveBeenCalled();
});

test('signed-in FAQ readers can return to the dashboard from both ends of the page', () => {
  render(<QueryClientProvider client={new QueryClient()}><FAQ /></QueryClientProvider>);
  const links = screen.getAllByRole('link', { name: 'Back to dashboard' });
  expect(links).toHaveLength(2);
  links.forEach(link => expect(link).toHaveAttribute('href', '/dashboard'));
});

test('reuses a warm profile cache and preserves a draft during background updates', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 60000 } } });
  client.setQueryData(queryKeys.myProfile('user-1'), profile);
  render(<QueryClientProvider client={client}><Profile /></QueryClientProvider>);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Edit profile' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Edit profile' }));
  await screen.findByDisplayValue('Jamie Lee');
  expect(getMyProfile).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Unsaved name' } });
  act(() => { client.setQueryData(queryKeys.myProfile('user-1'), { ...profile, name: 'Server name' }); });
  expect(screen.getByLabelText('Name')).toHaveValue('Unsaved name');
});

test('saving a new photo updates the profile and shared account header together', async () => {
  const { uploadAvatar } = require('../lib/profile');
  (uploadAvatar as jest.Mock).mockResolvedValue({ url: '/new-avatar.png', error: null });
  (updateMyProfile as jest.Mock).mockResolvedValue({ profile: { ...profile, avatar_url: '/new-avatar.png' }, error: null });
  const { container } = mount();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Edit profile' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Edit profile' }));
  await screen.findByDisplayValue('Jamie Lee');
  fireEvent.change(screen.getByLabelText('Choose profile photo'), {
    target: { files: [new File(['photo'], 'avatar.png', { type: 'image/png' })] },
  });
  await waitFor(() => expect(screen.getByRole('img', { name: 'Your profile' })).toHaveAttribute('src', '/new-avatar.png'));
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Changes saved', { duration: 2500 }));
  await waitFor(() => expect(container.querySelector('header img')).toHaveAttribute('src', '/new-avatar.png'));
});

test('profile starts as non-editable text and cancel discards changes', async () => {
  mount();
  expect(await screen.findByText('Coffee walks and good books.')).toBeInTheDocument();
  expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Edit profile' }));
  fireEvent.change(screen.getByLabelText('Bio'), { target: { value: 'Discard me' } });
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.getByText('Coffee walks and good books.')).toBeInTheDocument();
  expect(screen.queryByText('Discard me')).not.toBeInTheDocument();
  expect(updateMyProfile).not.toHaveBeenCalled();
});
