import {render,screen,fireEvent} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {getPairingConfirmations,setPairingConfirmation} from '../lib/pairingConfirmations';
import PairingGroups from './PairingGroups';
import {getRankingExport} from '../lib/rankingExport';
jest.mock('../contexts/AuthContext',()=>({useAuth:()=>({user:{id:'admin'}})}));
jest.mock('../lib/pairingConfirmations',()=>({getPairingConfirmations:jest.fn(),setPairingConfirmation:jest.fn()}));
let mockDecisions:any[]=[];let mockVersion=1;
jest.mock('../lib/rankingExport',()=>({getRankingExport:jest.fn()}));
const pairings=[{bigId:'b1',bigName:'First Big',littleId:'l1',littleName:'First Little'},{bigId:'b2',bigName:'Other Big',littleId:'l2',littleName:'Other Little'}];
const data={members:[
 {userId:'b1',submitted:true,preferences:[{userId:'l1',rank:1}]},
 {userId:'l1',submitted:true,preferences:[{userId:'b1',rank:1}]},
 {userId:'b2',submitted:true,preferences:[{userId:'l2',rank:2}]},
 {userId:'l2',submitted:true,preferences:[]},
]};
const mount=(blind=false)=>render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><PairingGroups groupId="g" cycleId="c" blind={blind} pairings={pairings}/></QueryClientProvider>);
beforeEach(()=>{
 jest.clearAllMocks();mockDecisions=[];mockVersion=1;
 (getRankingExport as jest.Mock).mockResolvedValue(data);
 (getPairingConfirmations as jest.Mock).mockImplementation(async()=>({version:`v${mockVersion}`,lockReason:null,decisions:mockDecisions.map(d=>({...d}))}));
 (setPairingConfirmation as jest.Mock).mockImplementation(async(_g,_c,bigId,littleId,_version,confirmed)=>{
  mockDecisions=mockDecisions.filter(d=>d.bigId!==bigId || d.littleId!==littleId);
  mockDecisions.push({bigId,littleId,confirmed,reviewedBy:'Sample admin',reviewedAt:'2026-10-17T12:00:00Z'});mockVersion++;
 });
});
test('pairings are always visible by group size with review status and a text key',async()=>{
 mount();await screen.findByRole('heading',{name:'1:1 matchings'});
 expect(screen.getByText('First Big → First Little')).toBeInTheDocument();
 expect(screen.getByText('Other Big → Other Little')).toBeInTheDocument();
 expect(screen.getByText(/Big #2 · Little —/)).toBeInTheDocument();
 expect(screen.getByText(/One-sided ranking/)).toBeInTheDocument();
 expect(screen.getByText(/Mutual #1 or confirmed by an admin/)).toBeInTheDocument();
 expect(screen.getByText('First Big → First Little')).toBeInTheDocument();
 expect(screen.getByText('Big #1 · Little #1')).toBeInTheDocument();
});
test('blind chapters keep pairs visible without fetching or exposing ranked choices',async()=>{
 mount(true);await screen.findByRole('button',{name:'Confirm pairing: First Big and First Little'});expect(getRankingExport).not.toHaveBeenCalled();
 expect(screen.getByText(/Rank positions and automatic mutual first-choice confirmation are hidden/)).toBeInTheDocument();
 expect(screen.getByText('First Big → First Little')).toBeInTheDocument();
 expect(screen.queryByText('Big #1 · Little #1')).not.toBeInTheDocument();
});
test('failed ranking reads keep all pairs visible rather than assigning unverified groups',async()=>{
 (getRankingExport as jest.Mock).mockRejectedValue(new Error('Access denied'));
 mount();await screen.findByRole('button',{name:'Retry rank grouping'});
 expect(screen.getByText('First Big → First Little')).toBeInTheDocument();
 expect(screen.getByText('Other Big → Other Little')).toBeInTheDocument();
 expect(screen.queryByRole('heading',{name:'Confirmed 1'})).not.toBeInTheDocument();
});

test('confirm and undo persist through refetches and a remount',async()=>{
 const view=mount();await screen.findByRole('button',{name:'Confirm pairing: Other Big and Other Little'});
 fireEvent.click(screen.getByRole('button',{name:'Confirm pairing: Other Big and Other Little'}));
 await screen.findByRole('button',{name:'Move pairing to needs review: Other Big and Other Little'});
 expect(setPairingConfirmation).toHaveBeenCalledWith('g','c','b2','l2','v1',true);
 view.unmount();mount();await screen.findByRole('button',{name:'Move pairing to needs review: Other Big and Other Little'});
 expect(screen.getByText(/Confirmed by Sample admin/)).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Move pairing to needs review: Other Big and Other Little'}));
 await screen.findByRole('button',{name:'Confirm pairing: Other Big and Other Little'});
 expect(setPairingConfirmation).toHaveBeenLastCalledWith('g','c','b2','l2','v2',false);
});
test('an admin can override automatic first-choice confirmation back to review',async()=>{
 mount();await screen.findByRole('heading',{name:'1:1 matchings'});
 fireEvent.click(screen.getByRole('button',{name:'Move pairing to needs review: First Big and First Little'}));
 await screen.findByRole('button',{name:'Confirm pairing: First Big and First Little'});
 expect(screen.getByRole('button',{name:'Confirm pairing: Other Big and Other Little'})).toBeInTheDocument();
});
test('failed confirmation never moves the pair or loses the error',async()=>{
 (setPairingConfirmation as jest.Mock).mockRejectedValue(new Error('Pairings changed. Refresh and review before confirming.'));
 mount();await screen.findByRole('button',{name:'Confirm pairing: Other Big and Other Little'});
 fireEvent.click(screen.getByRole('button',{name:'Confirm pairing: Other Big and Other Little'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('Pairings changed');
 expect(screen.getByRole('button',{name:'Confirm pairing: Other Big and Other Little'})).toBeInTheDocument();
});
test('read-only cycles disable review actions',async()=>{
 (getPairingConfirmations as jest.Mock).mockResolvedValue({version:'v1',lockReason:'Reveal sending has started.',decisions:[]});
 mount();await screen.findByRole('button',{name:'Confirm pairing: Other Big and Other Little'});
 expect(screen.getByRole('button',{name:'Confirm pairing: Other Big and Other Little'})).toBeDisabled();
});

test('one-to-one results precede larger families and a Big’s Littles remain together',async()=>{
 render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><PairingGroups groupId="g" cycleId="c" blind pairings={[...pairings,{bigId:'b2',bigName:'Other Big',littleId:'l3',littleName:'Third Little'}]}/></QueryClientProvider>);
 const single=await screen.findByRole('region',{name:'1:1 matchings'});
 const twins=screen.getByRole('region',{name:'1:2 matchings'});
 expect(single).toHaveTextContent('First Big');
 expect(single).not.toHaveTextContent('Other Big');
 expect(twins).toHaveTextContent('Other Little'); expect(twins).toHaveTextContent('Third Little');
 expect(single.compareDocumentPosition(twins) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});
