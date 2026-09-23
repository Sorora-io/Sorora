import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import EmailVerification from './EmailVerification';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
jest.mock('../lib/supabase', () => ({ supabase: { auth: { getUser: jest.fn(), resend: jest.fn() } } }));
jest.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'me', email: 'me@example.com' } }) }));
jest.mock('sonner', () => ({ toast: { success: jest.fn() } }));
const user = { id: 'me', email: 'me@example.com', email_confirmed_at: null };
const show = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><EmailVerification /></QueryClientProvider>);
beforeEach(() => {
  jest.clearAllMocks();
  (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user }, error: null });
  (supabase.auth.resend as jest.Mock).mockResolvedValue({ error: null });
});
test('sends only on request and rate-limits repeated sends', async () => {
  show(); const button = await screen.findByRole('button', { name: 'Send verification email' });
  expect(supabase.auth.resend).not.toHaveBeenCalled();
  fireEvent.click(button);
  await waitFor(() => expect(supabase.auth.resend).toHaveBeenCalledWith({ type: 'signup', email: user.email, options: { emailRedirectTo: window.location.origin + '/profile' } }));
  expect(await screen.findByRole('button', { name: /Resend in/ })).toBeDisabled();
  expect(screen.getByText('Not verified')).toBeInTheDocument();
});
test('checks server verification instead of trusting the button click', async () => {
  show(); fireEvent.click(await screen.findByRole('button', { name: 'I’ve verified my email' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('not verified yet');
  (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { ...user, email_confirmed_at: '2026-09-23' } }, error: null });
  fireEvent.click(screen.getByRole('button', { name: 'I’ve verified my email' }));
  expect(await screen.findByText('Verified')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Send verification email' })).not.toBeInTheDocument();
});
test('failed sends show the error without claiming success', async () => {
  (supabase.auth.resend as jest.Mock).mockResolvedValue({ error: new Error('Email rate limit exceeded') });
  show(); fireEvent.click(await screen.findByRole('button', { name: 'Send verification email' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Email rate limit exceeded');
  expect(toast.success).not.toHaveBeenCalled();
});
