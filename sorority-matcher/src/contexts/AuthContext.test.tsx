import { act, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './AuthContext';
import { queryKeys } from '../lib/queryKeys';

let mockListener: (event: string, session: any) => void;
const mockGetSession = jest.fn();
const mockSignUp = jest.fn();
const mockSignIn = jest.fn();
const mockTrack = jest.fn();
const mockReset = jest.fn();
jest.mock('../lib/analytics', () => ({ trackEvent: (...args: any[]) => mockTrack(...args), resetAnalyticsSession: () => mockReset() }));
beforeEach(() => { jest.clearAllMocks(); });
jest.mock('../lib/supabase', () => ({ supabase: { auth: {
  getSession: () => mockGetSession(),
  signUp: (...args: any[]) => mockSignUp(...args),
  signInWithPassword: (...args: any[]) => mockSignIn(...args),
  onAuthStateChange: (listener: typeof mockListener) => { mockListener = listener; return { data: { subscription: { unsubscribe: jest.fn() } } }; },
} } }));
const Consumer = () => { const { user } = useAuth(); return <div>{user?.id || 'signed-out'}</div>; };
test('retains cache on token refresh, clears it on account switch and sign-out', async () => {
  mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'alice' } } } });
  const client = new QueryClient();
  render(<QueryClientProvider client={client}><AuthProvider><Consumer /></AuthProvider></QueryClientProvider>);
  await screen.findByText('alice');
  client.setQueryData(queryKeys.myProfile('alice'), { name: 'Alice' });
  act(() => mockListener('TOKEN_REFRESHED', { user: { id: 'alice' } }));
  expect(client.getQueryData(queryKeys.myProfile('alice'))).toEqual({ name: 'Alice' });
  expect(mockReset).not.toHaveBeenCalled();
  act(() => mockListener('SIGNED_IN', { user: { id: 'bob' } }));
  await screen.findByText('bob');
  expect(client.getQueryCache().getAll()).toHaveLength(0);
  expect(mockReset).toHaveBeenCalledTimes(1);
  client.setQueryData(queryKeys.myProfile('bob'), { name: 'Bob' });
  act(() => mockListener('SIGNED_OUT', null));
  expect(client.getQueryCache().getAll()).toHaveLength(0);
});
test('late initial session cannot overwrite a newer authentication event', async () => {
  let resolve: (value: any) => void = () => {};
  mockGetSession.mockReturnValue(new Promise(done => { resolve = done; }));
  render(<QueryClientProvider client={new QueryClient()}><AuthProvider><Consumer /></AuthProvider></QueryClientProvider>);
  act(() => mockListener('SIGNED_IN', { user: { id: 'bob' } }));
  await act(async () => resolve({ data: { session: { user: { id: 'alice' } } } }));
  await waitFor(() => expect(screen.getByText('bob')).toBeInTheDocument());
});

test('authentication does not remount an in-progress signup form', async () => {
  mockGetSession.mockResolvedValue({ data: { session: null } });
  const { useState } = require('react');
  const Form = () => {
    const [draft, setDraft] = useState('');
    return <input aria-label="Chapter draft" value={draft} onChange={(event: any) => setDraft(event.target.value)} />;
  };
  const { fireEvent } = require('@testing-library/react');
  render(<QueryClientProvider client={new QueryClient()}><AuthProvider><Form /></AuthProvider></QueryClientProvider>);
  const input = screen.getByLabelText('Chapter draft');
  fireEvent.change(input, { target: { value: 'My chapter' } });
  act(() => mockListener('SIGNED_IN', { user: { id: 'new-user' } }));
  expect(screen.getByLabelText('Chapter draft')).toHaveValue('My chapter');
});

test('tracks only confirmed signup creation and successful explicit login, without account details', async () => {
  mockGetSession.mockResolvedValue({data:{session:null}});
  let auth: ReturnType<typeof useAuth>;
  const Actions = () => { auth = useAuth(); return null; };
  render(<QueryClientProvider client={new QueryClient()}><AuthProvider><Actions /></AuthProvider></QueryClientProvider>);
  await waitFor(() => expect(auth.loading).toBe(false));
  mockSignUp.mockResolvedValue({data:{user:{id:'private',identities:[{}]},session:null},error:null});
  await act(async () => { await auth.signUp('private@example.com','password','Private Name'); });
  expect(mockTrack).toHaveBeenLastCalledWith('sign_up_completed');
  mockSignUp.mockResolvedValue({data:{user:{identities:[]},session:null},error:null});
  await act(async () => { await auth.signUp('private@example.com','password'); });
  expect(mockTrack).toHaveBeenCalledTimes(1);
  mockSignIn.mockResolvedValueOnce({error:Error('failed')}).mockResolvedValueOnce({error:null});
  await act(async () => { await auth.signIn('private@example.com','password'); });
  expect(mockTrack).toHaveBeenCalledTimes(1);
  await act(async () => { await auth.signIn('private@example.com','password'); });
  expect(mockTrack).toHaveBeenLastCalledWith('login_completed');
  act(() => mockListener('TOKEN_REFRESHED',{user:{id:'private'}}));
  expect(mockTrack).toHaveBeenCalledTimes(2);
});

test('rejected session initialization releases loading without erasing a newer sign-in', async () => {
  let reject: (reason: Error) => void = () => {};
  mockGetSession.mockReturnValue(new Promise((_, fail) => { reject = fail; }));
  const Status = () => { const {user, loading} = useAuth(); return <div>{loading ? 'loading' : user?.id || 'signed-out'}</div>; };
  const view = render(<QueryClientProvider client={new QueryClient()}><AuthProvider><Status /></AuthProvider></QueryClientProvider>);
  await act(async () => reject(new Error('offline')));
  expect(screen.getByText('signed-out')).toBeInTheDocument();
  view.unmount();
  render(<QueryClientProvider client={new QueryClient()}><AuthProvider><Status /></AuthProvider></QueryClientProvider>);
  act(() => mockListener('SIGNED_IN',{user:{id:'newer'}}));
  await act(async () => reject(new Error('late failure')));
  expect(screen.getByText('newer')).toBeInTheDocument();
});
