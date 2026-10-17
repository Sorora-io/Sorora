import { act, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Index from './Index';
import { getMyProfile } from '../lib/profile';
import { queryKeys } from '../lib/queryKeys';
jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn() }), { virtual: true });
jest.mock('../components/SceneShell', () => ({ __esModule: true, default: ({ children, footer }: any) => <main>{children}{footer}</main>, SceneDots: () => null }));
jest.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'member-1' } }) }));
let mockGroup: any;
jest.mock('../contexts/GroupContext', () => ({ useGroup: () => mockGroup }));
jest.mock('../lib/profile', () => ({ getMyProfile: jest.fn() }));
const mount = (client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) => {
  const view = render(<QueryClientProvider client={client}><Index /></QueryClientProvider>);
  return { ...view, update: () => view.rerender(<QueryClientProvider client={client}><Index /></QueryClientProvider>) };
};
beforeEach(() => {
  mockGroup = { memberships: [], initialized: false, error: null };
  (getMyProfile as jest.Mock).mockReset();
});
test('cold load never claims the member has no chapter before membership resolves', async () => {
  let resolveProfile!: (value: any) => void;
  (getMyProfile as jest.Mock).mockReturnValue(new Promise(resolve => { resolveProfile = resolve; }));
  const view = mount();
  expect(screen.getByRole('status', { name: 'Loading your profile' })).toBeInTheDocument();
  expect(screen.getByRole('status', { name: 'Loading your chapter' })).toBeInTheDocument();
  expect(screen.queryByText(/haven't joined/)).not.toBeInTheDocument();
  await act(async () => resolveProfile({ profile: { name: 'Jamie Lee' }, error: null }));
  expect(await screen.findByRole('heading', { name: /Welcome back, Jamie/ })).toBeInTheDocument();
  mockGroup = { memberships: [{ group_id: 'chapter-1' }], initialized: true, error: null };
  view.update();
  expect(screen.getByText('Everything you need for your chapter is a click away.')).toBeInTheDocument();
  expect(screen.queryByText(/haven't joined/)).not.toBeInTheDocument();
});
test('cached profile stays visible on return visits and background refresh', () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(queryKeys.myProfile('member-1'), { name: 'Jamie Lee' });
  (getMyProfile as jest.Mock).mockReturnValue(new Promise(() => {}));
  mockGroup = { memberships: [{ group_id: 'chapter-1' }], initialized: true, error: null, loading: true };
  mount(client);
  expect(screen.getByRole('heading', { name: /Welcome back, Jamie/ })).toBeInTheDocument();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(getMyProfile).not.toHaveBeenCalled();
  act(() => { void client.invalidateQueries({ queryKey: queryKeys.myProfile('member-1') }); });
  expect(screen.getByRole('heading', { name: /Welcome back, Jamie/ })).toBeInTheDocument();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});
test('membership failures are not presented as no chapter', async () => {
  (getMyProfile as jest.Mock).mockResolvedValue({ profile: null, error: 'Offline' });
  mockGroup = { memberships: [], initialized: true, error: 'Offline' };
  mount();
  expect(screen.getByText('Your chapter information is temporarily unavailable.')).toBeInTheDocument();
  expect(screen.queryByText(/haven't joined/)).not.toBeInTheDocument();
  expect(await screen.findByRole('heading', { name: 'Welcome back.' })).toBeInTheDocument();
});
test('confirmed empty membership shows the onboarding message', () => {
  (getMyProfile as jest.Mock).mockReturnValue(new Promise(() => {}));
  mockGroup = { memberships: [], initialized: true, error: null };
  mount();
  expect(screen.getByText(/haven't joined a chapter/)).toBeInTheDocument();
});
