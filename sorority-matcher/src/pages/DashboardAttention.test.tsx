import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DashboardTab } from './Dashboard';
import { getPendingMemberships } from '../lib/groups';
import { getSubmissionStatus, getMyRanking } from '../lib/rankings';
import { getPairingRevealStatus } from '../lib/pairings';

jest.mock('react-router-dom', () => ({ Link: ({ to, children }: any) => <a href={to}>{children}</a> }), { virtual: true });
jest.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'admin-user' } }) }));
jest.mock('../hooks/useMyProfile', () => ({ useMyProfile: () => ({ profile: null }) }));
jest.mock('../components/WelcomeTour', () => ({ __esModule: true, default: () => null, WELCOME_TOUR_KEY: 'k' }));
jest.mock('./Profile', () => ({ ProfileContent: () => null }));
jest.mock('../lib/groups', () => ({
  isEffectiveAdmin: () => true,
  groupLabel: (g: any) => g.name,
  getPendingMemberships: jest.fn(),
}));
jest.mock('../lib/rankings', () => ({
  getSubmissionStatus: jest.fn(), getMyRanking: jest.fn(), getFullRoster: jest.fn(),
}));
jest.mock('../lib/pairings', () => ({ getPairingRevealStatus: jest.fn() }));

const membership: any = {
  id: 'm', group_id: 'chapter', user_id: 'admin-user', role: 'admin', is_admin: true,
  group: { id: 'chapter', name: 'Test chapter', active_cycle_id: 'cycle', ranking_deadline: null },
};

const row = (role: string, submitted: boolean, i: number) => ({ userId: `${role}${i}`, role, submitted, name: null, email: '' });

const setup = ({ pending = 0, status = [] as any[], reveal = { total: 0, sent: 0, lastSentAt: null, scheduledAt: null, completedAt: null } }) => {
  (getPendingMemberships as jest.Mock).mockResolvedValue({ memberships: Array.from({ length: pending }, () => ({})), error: null });
  (getSubmissionStatus as jest.Mock).mockResolvedValue({ rows: status, error: null });
  (getMyRanking as jest.Mock).mockResolvedValue({ rankedIds: [], error: null });
  (getPairingRevealStatus as jest.Mock).mockResolvedValue({ status: reveal, error: null });
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <DashboardTab membership={membership} onNavigate={jest.fn()} onReplayTour={jest.fn()} />
    </QueryClientProvider>,
  );
};

beforeEach(() => jest.clearAllMocks());

test('pending join requests surface first, as the blocking item', async () => {
  setup({ pending: 2, status: [row('big', true, 1), row('little', true, 1)] });
  expect(await screen.findByText('2 join requests waiting')).toBeInTheDocument();
  expect(screen.getByText('What needs you')).toBeInTheDocument();
});

test('outstanding rankings are counted against the whole roster', async () => {
  setup({ status: [row('big', true, 1), row('big', false, 2), row('little', false, 1)] });
  expect(await screen.findByText("2 of 3 haven't submitted rankings")).toBeInTheDocument();
});

test('a fully-submitted roster with no pairings prompts matching', async () => {
  setup({ status: [row('big', true, 1), row('little', true, 1)] });
  expect(await screen.findByText('Everyone has submitted')).toBeInTheDocument();
  expect(screen.getByText('Run matching')).toBeInTheDocument();
});

test('matched pairings with un-notified Bigs prompt the reveal', async () => {
  setup({
    status: [row('big', true, 1), row('little', true, 1)],
    reveal: { total: 3, sent: 1, lastSentAt: null, scheduledAt: null, completedAt: null },
  });
  expect(await screen.findByText('2 Bigs not notified yet')).toBeInTheDocument();
  // Matching already ran, so it must not still be asking you to run it.
  expect(screen.queryByText('Everyone has submitted')).not.toBeInTheDocument();
});

test('nothing outstanding reads as caught up, not as an empty list', async () => {
  setup({
    status: [row('big', true, 1), row('little', true, 1)],
    reveal: { total: 1, sent: 1, lastSentAt: null, scheduledAt: null, completedAt: null },
  });
  // Wait on the loaded state specifically: an empty roster ALSO renders
  // "all caught up", so keying off that heading would pass before the
  // roster arrives and assert nothing.
  expect(await screen.findByText('Chapter progress')).toBeInTheDocument();
  expect(screen.getByText('You’re all caught up')).toBeInTheDocument();
  expect(screen.getByText(/Nothing is waiting on you/)).toBeInTheDocument();
});

test('an empty roster explains how people arrive instead of showing 0/0 meters', async () => {
  setup({ status: [] });
  expect(await screen.findByText(/No Bigs or Littles approved yet/)).toBeInTheDocument();
  expect(screen.queryByText('Chapter progress')).not.toBeInTheDocument();
});
