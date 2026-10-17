let mockEmailTools=true;
jest.mock('../lib/features',()=>({get SHOW_MATCHING_EMAIL_TOOLS(){return mockEmailTools;}}));
jest.mock('../lib/cycleParticipation', () => ({ useCycleParticipation: () => ({ data: { excludedIds: [] }, isSuccess: true, refetch: () => Promise.resolve() }) }));
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DashboardTab, OrganizationTab, RosterTab } from './Dashboard';
import { getPendingMemberships } from '../lib/groups';
import { getSubmissionStatus, getMyRanking, getFullRoster } from '../lib/rankings';
import { getPairingRevealStatus } from '../lib/pairings';

jest.mock('react-router-dom', () => ({ Link: ({ to, children }: any) => <a href={to}>{children}</a> }), { virtual: true });
jest.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'admin-user' } }) }));
jest.mock('../hooks/useMyProfile', () => ({ useMyProfile: () => ({ profile: null }) }));
jest.mock('../components/ChooseMatchingRole', () => ({ __esModule: true, default: () => <div>Become a Big invitation</div> }));
jest.mock('../components/WelcomeTour', () => ({ __esModule: true, default: () => null, WELCOME_TOUR_KEY: 'k' }));
jest.mock('./Profile', () => ({ ProfileContent: () => null }));
jest.mock('../lib/groups', () => ({
  isEffectiveAdmin: (m: any) => m.is_admin || m.role === 'admin',
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

const setup = ({ pending = 0, status = [] as any[], statusError = null as string | null, reveal = { total: 0, sent: 0, lastSentAt: null, scheduledAt: null, completedAt: null } as import('../lib/pairings').RevealStatus }, m = membership, navigate = jest.fn()) => {
  (getPendingMemberships as jest.Mock).mockResolvedValue({ memberships: Array.from({ length: pending }, () => ({})), error: null });
  (getSubmissionStatus as jest.Mock).mockResolvedValue({ rows: status, error: statusError });
  (getMyRanking as jest.Mock).mockResolvedValue({ rankedIds: [], error: null });
  (getPairingRevealStatus as jest.Mock).mockResolvedValue({ status: reveal, error: null });
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <DashboardTab membership={m} onNavigate={navigate} />
    </QueryClientProvider>,
  );
};

beforeEach(() => {jest.clearAllMocks();mockEmailTools=true;});

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
    reveal: { total: 42, sent: 0, unnotifiedBigs: 33, lastSentAt: null, scheduledAt: null, completedAt: null },
  });
  expect(await screen.findByText('33 Bigs not notified yet')).toBeInTheDocument();
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

test('failed scheduled reveal is urgent even when the roster is empty', async () => {
  setup({ reveal: {total:0,sent:0,lastSentAt:null,scheduledAt:null,completedAt:'2026-09-26',failureMessage:'Emails were not confirmed. No automatic retry will be made.'} as any });
  expect(await screen.findByText('Reveal delivery needs attention')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Review delivery' })).toBeInTheDocument();
  expect(screen.queryByText('You’re all caught up')).not.toBeInTheDocument();
});

test('older backend pairing counts are never labelled as people', async () => {
  setup({ reveal: {total:42,sent:0,lastSentAt:null,scheduledAt:null,completedAt:null} });
  expect(await screen.findByText('42 pairings not notified yet')).toBeInTheDocument();
  expect(screen.queryByText('42 Bigs not notified yet')).not.toBeInTheDocument();
});

const mountOrganization = (m = membership) => {
  const onNavigate = jest.fn();
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <OrganizationTab membership={m} onNavigate={onNavigate} />
  </QueryClientProvider>);
  return onNavigate;
};

test('organization shows pending approvals and shortcuts for a Big admin', async () => {
  (getPendingMemberships as jest.Mock).mockResolvedValue({ memberships: [{}, {}], error: null });
  const navigate = mountOrganization({ ...membership, role: 'big' });
  expect(await screen.findByLabelText('2 pending approvals')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'View submissions' }));
  expect(navigate).toHaveBeenLastCalledWith('/group/status');
  fireEvent.click(screen.getByRole('button', { name: 'View pairings' }));
  expect(navigate).toHaveBeenLastCalledWith('/group/pairings');
});

test('approval failures do not appear as zero pending requests', async () => {
  (getPendingMemberships as jest.Mock).mockResolvedValue({ memberships: [], error: 'Unavailable' });
  mountOrganization();
  expect(await screen.findByText('Count unavailable. Open approvals to review requests.')).toBeInTheDocument();
  expect(screen.queryByLabelText('0 pending approvals')).not.toBeInTheDocument();
});

test.each(['big', 'little'])('organization does not fetch or display admin tools for a %s', role => {
  mountOrganization({ ...membership, role, is_admin: false });
  expect(screen.queryByText('Your organization')).not.toBeInTheDocument();
  expect(getPendingMemberships).not.toHaveBeenCalled();
});


test.each(['admin', 'big', 'little'])('dashboard always offers member rankings to a %s admin', async role => {
  const navigate = jest.fn();
  setup({ status: [row('big', true, 1), row('little', true, 1)], reveal: {total:1,sent:1,lastSentAt:null,scheduledAt:null,completedAt:null} }, { ...membership, role }, navigate);
  expect(await screen.findByText('Chapter progress')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'View member rankings' }));
  expect(navigate).toHaveBeenCalledWith('/group/status?view=rankings');
});

test.each(['big', 'little'])('dashboard hides member rankings for a nonadmin %s', role => {
  setup({}, { ...membership, role, is_admin: false });
  expect(screen.queryByRole('button', { name: 'View member rankings' })).not.toBeInTheDocument();
});

test('organization keeps member rankings reachable when blind rankings are on', () => {
  const navigate = mountOrganization();
  fireEvent.click(screen.getByRole('button', { name: 'View member rankings' }));
  expect(navigate).toHaveBeenCalledWith('/group/status?view=rankings');
  expect(screen.getByText(/Blind rankings are on. Open this page/)).toBeInTheDocument();
});


test('submission lookup failure is not presented as an empty or caught-up chapter', async () => {
  setup({statusError:'Connection failed'});
  expect(await screen.findByRole('alert')).toHaveTextContent('Submission counts are unavailable');
  expect(screen.queryByText('Nothing here yet')).not.toBeInTheDocument();
  expect(screen.queryByText('You’re all caught up')).not.toBeInTheDocument();
  expect(screen.getByRole('button',{name:'View member rankings'})).toBeEnabled();
});

test('dashboard roster names open the member profile with a roster return path', async () => {
  (getFullRoster as jest.Mock).mockResolvedValue({ roster: [{ userId: 'member', name: 'Alex Member', email: 'alex@example.com', role: 'little' }], error: null });
  const navigate = jest.fn();
  render(<QueryClientProvider client={new QueryClient()}><RosterTab membership={membership} onNavigate={navigate} /></QueryClientProvider>);
  fireEvent.click(await screen.findByRole('button', { name: 'Alex Member' }));
  expect(navigate).toHaveBeenCalledWith('/group/roster/member?from=dashboard');
});

test('hidden email tools do not prompt admins to send reveal emails',async()=>{
  mockEmailTools=false;
  setup({status:[row('big',true,1),row('little',true,1)],reveal:{total:2,sent:0,lastSentAt:null,scheduledAt:null,completedAt:null}});
  await screen.findByText('Chapter progress');
  expect(screen.queryByRole('button',{name:'Reveal'})).not.toBeInTheDocument();
  expect(screen.queryByText(/not notified yet/)).not.toBeInTheDocument();
});
