jest.mock('./lib/cycleParticipation', () => ({ useCycleParticipation: () => ({ data: { excludedIds: [] }, isSuccess: true, refetch: () => Promise.resolve() }) }));
jest.mock('./components/PairingChanges', () => () => null);
import { act, render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useGroup } from './contexts/GroupContext';
import SubmitRanking from './pages/group/SubmitRanking';
import Pairings from './pages/group/Pairings';
import { getRoster, getMyRanking, submitRanking, getPairings } from './lib/rankings';
import { getGroupCycles } from './lib/groups';
import { getPairingRevealStatus, sendPairingReveal } from './lib/pairings';

jest.mock('react-router-dom', () => ({ Link: ({children}: any) => <span>{children}</span>, useNavigate: () => jest.fn() }), { virtual: true });
jest.mock('./components/PageHeader', () => ({children}: any) => <header>{children}</header>);
jest.mock('./components/SceneShell', () => ({children}: any) => <div>{children}</div>);
jest.mock('./components/ChooseMatchingRole', () => () => null);
jest.mock('./contexts/AuthContext', () => ({useAuth: () => ({user: {id:'little'}})}));
jest.mock('./contexts/GroupContext', () => { const state = {membership: {id:'m',role:'little',group_id:'g',group:{id:'g',name:'Test',active_cycle_id:'c',min_little_rankings:1,ranking_deadline:null}},refresh:jest.fn()}; return {useGroup: () => state}; });
jest.mock('./lib/rankings', () => ({getRoster:jest.fn(),getMyRanking:jest.fn(),submitRanking:jest.fn(),getPairings:jest.fn()}));
jest.mock('./lib/groups', () => ({groupLabel:()=> 'Test',setMyLittlePreference:jest.fn(),getGroupCycles:jest.fn()}));
jest.mock('./lib/pairings', () => ({getPairingRevealStatus:jest.fn(),sendPairingReveal:jest.fn(),schedulePairingReveal:jest.fn(),cancelPairingReveal:jest.fn()}));
const mount=(node: React.ReactElement)=>render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}>{node}</QueryClientProvider>);
beforeEach(()=>{
 jest.clearAllMocks();
 (useGroup() as any).membership.group.ranking_deadline = null;
 (getRoster as jest.Mock).mockResolvedValue({roster:[{userId:'big',name:'Test Big',email:'test@example.com'}],error:null});
 (getMyRanking as jest.Mock).mockResolvedValue({rankedIds:[],error:null});
 (submitRanking as jest.Mock).mockResolvedValue({error:null});
 (getGroupCycles as jest.Mock).mockResolvedValue({cycles:[{id:'c',label:'Cycle 1'}],error:null});
 (getPairings as jest.Mock).mockResolvedValue({pairings:[{bigId:'b',bigName:'Big',littleId:'l',littleName:'Little'}],error:null});
 (getPairingRevealStatus as jest.Mock).mockResolvedValue({status:{total:1,sent:0,lastSentAt:null,scheduledAt:null,completedAt:null},error:null});
});
afterEach(cleanup);
test('ranking load errors block saving; retry restores the saved ranking before edits',async()=>{
 (getMyRanking as jest.Mock).mockResolvedValueOnce({rankedIds:[],error:'Connection lost'}).mockResolvedValue({rankedIds:['big'],error:null});
 mount(<SubmitRanking/>);
 expect(await screen.findByRole('alert')).toHaveTextContent('couldn’t load');
 expect(screen.getByRole('button',{name:'Save ranking'})).toBeDisabled();
 expect(submitRanking).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Try again'}));
 await waitFor(()=>expect(screen.getByRole('button',{name:'Save ranking'})).toBeEnabled());
 expect(screen.getByText('Your ranking (1)')).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Save ranking'}));
 await waitFor(()=>expect(submitRanking).toHaveBeenCalledWith('g','c',['big']));
});
test('roster failure cannot seed an empty draft over existing rankings',async()=>{
 (getMyRanking as jest.Mock).mockResolvedValue({rankedIds:['big'],error:null});
 (getRoster as jest.Mock).mockResolvedValueOnce({roster:[],error:'Unavailable'}).mockResolvedValue({roster:[{userId:'big',name:'Test Big',email:'test@example.com'}],error:null});
 mount(<SubmitRanking/>);
 await screen.findByRole('alert');
 expect(screen.getByRole('button',{name:'Save ranking'})).toBeDisabled();
 fireEvent.click(screen.getByRole('button',{name:'Try again'}));
 await waitFor(()=>expect(screen.getByText('Your ranking (1)')).toBeInTheDocument());
 expect(screen.getByRole('button',{name:'Save ranking'})).toBeEnabled();
});
test('failed reveal stays visible after mounting a fresh page, without sending again',async()=>{
 (getPairingRevealStatus as jest.Mock).mockResolvedValue({status:{total:2,sent:1,completedAt:'2026-09-26',failureMessage:'Some reveal emails failed. No automatic retry will be made.'},error:null});
 mount(<Pairings/>);
 expect(await screen.findByRole('alert')).toHaveTextContent('No automatic retry');
 expect(screen.getByRole('alert')).toHaveTextContent('1 of 2 pairings');
 expect(sendPairingReveal).not.toHaveBeenCalled();
 cleanup();
 mount(<Pairings/>);
 expect(await screen.findByRole('alert')).toHaveTextContent('No automatic retry');
 expect(sendPairingReveal).not.toHaveBeenCalled();
});
test('a failure warning is visible even without loaded pairings',async()=>{
 (getPairings as jest.Mock).mockResolvedValue({pairings:[],error:null});
 (getPairingRevealStatus as jest.Mock).mockResolvedValue({status:{total:0,sent:0,failureMessage:'Reveal could not finish. No automatic retry will be made.'},error:null});
 mount(<Pairings/>);
 expect(await screen.findByRole('alert')).toHaveTextContent('Reveal could not finish');
});
test('manual email failure does not claim all Bigs were notified',async()=>{
 (sendPairingReveal as jest.Mock).mockResolvedValue({result:{sent:0,total:1,bigs:0,unsent:1,failures:['SMTP failed']},error:null});
 mount(<Pairings/>);
 fireEvent.click(await screen.findByRole('button',{name:'Reveal to Bigs now'}));
 fireEvent.click(screen.getByRole('button',{name:'Send now'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('could not be confirmed');
 expect(screen.queryByText('All Bigs have already been notified.')).not.toBeInTheDocument();
});

test('scheduled outcome refreshes after a claimed send without retrying or replacing schedule edits',async()=>{
 jest.useFakeTimers();
 try {
  const status={total:1,sent:0,scheduledAt:'2026-09-26T10:00:00Z',completedAt:null,failureMessage:null};
  (getPairingRevealStatus as jest.Mock).mockResolvedValue({status,error:null});
  mount(<Pairings/>);
  const input=await screen.findByLabelText('Or schedule a reveal');
  fireEvent.change(input,{target:{value:'2026-09-28T12:00'}});
  (getPairingRevealStatus as jest.Mock).mockResolvedValue({status:{...status,completedAt:'2026-09-26T10:00:01Z',failureMessage:'Delivery is not yet confirmed.'},error:null});
  await act(async()=>{jest.advanceTimersByTime(30_000)});
  expect(screen.getByRole('alert')).toHaveTextContent('not yet confirmed');
  (getPairingRevealStatus as jest.Mock).mockResolvedValue({status:{...status,sent:1,completedAt:'2026-09-26T10:00:01Z'},error:null});
  await act(async()=>{jest.advanceTimersByTime(30_000)});
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(input).toHaveValue('2026-09-28T12:00');
  expect(sendPairingReveal).not.toHaveBeenCalled();
 } finally { cleanup(); jest.useRealTimers(); }
});

test('past deadline makes the saved ranking read-only', async()=>{
 (useGroup() as any).membership.group.ranking_deadline='2020-01-01';
 (getMyRanking as jest.Mock).mockResolvedValue({rankedIds:['big'],error:null});
 mount(<SubmitRanking/>);
 await screen.findByText('Your ranking (1)');
 expect(screen.getByRole('status')).toHaveTextContent('submissions are closed');
 expect(screen.getByRole('button',{name:'Save ranking'})).toBeDisabled();
 expect(screen.getByRole('button',{name:'Remove Test Big from ranking'})).toBeDisabled();
 expect(submitRanking).not.toHaveBeenCalled();
});
test('ranking controls identify the member and action', async()=>{
 (getMyRanking as jest.Mock).mockResolvedValue({rankedIds:['big'],error:null});
 mount(<SubmitRanking/>);
 expect(await screen.findByRole('button',{name:'Move Test Big up'})).toBeDisabled();
 fireEvent.click(screen.getByRole('button',{name:'Remove Test Big from ranking'}));
 expect(screen.getByText('Your ranking (0)')).toBeInTheDocument();
});

test('ranking network failure preserves choices and enables a deliberate retry', async()=>{
 (getMyRanking as jest.Mock).mockResolvedValue({rankedIds:['big'],error:null});
 (submitRanking as jest.Mock).mockRejectedValueOnce(new Error('Network offline')).mockResolvedValue({error:null});
 mount(<SubmitRanking/>);
 await screen.findByText('Your ranking (1)');
 fireEvent.click(screen.getByRole('button',{name:'Save ranking'}));
 expect(await screen.findByText(/Could not confirm all ranking changes were saved/)).toBeInTheDocument();
 expect(screen.getByText('Your ranking (1)')).toBeInTheDocument();
 expect(screen.getByRole('button',{name:'Save ranking'})).toBeEnabled();
 fireEvent.click(screen.getByRole('button',{name:'Save ranking'}));
 await waitFor(()=>expect(submitRanking).toHaveBeenCalledTimes(2));
});
