jest.mock('./lib/features',()=>({SHOW_MATCHING_EMAIL_TOOLS:true}));
jest.mock('./components/PairingGroups',()=>()=>null);
jest.mock('./components/MatchingReview',()=>()=>null);
jest.mock('./components/ClearPairings',()=>()=>null);
jest.mock('./lib/cycleParticipation', () => ({ useCycleParticipation: () => ({ data: { excludedIds: [] }, isSuccess: true, refetch: () => Promise.resolve() }) }));
jest.mock('./components/PairingChanges', () => () => null);
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useGroup } from './contexts/GroupContext';
import SubmitRanking from './pages/group/SubmitRanking';
import Pairings from './pages/group/Pairings';
import { getRoster, getMyRanking, submitRanking, getPairings } from './lib/rankings';
import { trackEvent } from './lib/analytics';
jest.mock('./lib/analytics', () => ({ trackEvent: jest.fn() }));
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
 expect(screen.getByRole('button',{name:'Submit rankings'})).toBeDisabled();
 expect(submitRanking).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Try again'}));
 await waitFor(()=>expect(screen.getByRole('button',{name:'Submit rankings'})).toBeEnabled());
 expect(screen.getByText('Your ranking (1)')).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Submit rankings'}));
 await waitFor(()=>expect(submitRanking).toHaveBeenCalledWith('g','c',['big']));
});
test('roster failure cannot seed an empty draft over existing rankings',async()=>{
 (getMyRanking as jest.Mock).mockResolvedValue({rankedIds:['big'],error:null});
 (getRoster as jest.Mock).mockResolvedValueOnce({roster:[],error:'Unavailable'}).mockResolvedValue({roster:[{userId:'big',name:'Test Big',email:'test@example.com'}],error:null});
 mount(<SubmitRanking/>);
 await screen.findByRole('alert');
 expect(screen.getByRole('button',{name:'Submit rankings'})).toBeDisabled();
 fireEvent.click(screen.getByRole('button',{name:'Try again'}));
 await waitFor(()=>expect(screen.getByText('Your ranking (1)')).toBeInTheDocument());
 expect(screen.getByRole('button',{name:'Submit rankings'})).toBeEnabled();
 expect(trackEvent).not.toHaveBeenCalled();
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
test('pairing email actions are absent even when the legacy email-tools flag is enabled',async()=>{
 mount(<Pairings/>);
 await screen.findByRole('button',{name:'Export pairings CSV'});
 expect(screen.queryByRole('button',{name:/Reveal to Bigs|Send now|Schedule|Send to/})).not.toBeInTheDocument();
 expect(sendPairingReveal).not.toHaveBeenCalled();
});

test('past deadline makes the saved ranking read-only', async()=>{
 (useGroup() as any).membership.group.ranking_deadline='2020-01-01';
 (getMyRanking as jest.Mock).mockResolvedValue({rankedIds:['big'],error:null});
 mount(<SubmitRanking/>);
 await screen.findByText('Your ranking (1)');
 expect(screen.getByRole('status',{name:'Ranking availability'})).toHaveTextContent('submissions are closed');
 expect(screen.getByRole('button',{name:'Submit rankings'})).toBeDisabled();
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
 fireEvent.click(screen.getByRole('button',{name:'Submit rankings'}));
 expect(await screen.findByText(/Could not confirm all ranking changes were saved/)).toBeInTheDocument();
 expect(screen.getByText('Your ranking (1)')).toBeInTheDocument();
 expect(screen.getByRole('button',{name:'Submit rankings'})).toBeEnabled();
 fireEvent.click(screen.getByRole('button',{name:'Submit rankings'}));
 await waitFor(()=>expect(submitRanking).toHaveBeenCalledTimes(2));
 await waitFor(()=>expect(trackEvent).toHaveBeenCalledWith('ranking_submitted'));
 expect(trackEvent).toHaveBeenCalledTimes(1);
});

test('ranking progress and save state follow edits, failures and confirmed saves', async () => {
 (getRoster as jest.Mock).mockResolvedValue({roster:[{userId:'big',name:'Test Big',email:'test@example.com'},{userId:'second',name:'Second Big',email:'second@example.com'}],error:null});
 (getMyRanking as jest.Mock).mockResolvedValue({rankedIds:['big'],error:null});
 (submitRanking as jest.Mock).mockResolvedValueOnce({error:'Sample save failure'}).mockResolvedValue({error:null});
 mount(<SubmitRanking/>);
 await screen.findByText('Your ranking (1)');
 expect(screen.getByRole('status',{name:'Ranking submission status'})).toHaveTextContent('Rankings submitted');
 fireEvent.click(screen.getByRole('button',{name:'Second Big'}));
 expect(screen.getByRole('status',{name:'Ranking submission status'})).toHaveTextContent('Unsaved changes');
 expect(screen.getByText('2 ranked · Minimum of 1 met')).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Submit rankings'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('Sample save failure');
 expect(screen.getByRole('status',{name:'Ranking submission status'})).toHaveTextContent('Unsaved changes');
 fireEvent.click(screen.getByRole('button',{name:'Submit rankings'}));
 await waitFor(()=>expect(screen.getByRole('status',{name:'Ranking submission status'})).toHaveTextContent('Rankings submitted. You can edit and resubmit before the deadline.'));
 fireEvent.click(screen.getByRole('button',{name:'Remove Second Big from ranking'}));
 expect(screen.getByRole('status',{name:'Ranking submission status'})).toHaveTextContent('Unsaved changes');
 expect(screen.queryByText('Rankings submitted. You can edit and resubmit before the deadline.')).not.toBeInTheDocument();
});
