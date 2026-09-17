import { act, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './AuthContext';
import { queryKeys } from '../lib/queryKeys';

let mockListener: (event: string, session: any) => void;
const mockGetSession = jest.fn();
jest.mock('../lib/supabase', () => ({ supabase: { auth: {
  getSession: () => mockGetSession(),
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
  act(() => mockListener('SIGNED_IN', { user: { id: 'bob' } }));
  await screen.findByText('bob');
  expect(client.getQueryCache().getAll()).toHaveLength(0);
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
