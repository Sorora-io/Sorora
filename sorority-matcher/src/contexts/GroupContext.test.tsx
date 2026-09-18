import { StrictMode } from 'react';
import { act, render, screen, waitFor, fireEvent } from '@testing-library/react';
import { GroupProvider, useGroup, stashPendingGroupAction } from './GroupContext';
import { createGroup, getMyMemberships } from '../lib/groups';
let mockUser: any = { id: 'alice', email: 'alice@example.com' };
jest.mock('./AuthContext', () => ({ useAuth: () => ({ user: mockUser, loading: false }) }));
jest.mock('../lib/groups', () => ({ createGroup: jest.fn(), getMyMemberships: jest.fn(), requestToJoinGroup: jest.fn() }));
const chapter = { id: 'membership', group_id: 'chapter', user_id: 'alice', role: 'admin', status: 'approved', group: { id: 'chapter' } };
const Consumer = () => {
  const { initialized, memberships, error, refresh } = useGroup();
  return <><p>{initialized ? `ready:${memberships.length}` : 'loading'}</p><p>{error}</p><button onClick={() => void refresh()}>Retry</button></>;
};
beforeEach(() => {
  jest.resetAllMocks(); localStorage.clear();
  mockUser = { id: 'alice', email: 'alice@example.com' };
});
test('finishes a pending chapter before becoming ready, once under StrictMode', async () => {
  stashPendingGroupAction({ mode: 'create', email: 'alice@example.com', groupName: 'Test', school: 'University' });
  (getMyMemberships as jest.Mock).mockResolvedValueOnce({ memberships: [], error: null }).mockResolvedValue({ memberships: [chapter], error: null });
  let complete: (value: any) => void = () => {};
  (createGroup as jest.Mock).mockReturnValue(new Promise(resolve => { complete = resolve; }));
  render(<StrictMode><GroupProvider><Consumer /></GroupProvider></StrictMode>);
  await waitFor(() => expect(createGroup).toHaveBeenCalledTimes(1));
  expect(screen.getByText('loading')).toBeInTheDocument();
  await act(async () => complete({ group: { id: 'chapter' }, error: null }));
  await screen.findByText('ready:1');
  expect(localStorage.getItem('sorora-pending-group-action')).toBeNull();
});
test('retains a failed chapter request and retries it visibly', async () => {
  stashPendingGroupAction({ mode: 'create', email: 'alice@example.com', groupName: 'Test', school: 'University' });
  (getMyMemberships as jest.Mock).mockResolvedValue({ memberships: [], error: null });
  (createGroup as jest.Mock).mockResolvedValueOnce({ error: 'Could not create chapter' }).mockResolvedValue({ group: { id: 'chapter' }, error: null });
  render(<GroupProvider><Consumer /></GroupProvider>);
  await screen.findByText('Could not create chapter');
  expect(localStorage.getItem('sorora-pending-group-action')).not.toBeNull();
  fireEvent.click(screen.getByText('Retry'));
  await waitFor(() => expect(createGroup).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(localStorage.getItem('sorora-pending-group-action')).toBeNull());
});
test('does not run a different account’s pending request', async () => {
  stashPendingGroupAction({ mode: 'create', email: 'bob@example.com', groupName: 'Test', school: 'University' });
  (getMyMemberships as jest.Mock).mockResolvedValue({ memberships: [], error: null });
  render(<GroupProvider><Consumer /></GroupProvider>);
  await screen.findByText('ready:0');
  expect(createGroup).not.toHaveBeenCalled();
});
test('a failed account switch never exposes the previous account’s memberships', async () => {
  (getMyMemberships as jest.Mock).mockResolvedValueOnce({ memberships: [chapter], error: null }).mockResolvedValue({ memberships: [], error: 'Load failed' });
  const view = render(<GroupProvider><Consumer /></GroupProvider>);
  await screen.findByText('ready:1');
  mockUser = { id: 'bob', email: 'bob@example.com' };
  view.rerender(<GroupProvider><Consumer /></GroupProvider>);
  await screen.findByText('Load failed');
  expect(screen.getByText('ready:0')).toBeInTheDocument();
});
