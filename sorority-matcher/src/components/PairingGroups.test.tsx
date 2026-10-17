import {render,screen,fireEvent} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import PairingGroups from './PairingGroups';
import {getRankingExport} from '../lib/rankingExport';
jest.mock('../contexts/AuthContext',()=>({useAuth:()=>({user:{id:'admin'}})}));
jest.mock('../lib/rankingExport',()=>({getRankingExport:jest.fn()}));
const pairings=[{bigId:'b1',bigName:'First Big',littleId:'l1',littleName:'First Little'},{bigId:'b2',bigName:'Other Big',littleId:'l2',littleName:'Other Little'}];
const data={members:[
 {userId:'b1',submitted:true,preferences:[{userId:'l1',rank:1}]},
 {userId:'l1',submitted:true,preferences:[{userId:'b1',rank:1}]},
 {userId:'b2',submitted:true,preferences:[{userId:'l2',rank:2}]},
 {userId:'l2',submitted:true,preferences:[]},
]};
const mount=(blind=false)=>render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><PairingGroups groupId="g" cycleId="c" blind={blind} pairings={pairings}/></QueryClientProvider>);
beforeEach(()=>{jest.clearAllMocks();(getRankingExport as jest.Mock).mockResolvedValue(data);});
test('mutual first choices have a separate collapsed section above other pairings with a text key',async()=>{
 mount();await screen.findByRole('heading',{name:'Mutual first choices (1)'});
 expect(screen.queryByText('First Big → First Little')).not.toBeInTheDocument();
 expect(screen.getByText('Other Big → Other Little')).toBeInTheDocument();
 expect(screen.getByText('Big’s rank of Little: #2')).toBeInTheDocument();
 expect(screen.getByText('Little’s rank of Big: Not ranked')).toBeInTheDocument();
 expect(screen.getByText('One-sided ranking')).toBeInTheDocument();
 expect(screen.getByText(/#1 = first choice/)).toBeInTheDocument();
 const button=screen.getByRole('button',{name:'Show mutual first choices'});expect(button).toHaveAttribute('aria-expanded','false');
 fireEvent.click(button);expect(screen.getByText('First Big → First Little')).toBeInTheDocument();
 expect(screen.getByText('Mutual first choice')).toBeInTheDocument();
});
test('blind chapters keep pairs visible without fetching or exposing ranked choices',()=>{
 mount(true);expect(getRankingExport).not.toHaveBeenCalled();
 expect(screen.getByText(/Rank positions and mutual first-choice grouping are hidden/)).toBeInTheDocument();
 expect(screen.getByText('First Big')).toBeInTheDocument();
 expect(screen.queryByText('Big’s rank of Little: #1')).not.toBeInTheDocument();
});
test('failed ranking reads keep all pairs visible rather than assigning unverified groups',async()=>{
 (getRankingExport as jest.Mock).mockRejectedValue(new Error('Access denied'));
 mount();await screen.findByRole('button',{name:'Retry rank grouping'});
 expect(screen.getByText('First Big')).toBeInTheDocument();
 expect(screen.getByText('Other Big')).toBeInTheDocument();
 expect(screen.queryByRole('heading',{name:'Mutual first choices (1)'})).not.toBeInTheDocument();
});
