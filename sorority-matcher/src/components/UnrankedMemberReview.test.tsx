import {render,screen} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import UnrankedMemberReview from './UnrankedMemberReview';
import {supabase} from '../lib/supabase';
jest.mock('../contexts/AuthContext',()=>({useAuth:()=>({user:{id:'admin'}})}));
jest.mock('../lib/supabase',()=>({supabase:{rpc:jest.fn()}}));
const mount=(blind=false,deadline:string|null='2000-01-01')=>render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><UnrankedMemberReview groupId="g" cycleId="c" deadline={deadline} blind={blind}/></QueryClientProvider>);
beforeEach(()=>jest.clearAllMocks());
test('only post-deadline admin review identifies unranked members',async()=>{
 (supabase.rpc as jest.Mock).mockResolvedValue({data:{state:'ready',members:[{userId:'one',name:'Amy',role:'little'}]},error:null});
 mount();expect(await screen.findByText('No rankings received')).toBeInTheDocument();expect(screen.getByText('Amy · Little')).toBeInTheDocument();
 expect(screen.getByText(/requires a ranking connection/)).toBeInTheDocument();
});
test('blind chapters do not fetch or identify unranked members',()=>{mount(true);expect(screen.getByText(/keep preferences private/)).toBeInTheDocument();expect(supabase.rpc).not.toHaveBeenCalled();});
test('no deadline produces no warning or request',()=>{mount(false,null);expect(screen.queryByRole('region')).not.toBeInTheDocument();expect(supabase.rpc).not.toHaveBeenCalled();});
test('future deadline produces no warning or request',()=>{mount(false,'2099-01-01');expect(screen.queryByText('Post-deadline review')).not.toBeInTheDocument();expect(supabase.rpc).not.toHaveBeenCalled();});
test('errors do not look like an empty review',async()=>{(supabase.rpc as jest.Mock).mockResolvedValue({data:null,error:{message:'Unavailable'}});mount();expect(await screen.findByRole('alert')).toHaveTextContent('Could not check');expect(screen.queryByText(/Every approved/)).not.toBeInTheDocument();});
