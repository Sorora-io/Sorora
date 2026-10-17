import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Pairings from './Pairings';
import { downloadPairingExport } from '../../lib/pairingExport';
import {getPairingRevealStatus} from '../../lib/pairings';
import { getPairings } from '../../lib/rankings';
const mockGroup={id:'g',name:'Sample chapter',active_cycle_id:'current'};
jest.mock('../../contexts/GroupContext',()=>({useGroup:()=>({membership:{group:mockGroup}})}));
jest.mock('../../components/PageHeader',()=>({__esModule:true,default:({children}:any)=><header>{children}</header>}));
jest.mock('../../components/PairingGroups',()=>()=>null);
jest.mock('../../components/ClearPairings',()=>()=>null);
jest.mock('../../components/MatchingReview',()=>()=>null);
jest.mock('../../components/UnrankedMemberReview',()=>()=>null);
jest.mock('../../components/PairingChanges',()=>()=>null);
jest.mock('../../lib/rankings',()=>({getPairings:jest.fn()}));
jest.mock('../../lib/pairingExport',()=>({downloadPairingExport:jest.fn()}));
jest.mock('../../lib/groups',()=>({getGroupCycles:async()=>({cycles:[{id:'current',label:'Current'},{id:'past',label:'Past',ended_at:'2025-01-01'}]})}));
jest.mock('../../lib/pairings',()=>({getPairingRevealStatus:jest.fn()}));
beforeEach(()=>{
  jest.clearAllMocks();
  (getPairingRevealStatus as jest.Mock).mockResolvedValue({status:null,error:null});
  (getPairings as jest.Mock).mockResolvedValue({pairings:[{bigId:'b',bigName:'Big',littleId:'l',littleName:'Little'}],error:null});
  (downloadPairingExport as jest.Mock).mockResolvedValue(undefined);
});
const mount=()=>render(<MemoryRouter><Pairings/></MemoryRouter>);
test('exports the selected historical cycle and leaves failures visible for retry',async()=>{
  mount();
  await waitFor(()=>expect(screen.getByRole('button',{name:'Export pairings CSV'})).toBeEnabled());
  fireEvent.change(screen.getByRole('combobox',{name:'Pairing cycle'}),{target:{value:'past'}});
  await waitFor(()=>expect(screen.getByRole('button',{name:'Export pairings CSV'})).toBeEnabled());
  (downloadPairingExport as jest.Mock).mockRejectedValue(new Error('Download unavailable'));
  fireEvent.click(screen.getByRole('button',{name:'Export pairings CSV'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Download unavailable');
  expect(downloadPairingExport).toHaveBeenCalledWith('Past','past',undefined,'g');
  expect(screen.getByRole('button',{name:'Export pairings CSV'})).toBeEnabled();
});
test('empty cycles cannot export',async()=>{
  (getPairings as jest.Mock).mockResolvedValue({pairings:[],error:null});
  mount();await screen.findByText('No pairings yet.');
  expect(screen.getByRole('button',{name:'Export pairings CSV'})).toBeDisabled();
});

test('reveal and schedule controls are hidden even when pairings are ready',async()=>{
  (getPairingRevealStatus as jest.Mock).mockResolvedValue({status:{total:1,sent:0,scheduledAt:null,completedAt:null,lastSentAt:null},error:null});
  mount();await waitFor(()=>expect(screen.getByRole('button',{name:'Export pairings CSV'})).toBeEnabled());
  expect(screen.queryByRole('heading',{name:'Reveal to Bigs'})).not.toBeInTheDocument();
  expect(screen.queryByRole('button',{name:'Reveal to Bigs now'})).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Or schedule a reveal')).not.toBeInTheDocument();
});
