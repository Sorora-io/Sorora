import {render,screen,fireEvent} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import MatchingReview from './MatchingReview';import {supabase} from '../lib/supabase';
let mockUser:any={id:'admin'};
jest.mock('../contexts/AuthContext',()=>({useAuth:()=>({user:mockUser})}));
jest.mock('../lib/supabase',()=>({supabase:{rpc:jest.fn()}}));
const show=()=>render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><MatchingReview groupId="chapter" cycleId="cycle"/></QueryClientProvider>);
beforeEach(()=>{jest.clearAllMocks();mockUser={id:'admin'};});
test('flags unmatched members and existing unsupported pairs without a deadline or ranked lists',async()=>{
 (supabase.rpc as jest.Mock).mockResolvedValue({data:{unmatched:[{userId:'l',name:'Amy',role:'little'}],unsupportedPairings:[{bigId:'b',littleId:'other',bigName:'Bea',littleName:'Kay'}]},error:null});show();
 expect(await screen.findByText('Amy · Little · Unmatched')).toBeInTheDocument();expect(screen.getByRole('alert')).toHaveTextContent('Bea → Kay');
 expect(supabase.rpc).toHaveBeenCalledWith('get_matching_review',{p_group_id:'chapter',p_cycle_id:'cycle'});
});
test('review failures stay visible and can be retried',async()=>{
 (supabase.rpc as jest.Mock).mockResolvedValueOnce({data:null,error:{message:'Unavailable'}}).mockResolvedValue({data:{unmatched:[],unsupportedPairings:[]},error:null});show();
 expect(await screen.findByRole('alert')).toHaveTextContent('Could not load');fireEvent.click(screen.getByRole('button',{name:'Refresh matching review'}));expect(await screen.findByText('Every participating member has a pairing.')).toBeInTheDocument();
});
test('signed-out users never fetch matching review',()=>{mockUser=null;show();expect(supabase.rpc).not.toHaveBeenCalled();});

test('one-sided rankings get a star and their own review flag',async()=>{
 (supabase.rpc as jest.Mock).mockResolvedValue({data:{unmatched:[],unsupportedPairings:[],oneSidedPairings:[{bigId:'b',littleId:'l',bigName:'Bea',littleName:'Amy'}]},error:null});show();
 expect(await screen.findByText('★ One-sided ranking')).toBeInTheDocument();expect(screen.getByText('Bea → Amy')).toBeInTheDocument();expect(screen.queryByText('Pairings with no ranking connection')).not.toBeInTheDocument();
});
