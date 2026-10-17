import { render, screen, fireEvent, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MemberRankings from './MemberRankings';
import { getRankingExport } from '../lib/rankingExport';
jest.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'admin' } }) }));
jest.mock('../lib/rankingExport', () => ({ getRankingExport: jest.fn() }));
const mount = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemberRankings groupId="g" cycleId="c" /></QueryClientProvider>);
beforeEach(() => jest.clearAllMocks());
test('loads on request and distinguishes ordered, empty and missing submissions', async () => {
  (getRankingExport as jest.Mock).mockResolvedValue({ members: [
    { userId: 'a', name: 'Alice', email: 'a@example.com', role: 'big', submitted: true, preferences: [
      { rank: 2, userId: 'c', name: 'Carol' }, { rank: 1, userId: 'b', name: 'Beth' },
    ] },
    { userId: 'b', name: 'Beth', email: 'b@example.com', role: 'little', submitted: false, preferences: [] },
    { userId: 'c', name: 'Carol', email: 'c@example.com', role: 'little', submitted: true, preferences: [] },
  ] });
  mount();
  expect(getRankingExport).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'View member rankings' }));
  const select = await screen.findByLabelText('Member');
  expect(getRankingExport).toHaveBeenCalledWith('g', 'c', true);
  fireEvent.click(select); fireEvent.click(screen.getByRole('option',{name:/Alice/}));
  const items = within(screen.getByRole('list', { name: 'Ranked preferences' })).getAllByRole('listitem');
  expect(items[0]).toHaveTextContent('1.Beth');
  expect(items[1]).toHaveTextContent('2.Carol');
  fireEvent.click(select); fireEvent.click(screen.getByRole('option',{name:/Beth/}));
  expect(screen.getByText('This member hasn’t submitted a ranking yet.')).toBeInTheDocument();
  expect(screen.queryByRole('list')).not.toBeInTheDocument();
  fireEvent.click(select); fireEvent.click(screen.getByRole('option',{name:/Carol/}));
  expect(screen.getByText('Submitted with no ranked preferences.')).toBeInTheDocument();
});
test('server denial hides preferences and offers retry', async () => {
  (getRankingExport as jest.Mock).mockRejectedValue(new Error('Blind rankings are on.'));
  mount();
  fireEvent.click(screen.getByRole('button', { name: 'View member rankings' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Blind rankings are on.');
  expect(screen.queryByLabelText('Member')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Retry rankings' })).toBeEnabled();
});
