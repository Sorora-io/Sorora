import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Settings from './Settings';
import { updateBlindRankings, updateGroupProfile } from '../../lib/groups';
const mockRefresh = jest.fn();
jest.mock('sonner', () => ({ toast: { success: jest.fn() } }));
let mockGroup: any;
jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn(), Link: ({to,children}: any) => <a href={to}>{children}</a> }), {virtual:true});
jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({user:null}) }));
jest.mock('../../contexts/GroupContext', () => ({useGroup:()=>({membership:{group:mockGroup},refresh:mockRefresh})}));
jest.mock('../../lib/groups', () => ({
  updateBlindRankings: jest.fn(),
  updateGroupProfile: jest.fn(),
  updateRevealEmailTemplate: jest.fn(),
  renderRevealTemplate: (t: string) => t,
  DEFAULT_REVEAL_SUBJECT: 'default subject',
  DEFAULT_REVEAL_BODY: 'default body',
  getGroupCycles: async()=>({cycles:[]}),
  getGroupAdmins: async()=>({admins:[]}),
  getApprovedRoleCounts: async()=>({bigs:2,littles:2}),
}));
beforeEach(()=>{
  jest.clearAllMocks();
  mockGroup={id:'chapter',name:'Test',school:'University',blind_rankings:true};
  mockRefresh.mockResolvedValue(undefined);
});
test('saves privacy and returns to the read-only view',async()=>{
  (updateBlindRankings as jest.Mock).mockImplementation(async(_id,blind)=>{mockGroup.blind_rankings=blind;return {error:null};});
  render(<Settings/>);
  expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Edit privacy'}));
  fireEvent.click(screen.getByRole('switch',{name:'Blind rankings'}));
  await waitFor(()=>expect(screen.queryByRole('switch')).not.toBeInTheDocument());
  expect(updateBlindRankings).toHaveBeenLastCalledWith('chapter',false);
  expect(require('sonner').toast.success).toHaveBeenCalledWith('Changes saved',{duration:2500});
  expect(screen.queryByText('Privacy setting saved.')).not.toBeInTheDocument();
});
test('failed privacy updates leave the displayed protection enabled',async()=>{
  (updateBlindRankings as jest.Mock).mockResolvedValue({error:'Could not save privacy'});
  render(<Settings/>);
  fireEvent.click(screen.getByRole('button',{name:'Edit privacy'}));
  fireEvent.click(screen.getByRole('switch',{name:'Blind rankings'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not save privacy');
  expect(screen.getByRole('switch')).toHaveAttribute('aria-checked','true');
  expect(mockRefresh).not.toHaveBeenCalled();
});

test('organization saves as text and cancelling discards draft edits', async () => {
  (updateGroupProfile as jest.Mock).mockImplementation(async (_id,name,school) => {
    mockGroup = {...mockGroup,name,school}; return {error:null};
  });
  render(<Settings/>);
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Edit organization'}));
  fireEvent.change(screen.getByPlaceholderText('e.g. Alpha Beta Chapter'),{target:{value:'Saved Chapter'}});
  fireEvent.click(screen.getByRole('button',{name:'Save Name & School'}));
  await waitFor(()=>expect(screen.queryByRole('textbox')).not.toBeInTheDocument());
  expect(screen.getByText('Saved Chapter')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Edit organization'}));
  fireEvent.change(screen.getByPlaceholderText('e.g. Alpha Beta Chapter'),{target:{value:'Unsaved draft'}});
  fireEvent.click(screen.getByRole('button',{name:'Cancel'}));
  expect(screen.queryByText('Unsaved draft')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Edit organization'}));
  expect(screen.getByPlaceholderText('e.g. Alpha Beta Chapter')).toHaveValue('Saved Chapter');
});
