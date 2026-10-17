import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PairingChanges from './PairingChanges';
import { changePairing, changePairings, getPairingEditor } from '../lib/pairingChanges';
jest.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'admin' } }) }));
jest.mock('../lib/pairingChanges', () => ({ changePairing: jest.fn(), changePairings: jest.fn(), getPairingEditor: jest.fn() }));
const initial = {
 version: 'v1', lockReason: null,
 pairings: [{littleId:'l1',littleName:'Amy',bigId:'b1',bigName:'Ava'},{littleId:'l2',littleName:'Bea',bigId:'b2',bigName:'Bella'}],
 bigs: [{id:'b1',name:'Ava',capacity:1},{id:'b2',name:'Bella',capacity:1},{id:'b3',name:'Cara',capacity:2}], history:[],
};
const onSaved = jest.fn();
const mount = () => {
 const client = new QueryClient({ defaultOptions:{queries:{retry:false}} });
 render(<QueryClientProvider client={client}><PairingChanges groupId="g" cycleId="c" onSaved={onSaved}/></QueryClientProvider>);
 return client;
};
beforeEach(()=>{jest.clearAllMocks();(getPairingEditor as jest.Mock).mockResolvedValue(initial);(changePairing as jest.Mock).mockResolvedValue(undefined);onSaved.mockResolvedValue(undefined);});
async function choose(to='b3') {
 fireEvent.click(await screen.findByRole('button',{name:'Edit pairings'}));
 fireEvent.click(screen.getByRole('button',{name:'Show everyone'}));
 fireEvent.click(screen.getByRole('button',{name:'Move Amy'}));
 fireEvent.click(screen.getAllByRole('button',{name:to==='b2' ? 'Exchange with Bella…' : 'Move to Cara'})[0]);
}
test('requires reason and explicit review confirmation before saving',async()=>{
 mount();await choose();
 expect(screen.getByRole('button',{name:'Review changes'})).toBeDisabled();
 fireEvent.change(screen.getByLabelText('Reason for this change (required)'),{target:{value:'Requested adjustment'}});
 fireEvent.click(screen.getByRole('button',{name:'Review changes'}));
 expect(changePairing).not.toHaveBeenCalled();
 expect(screen.getByRole('heading',{name:'Confirm pairing changes'})).toHaveFocus();
 expect(screen.getByText(/Ava → Cara/)).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Confirm changes'}));
 await waitFor(()=>expect(changePairing).toHaveBeenCalledWith('g','c','l1','b3',null,'v1','Requested adjustment'));
 expect(await screen.findByText(/Pairings updated/)).toBeInTheDocument();
});
test('full Big requires swap and review includes both affected Littles',async()=>{
 mount();await choose('b2');
 fireEvent.change(screen.getByLabelText('Reason for this change (required)'),{target:{value:'Mutual request'}});
 expect(screen.getByRole('button',{name:'Review changes'})).toBeDisabled();
 fireEvent.click(screen.getByRole('button',{name:'Exchange with Bea'}));
 fireEvent.click(screen.getByRole('button',{name:'Review changes'}));
 expect(screen.getByText(/Ava → Bella/)).toBeInTheDocument();expect(screen.getByText(/Bella → Ava/)).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Confirm changes'}));
 await waitFor(()=>expect(changePairing).toHaveBeenCalledWith('g','c','l1','b2','l2','v1','Mutual request'));
});
test('cancel makes no write',async()=>{
 mount();await choose();fireEvent.click(screen.getByRole('button',{name:'Cancel editing'}));
 expect(changePairing).not.toHaveBeenCalled();expect(screen.getByRole('button',{name:'Edit pairings'})).toBeInTheDocument();
});
test('closed cycles retain history without editing',async()=>{
 (getPairingEditor as jest.Mock).mockResolvedValue({...initial,lockReason:'This cycle is closed.',history:[{id:'h',actor_name:'Admin One',created_at:'2026-09-27T12:00:00Z',reason:'Mutual request',changes:[{littleId:'l1',littleName:'Amy',fromBigName:'Ava',toBigName:'Bella'}]}]});
 mount();expect(await screen.findByText('This cycle is closed.')).toBeInTheDocument();
 expect(screen.getByText(/Mutual request/)).toBeInTheDocument();expect(screen.queryByRole('button',{name:'Edit pairings'})).not.toBeInTheDocument();
});
test('background change invalidates an open confirmation instead of silently rebasing',async()=>{
 const client=mount();await choose();
 fireEvent.change(screen.getByLabelText('Reason for this change (required)'),{target:{value:'Request'}});
 fireEvent.click(screen.getByRole('button',{name:'Review changes'}));
 await act(async()=>{client.setQueryData(['user','admin','pairing-editor','g','c'],{...initial,version:'v2',lockReason:'Reveal sending has started.'});});
 await waitFor(()=>expect(screen.getByRole('button',{name:'Confirm changes'})).toBeDisabled());expect(changePairing).not.toHaveBeenCalled();
});
test('failed save retains reason and does not claim success',async()=>{
 (changePairing as jest.Mock).mockRejectedValue(new Error('Cycle closed during review.'));
 mount();await choose();fireEvent.change(screen.getByLabelText('Reason for this change (required)'),{target:{value:'Request'}});
 fireEvent.click(screen.getByRole('button',{name:'Review changes'}));fireEvent.click(screen.getByRole('button',{name:'Confirm changes'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('Cycle closed during review.');
 expect(screen.queryByText(/Pairings updated/)).not.toBeInTheDocument();expect(onSaved).not.toHaveBeenCalled();
});

const drag = (little: string, big: string) => {
 const dataTransfer = { setData: jest.fn(), effectAllowed: '', dropEffect: '' };
 fireEvent.dragStart(screen.getByTestId(`little-card-${little}`), { dataTransfer });
 fireEvent.dragOver(screen.getByTestId(`big-card-${big}`), { dataTransfer });
 fireEvent.drop(screen.getByTestId(`big-card-${big}`), { dataTransfer });
};
test('dragging into an open slot previews the move without saving', async () => {
 mount(); fireEvent.click(await screen.findByRole('button', {name:'Edit pairings'}));
 fireEvent.click(screen.getByRole('button',{name:'Show everyone'}));
 drag('l1','b3');
 expect(within(screen.getByTestId('big-card-b3')).getByText('Amy')).toBeInTheDocument();
 expect(within(screen.getByTestId('big-card-b1')).queryByText('Amy')).not.toBeInTheDocument();
 expect(screen.getByText('Proposed changes · not saved')).toBeInTheDocument();
 expect(screen.getByRole('button', {name:'Review changes'})).toBeDisabled();
 expect(changePairing).not.toHaveBeenCalled();
});
test('dropping onto a full Big waits for an exchange selection', async () => {
 mount(); fireEvent.click(await screen.findByRole('button', {name:'Edit pairings'}));
 fireEvent.click(screen.getByRole('button',{name:'Show everyone'}));
 drag('l1','b2');
 expect(within(screen.getByTestId('big-card-b1')).getByText('Amy')).toBeInTheDocument();
 expect(screen.getByRole('status')).toHaveTextContent('at capacity');
 fireEvent.click(screen.getByRole('button', {name:'Exchange with Bea'}));
 expect(within(screen.getByTestId('big-card-b2')).getByText('Amy')).toBeInTheDocument();
 expect(within(screen.getByTestId('big-card-b1')).getByText('Bea')).toBeInTheDocument();
 expect(changePairing).not.toHaveBeenCalled();
});
test('same-Big drop or cancelled drag does not create a proposed change', async () => {
 mount(); fireEvent.click(await screen.findByRole('button', {name:'Edit pairings'}));
 fireEvent.click(screen.getByRole('button',{name:'Show everyone'}));
 drag('l1','b1');
 expect(screen.queryByText('Proposed changes · not saved')).not.toBeInTheDocument();
 const dataTransfer = {setData:jest.fn()};
 fireEvent.dragStart(screen.getByTestId('little-card-l1'), {dataTransfer});
 fireEvent.dragEnd(screen.getByTestId('little-card-l1'));
 expect(screen.queryByText('Proposed changes · not saved')).not.toBeInTheDocument();
 expect(changePairing).not.toHaveBeenCalled();
});

test('editing starts empty and selecting a Little reveals only their current Big', async () => {
 mount(); fireEvent.click(await screen.findByRole('button', {name:'Edit pairings'}));
 expect(screen.queryByTestId('big-card-b1')).not.toBeInTheDocument();
 fireEvent.change(screen.getByLabelText('Search Bigs and Littles'), {target:{value:'Amy'}});
 fireEvent.click(screen.getByRole('button',{name:'Add Amy · Little'}));
 expect(screen.getByTestId('big-card-b1')).toBeInTheDocument();
 expect(screen.queryByTestId('big-card-b2')).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Move Amy'}));
 fireEvent.change(screen.getByLabelText('Move Amy to…'),{target:{value:'Cara'}});
 fireEvent.click(screen.getByRole('button',{name:'Move to Cara'}));
 expect(within(screen.getByTestId('big-card-b3')).getByText('Amy')).toBeInTheDocument();
});
test('stages multiple edits and saves the reviewed batch once', async () => {
 (changePairings as jest.Mock).mockResolvedValue(undefined);
 mount(); await choose();
 fireEvent.change(screen.getByLabelText('Reason for this change (required)'),{target:{value:'Group requests'}});
 fireEvent.click(screen.getByRole('button',{name:'Add to batch'}));
 expect(changePairing).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Move Bea'}));
 fireEvent.click(screen.getAllByRole('button',{name:'Move to Ava'})[0]);
 fireEvent.click(screen.getByRole('button',{name:'Review changes'}));
 expect(screen.getByText(/Ava → Cara/)).toBeInTheDocument();
 expect(screen.getByText(/Bella → Ava/)).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Confirm changes'}));
 await waitFor(() => expect(changePairings).toHaveBeenCalledWith('g','c',[
  {littleId:'l1',toBigId:'b3',swapLittleId:null}, {littleId:'l2',toBigId:'b1',swapLittleId:null}
 ],'v1','Group requests'));
 expect(changePairing).not.toHaveBeenCalled();
});
