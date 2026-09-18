import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Settings from './Settings';
import { updateBlindRankings } from '../../lib/groups';
const mockRefresh = jest.fn();
let mockGroup: any;
jest.mock('react-router-dom', () => ({ Link: ({to,children}: any) => <a href={to}>{children}</a> }), {virtual:true});
jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({user:null}) }));
jest.mock('../../contexts/GroupContext', () => ({useGroup:()=>({membership:{group:mockGroup},refresh:mockRefresh})}));
jest.mock('../../lib/groups', () => ({
  updateBlindRankings: jest.fn(),
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
test('turns blind rankings off and on through the chapter setting',async()=>{
  (updateBlindRankings as jest.Mock).mockImplementation(async(_id,blind)=>{mockGroup.blind_rankings=blind;return {error:null};});
  render(<Settings/>);
  const toggle=screen.getByRole('switch',{name:'Blind rankings'});
  expect(toggle).toHaveAttribute('aria-checked','true');
  fireEvent.click(toggle);
  await waitFor(()=>expect(toggle).toHaveAttribute('aria-checked','false'));
  expect(updateBlindRankings).toHaveBeenLastCalledWith('chapter',false);
  await waitFor(()=>expect(toggle).toBeEnabled());
  fireEvent.click(toggle);
  await waitFor(()=>expect(toggle).toHaveAttribute('aria-checked','true'));
  expect(updateBlindRankings).toHaveBeenLastCalledWith('chapter',true);
});
test('failed privacy updates leave the displayed protection enabled',async()=>{
  (updateBlindRankings as jest.Mock).mockResolvedValue({error:'Could not save privacy'});
  render(<Settings/>);
  fireEvent.click(screen.getByRole('switch',{name:'Blind rankings'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not save privacy');
  expect(screen.getByRole('switch')).toHaveAttribute('aria-checked','true');
  expect(mockRefresh).not.toHaveBeenCalled();
});
