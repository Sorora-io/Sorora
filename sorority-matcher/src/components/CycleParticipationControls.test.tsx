import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CycleParticipationControls from './CycleParticipationControls';
import { setCycleParticipation, useCycleParticipation } from '../lib/cycleParticipation';
jest.mock('../lib/cycleParticipation', () => ({setCycleParticipation:jest.fn(), useCycleParticipation:jest.fn()}));
const roster: any[] = [{userId:'b',name:'Alex',role:'big'}, {userId:'l',name:'Sam',role:'little'}];
const mount=()=>render(<QueryClientProvider client={new QueryClient()}><CycleParticipationControls userId="a" groupId="g" cycleId="c" roster={roster}/></QueryClientProvider>);
beforeEach(()=>{
 jest.clearAllMocks();
 (useCycleParticipation as jest.Mock).mockReturnValue({data:{excludedIds:[],locked:false,version:'v1',history:[],pairings:[{bigId:'b',littleId:'l'}]},refetch:jest.fn()});
 (setCycleParticipation as jest.Mock).mockResolvedValue(undefined);
});
test('paired exclusion requires acknowledgment and sends reviewed version',async()=>{
 mount();fireEvent.change(screen.getByLabelText('Member'),{target:{value:'b'}});
 expect(screen.getByText('Alex → Sam')).toBeInTheDocument();
 expect(screen.getByRole('button',{name:'Exclude from this cycle'})).toBeDisabled();
 fireEvent.click(screen.getByRole('checkbox'));
 fireEvent.click(screen.getByRole('button',{name:'Exclude from this cycle'}));
 await waitFor(()=>expect(setCycleParticipation).toHaveBeenCalledWith('g','c','b',true,true,'v1'));
 expect(await screen.findByRole('status')).toHaveTextContent('Review the newly unpaired members');
});
test('restore preserves rankings and does not recreate pairs',async()=>{
 (useCycleParticipation as jest.Mock).mockReturnValue({data:{excludedIds:['b'],locked:false,version:'v2',history:[],pairings:[]}});
 mount();fireEvent.change(screen.getByLabelText('Member'),{target:{value:'b'}});
 fireEvent.click(screen.getByRole('button',{name:'Restore to this cycle'}));
 await waitFor(()=>expect(setCycleParticipation).toHaveBeenCalledWith('g','c','b',false,false,'v2'));
 expect(await screen.findByRole('status')).toHaveTextContent('not restored automatically');
});
test('reveal lock prevents participation edits',()=>{
 (useCycleParticipation as jest.Mock).mockReturnValue({data:{excludedIds:[],locked:true,history:[],pairings:[]}});
 mount();expect(screen.queryByLabelText('Member')).not.toBeInTheDocument();expect(screen.getByRole('status')).toHaveTextContent('locked');
});
test('failed participation load offers retry without allowing edits',()=>{
 const refetch=jest.fn();(useCycleParticipation as jest.Mock).mockReturnValue({error:new Error('offline'),refetch});
 mount();expect(screen.queryByLabelText('Member')).not.toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Try again'}));expect(refetch).toHaveBeenCalled();
});
