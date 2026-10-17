import { getSubmissionStatus, runMatching } from '../../lib/rankings';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import Status from './Status';
import { downloadRankingExport, getRankingExport } from '../../lib/rankingExport';
let mockBlind = true;
jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'admin' } }) }));
jest.mock('../../contexts/GroupContext', () => ({ useGroup: () => ({ membership: { group: { id: 'g', active_cycle_id: 'c', blind_rankings: mockBlind } } }) }));
jest.mock('../../components/PageHeader', () => ({ __esModule: true, default: ({ children }: any) => <header>{children}</header> }));
jest.mock('../../lib/rankings', () => ({ getSubmissionStatus: jest.fn(async () => ({ rows: [], error: null })), runMatching: jest.fn() }));
jest.mock('../../lib/reminders', () => ({ sendRankingReminders: jest.fn() }));
jest.mock('../../lib/rankingExport', () => ({ downloadRankingExport: jest.fn(), getRankingExport: jest.fn() }));
const mount = (path = '/group/status') => render(<MemoryRouter initialEntries={[path]}><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><Status /></QueryClientProvider></MemoryRouter>);
beforeEach(() => { jest.clearAllMocks(); mockBlind = true; (getSubmissionStatus as jest.Mock).mockResolvedValue({ rows: [], error: null }); });
test('blind chapters cannot download ranked choices and have no separate submissions download', async () => {
  (downloadRankingExport as jest.Mock).mockResolvedValue(undefined);
  mount();
  expect(screen.getByRole('button', { name: 'Download ranked choices' })).toBeDisabled();
  expect(screen.queryByRole('button', { name: 'View member rankings' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button',{name:'Export submissions CSV'})).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Download ranked choices'}));
  expect(downloadRankingExport).not.toHaveBeenCalled();
});
test('nonblind chapters can export rankings and see failures without a false success', async () => {
  mockBlind = false;
  (downloadRankingExport as jest.Mock).mockRejectedValue(new Error('Export unavailable'));
  mount();
  expect(await screen.findByRole('button', { name: 'View member rankings' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Download ranked choices' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Export unavailable');
  expect(downloadRankingExport).toHaveBeenCalledWith('g', 'c', true);
  expect(screen.queryByText('Your CSV download is ready.')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Download ranked choices' })).toBeEnabled();
});


test('dashboard rankings shortcut opens the member picker directly', async () => {
  mockBlind = false;
  (getRankingExport as jest.Mock).mockResolvedValue({ members: [{ userId:'b', name:'Beth', email:'b@example.com', role:'big', submitted:false, preferences:[] }] });
  mount('/group/status?view=rankings');
  expect(await screen.findByLabelText('Member')).toBeInTheDocument();
  expect(getRankingExport).toHaveBeenCalledWith('g', 'c', true);
});

test('blind rankings shortcut explains privacy without loading preferences', async () => {
  mount('/group/status?view=rankings');
  expect(await screen.findByRole('button', { name: 'Manage ranking privacy' })).toBeInTheDocument();
  expect(getRankingExport).not.toHaveBeenCalled();
  expect(screen.queryByLabelText('Member')).not.toBeInTheDocument();
});


test('matching network failure is uncertain and releases the button without claiming success', async () => {
  (getSubmissionStatus as jest.Mock).mockResolvedValue({ rows: [{userId:'a',role:'big',name:'Avery',email:'a@example.com',submitted:true}], error:null });
  (runMatching as jest.Mock).mockRejectedValue(new Error('Network offline'));
  mount();
  await screen.findByText('Avery');
  fireEvent.click(screen.getByRole('button',{name:'Run matching'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Check Pairings before running matching again');
  expect(screen.getByRole('button',{name:'Run matching'})).toBeEnabled();
});

test('blind submission status shows saved twins capacity without loading ranked choices', async () => {
  (getSubmissionStatus as jest.Mock).mockResolvedValue({rows:[
    {userId:'a',role:'big',name:'Avery',email:'a@example.com',submitted:true,wantedLittleCount:2,willingToTakeTwins:false},
    {userId:'b',role:'big',name:'Beth',email:'b@example.com',submitted:true,wantedLittleCount:3,willingToTakeTwins:false},
    {userId:'c',role:'big',name:'Carol',email:'c@example.com',submitted:true,wantedLittleCount:null,willingToTakeTwins:false},
    {userId:'d',role:'big',name:'Diana',email:'d@example.com',submitted:false,wantedLittleCount:null,willingToTakeTwins:false},
    {userId:'e',role:'little',name:'Emma',email:'e@example.com',submitted:true},
  ],error:null});
  mount();
  expect(await screen.findByText('Twins / triplets: Up to 2 Littles (twins)')).toBeInTheDocument();
  expect(screen.getByText('Twins / triplets: Up to 3 Littles (triplets)')).toBeInTheDocument();
  expect(screen.getByText('Twins / triplets: 1 Little (saved/default)')).toBeInTheDocument();
  expect(screen.getByText('Twins / triplets: Not submitted — defaults to 1 Little')).toBeInTheDocument();
  expect(getRankingExport).not.toHaveBeenCalled();
  expect(screen.getByRole('button',{name:'Download ranked choices'})).toBeDisabled();
});
