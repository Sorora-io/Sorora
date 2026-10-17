let mockEmailTools=true;
jest.mock('../../lib/features',()=>({get SHOW_MATCHING_EMAIL_TOOLS(){return mockEmailTools;}}));
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Settings from './Settings';
import { updateBlindRankings, updateGroupProfile, updateMaxLittlesPerBig, updateGroupDeadline, updateGroupSettings, updateGroupDescription, updateRevealEmailTemplate } from '../../lib/groups';
const mockRefresh = jest.fn();
jest.mock('sonner', () => ({ toast: { success: jest.fn() } }));
let mockGroup: any;
jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn(), Link: ({to,children}: any) => <a href={to}>{children}</a> }), {virtual:true});
jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({user:null}) }));
jest.mock('../../contexts/GroupContext', () => ({useGroup:()=>({membership:{group:mockGroup},refresh:mockRefresh})}));
jest.mock('../../lib/groups', () => ({
  updateGroupDeadline: jest.fn(),
  updateGroupSettings: jest.fn(),
  updateMaxLittlesPerBig: jest.fn(),
  updateBlindRankings: jest.fn(),
  updateGroupProfile: jest.fn(),
  updateGroupDescription: jest.fn(),
  updateRevealEmailTemplate: jest.fn(),
  renderRevealTemplate: (t: string) => t,
  DEFAULT_REVEAL_SUBJECT: 'default subject',
  DEFAULT_REVEAL_BODY: 'default body',
  getGroupCycles: async()=>({cycles:[]}),
  getGroupAdmins: async()=>({admins:[]}),
  getApprovedRoleCounts: async()=>({bigs:2,littles:2}),
}));
beforeEach(()=>{
  jest.clearAllMocks();mockEmailTools=true;
  mockGroup={id:'chapter',name:'Test',school:'University',blind_rankings:true,min_big_rankings:1,min_little_rankings:1};
  (updateGroupDeadline as jest.Mock).mockResolvedValue({error:null});
  (updateGroupSettings as jest.Mock).mockResolvedValue({error:null});
  mockRefresh.mockResolvedValue(undefined);
});
test('privacy toggle is a draft until Save changes is clicked',async()=>{
  (updateBlindRankings as jest.Mock).mockImplementation(async(_id,blind)=>{mockGroup.blind_rankings=blind;return {error:null};});
  render(<Settings/>);
  expect(screen.queryByRole('button',{name:'Cancel'})).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('switch',{name:'Blind rankings'}));
  expect(updateBlindRankings).not.toHaveBeenCalled();
  expect(screen.getByText('Unsaved changes')).toHaveAttribute('role','status');
  fireEvent.click(screen.getByRole('button',{name:'Save changes'}));
  await waitFor(()=>expect(screen.queryByRole('button',{name:'Save changes'})).not.toBeInTheDocument());
  expect(updateBlindRankings).toHaveBeenLastCalledWith('chapter',false);
  expect(screen.getByRole('switch')).toHaveAttribute('aria-checked','false');
});
test('Cancel discards privacy changes without saving',()=>{
  render(<Settings/>);
  fireEvent.click(screen.getByRole('switch',{name:'Blind rankings'}));
  fireEvent.click(screen.getByRole('button',{name:'Cancel'}));
  expect(screen.getByRole('switch')).toHaveAttribute('aria-checked','true');
  expect(screen.queryByRole('button',{name:'Save changes'})).not.toBeInTheDocument();
  expect(updateBlindRankings).not.toHaveBeenCalled();
});
test('failed privacy saves retain the draft for retry',async()=>{
  (updateBlindRankings as jest.Mock).mockResolvedValue({error:'Could not save privacy'});
  render(<Settings/>);
  fireEvent.click(screen.getByRole('switch',{name:'Blind rankings'}));
  fireEvent.click(screen.getByRole('button',{name:'Save changes'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not save privacy');
  expect(mockGroup.blind_rankings).toBe(true);
  expect(screen.getByRole('switch')).toHaveAttribute('aria-checked','false');
  expect(screen.getByRole('button',{name:'Save changes'})).toBeEnabled();
});

test('organization saves as text and cancelling discards draft edits', async () => {
  (updateGroupProfile as jest.Mock).mockImplementation(async (_id,name,school) => {
    mockGroup = {...mockGroup,name,school}; return {error:null};
  });
  render(<Settings/>);
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Edit organization'}));
  fireEvent.change(screen.getByPlaceholderText('e.g. Alpha Beta Chapter'),{target:{value:'Saved Chapter'}});
  fireEvent.click(screen.getByRole('button',{name:'Save changes'}));
  await waitFor(()=>expect(screen.queryByRole('textbox')).not.toBeInTheDocument());
  expect(screen.getByText('Saved Chapter')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Edit organization'}));
  fireEvent.change(screen.getByPlaceholderText('e.g. Alpha Beta Chapter'),{target:{value:'Unsaved draft'}});
  fireEvent.click(screen.getByRole('button',{name:'Cancel'}));
  expect(screen.queryByText('Unsaved draft')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Edit organization'}));
  expect(screen.getByPlaceholderText('e.g. Alpha Beta Chapter')).toHaveValue('Saved Chapter');
});


test.each([
  ['Edit description', 'Description'],
  ['Edit email template', 'Subject'],
  ['Edit ranking rules', 'Ranking deadline (optional)'],
])('%s uses the shared save controls and discards cancelled drafts', async (edit, label) => {
  render(<Settings/>);
  fireEvent.click(screen.getByRole('button', {name: edit}));
  const field = screen.getByLabelText(label, {selector:'input, textarea'});
  const original = (field as HTMLInputElement).value;
  fireEvent.change(field, {target: {value: label.startsWith('Ranking') ? '2027-01-01' : 'Unsaved draft'}});
  expect(screen.getByRole('button', {name:'Save changes'})).toBeEnabled();
  fireEvent.click(screen.getByRole('button', {name:'Cancel'}));
  fireEvent.click(screen.getByRole('button', {name:edit}));
  expect(screen.getByLabelText(label, {selector:'input, textarea'})).toHaveValue(original);
});

test('privacy drafts must be saved or cancelled before editing another section', () => {
  render(<Settings/>);
  fireEvent.click(screen.getByRole('switch', {name:'Blind rankings'}));
  expect(screen.getByRole('button', {name:'Edit organization'})).toBeDisabled();
  fireEvent.click(screen.getByRole('button', {name:'Cancel'}));
  expect(screen.getByRole('button', {name:'Edit organization'})).toBeEnabled();
});

 test('matching maximum saves explicitly and failed saves preserve the draft', async () => {
  (updateMaxLittlesPerBig as jest.Mock).mockResolvedValueOnce({error:'Adjust active pairings first'}).mockImplementation(async (_id,maximum) => {
    mockGroup={...mockGroup,max_littles_per_big:maximum};return {error:null};
  });
  render(<Settings/>);
  fireEvent.click(screen.getByRole('button',{name:'Edit matching rules'}));
  fireEvent.change(screen.getByLabelText('Maximum Littles per Big'),{target:{value:'2'}});
  expect(updateMaxLittlesPerBig).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Save changes'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Adjust active pairings first');
  expect(screen.getByLabelText('Maximum Littles per Big')).toHaveValue('2');
  fireEvent.click(screen.getByRole('button',{name:'Save changes'}));
  await waitFor(()=>expect(screen.queryByRole('button',{name:'Save changes'})).not.toBeInTheDocument());
  expect(updateMaxLittlesPerBig).toHaveBeenLastCalledWith('chapter',2);
  fireEvent.click(screen.getByRole('button',{name:'Edit matching rules'}));
  fireEvent.change(screen.getByLabelText('Maximum Littles per Big'),{target:{value:'1'}});
  fireEvent.click(screen.getByRole('button',{name:'Cancel'}));
  fireEvent.click(screen.getByRole('button',{name:'Edit matching rules'}));
  expect(screen.getByLabelText('Maximum Littles per Big')).toHaveValue('2');
 });


test('new deadlines require a zone and save the correctly converted instant', async () => {
  render(<Settings/>);fireEvent.click(screen.getByRole('button',{name:'Edit ranking rules'}));
  fireEvent.change(screen.getByLabelText('Ranking deadline (optional)'),{target:{value:'2026-07-15T20:30'}});
  fireEvent.click(screen.getByRole('button',{name:'Save changes'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Choose a time zone');
  expect(updateGroupDeadline).not.toHaveBeenCalled();expect(updateGroupSettings).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText(/Deadline time zone/),{target:{value:'America/New_York'}});
  fireEvent.click(screen.getByRole('button',{name:'Save changes'}));
  await waitFor(()=>expect(updateGroupDeadline).toHaveBeenCalledWith('chapter','2026-07-16T00:30:00Z','America/New_York'));
});
test('editing unrelated rules preserves an existing legacy deadline', async () => {
  mockGroup.ranking_deadline='2026-09-29';render(<Settings/>);
  fireEvent.click(screen.getByRole('button',{name:'Edit ranking rules'}));
  expect(screen.getByLabelText('Ranking deadline (optional)')).toHaveValue('2026-09-30T00:00');
  expect(screen.getByLabelText(/Deadline time zone/)).toHaveValue('UTC');
  fireEvent.click(screen.getByRole('button',{name:'Save changes'}));
  await waitFor(()=>expect(screen.queryByRole('button',{name:'Save changes'})).not.toBeInTheDocument());
  expect(updateGroupDeadline).not.toHaveBeenCalled();
});
test('existing zoned deadlines reopen in their chosen zone and can be cleared', async () => {
  mockGroup.ranking_deadline_at='2026-07-16T00:30:00Z';mockGroup.ranking_deadline_timezone='America/New_York';
  render(<Settings/>);fireEvent.click(screen.getByRole('button',{name:'Edit ranking rules'}));
  expect(screen.getByLabelText('Ranking deadline (optional)')).toHaveValue('2026-07-15T20:30');
  fireEvent.change(screen.getByLabelText('Ranking deadline (optional)'),{target:{value:''}});
  fireEvent.click(screen.getByRole('button',{name:'Save changes'}));
  await waitFor(()=>expect(updateGroupDeadline).toHaveBeenCalledWith('chapter',null,'America/New_York'));
});
test('DST validation blocks saving and failed deadline saves retain the draft', async () => {
  render(<Settings/>);fireEvent.click(screen.getByRole('button',{name:'Edit ranking rules'}));
  fireEvent.change(screen.getByLabelText('Ranking deadline (optional)'),{target:{value:'2026-11-01T01:30'}});
  fireEvent.change(screen.getByLabelText(/Deadline time zone/),{target:{value:'America/New_York'}});
  fireEvent.click(screen.getByRole('button',{name:'Save changes'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('occurs twice');expect(updateGroupDeadline).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Ranking deadline (optional)'),{target:{value:'2026-11-01T03:30'}});
  (updateGroupDeadline as jest.Mock).mockRejectedValue(new Error('Offline'));
  fireEvent.click(screen.getByRole('button',{name:'Save changes'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not confirm');
  expect(screen.getByLabelText('Ranking deadline (optional)')).toHaveValue('2026-11-01T03:30');
  expect(screen.getByRole('button',{name:'Save changes'})).toBeEnabled();
});


const renderSuperuserSettings = () => {
  const refresh = jest.fn().mockResolvedValue(undefined);
  const group = {...mockGroup,id:'target',name:'Target chapter',school:'Target school',min_big_rankings:1,min_little_rankings:1};
  (updateBlindRankings as jest.Mock).mockImplementation(async (_id,blind)=>{group.blind_rankings=blind;return {error:null};});
  (updateMaxLittlesPerBig as jest.Mock).mockImplementation(async (_id,maximum)=>{group.max_littles_per_big=maximum;return {error:null};});
  render(<Settings superuserContext={{group,bigs:4,littles:5,refresh}} />);
  return refresh;
};
test.each([
  ['Edit organization','e.g. Alpha Beta Chapter','Renamed',updateGroupProfile,['target','Renamed','Target school']],
  ['Edit description','Description','New description',updateGroupDescription,['target','New description']],
  ['Edit email template','Subject','New subject',updateRevealEmailTemplate,['target','New subject',null]],
])('superuser %s saves to the explicit target rather than their active chapter', async (button,label,value,method,args) => {
  (method as jest.Mock).mockResolvedValue({error:null});
  const refresh=renderSuperuserSettings();
  fireEvent.click(screen.getByRole('button',{name:button as string}));
  const field=label==='e.g. Alpha Beta Chapter'?screen.getByPlaceholderText(label):screen.getByLabelText(label as string,{selector:'input, textarea'});
  fireEvent.change(field,{target:{value}});fireEvent.click(screen.getByRole('button',{name:'Save changes'}));
  await waitFor(()=>expect(method).toHaveBeenCalledWith(...args));
  await waitFor(()=>expect(refresh).toHaveBeenCalled());expect(mockRefresh).not.toHaveBeenCalled();
});
test('superuser privacy, maximum and zoned deadline use the explicit target', async () => {
  (updateBlindRankings as jest.Mock).mockResolvedValue({error:null});
  (updateMaxLittlesPerBig as jest.Mock).mockResolvedValue({error:null});
  renderSuperuserSettings();
  expect(screen.getByRole('status')).toHaveTextContent('Target chapter');
  expect(screen.queryByRole('button',{name:'Start a new cycle'})).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('switch',{name:'Blind rankings'}));fireEvent.click(screen.getByRole('button',{name:'Save changes'}));
  await waitFor(()=>expect(updateBlindRankings).toHaveBeenCalledWith('target',false));
  await waitFor(()=>expect(screen.queryByRole('button',{name:'Save changes'})).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole('button',{name:'Edit matching rules'}));fireEvent.change(screen.getByLabelText('Maximum Littles per Big'),{target:{value:'2'}});fireEvent.click(screen.getByRole('button',{name:'Save changes'}));
  await waitFor(()=>expect(updateMaxLittlesPerBig).toHaveBeenCalledWith('target',2));
  await waitFor(()=>expect(screen.queryByRole('button',{name:'Save changes'})).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole('button',{name:'Edit ranking rules'}));
  expect(screen.getByText('You have 4 approved bigs.')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Ranking deadline (optional)'),{target:{value:'2026-12-01T20:00'}});
  fireEvent.change(screen.getByLabelText(/Deadline time zone/),{target:{value:'America/New_York'}});
  fireEvent.click(screen.getByRole('button',{name:'Save changes'}));
  await waitFor(()=>expect(updateGroupDeadline).toHaveBeenCalledWith('target','2026-12-02T01:00:00Z','America/New_York'));
  expect(updateGroupSettings).toHaveBeenCalledWith('target',1,1);
});

test('hidden email tools remove the template editor from organization settings',()=>{
  mockEmailTools=false;render(<Settings/>);
  expect(screen.queryByRole('heading',{name:'Pairing reveal email'})).not.toBeInTheDocument();
  expect(screen.queryByRole('button',{name:'Edit email template'})).not.toBeInTheDocument();
  expect(screen.getByRole('heading',{name:'Matching rules'})).toBeInTheDocument();
});
