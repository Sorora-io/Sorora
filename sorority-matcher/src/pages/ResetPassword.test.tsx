import { fireEvent, render, screen } from '@testing-library/react';
import ResetPassword from './ResetPassword';
const mockGetSession = jest.fn();
const mockUpdatePassword = jest.fn();
jest.mock('../lib/supabase', () => ({ supabase: { auth: { getSession: () => mockGetSession() } } }));
jest.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ updatePassword: mockUpdatePassword }) }));
jest.mock('../components/PageHeader', () => ({ children }: any) => <header>{children}</header>);
jest.mock('react-router-dom', () => ({ Link: ({children}: any) => <span>{children}</span>, useNavigate: () => jest.fn() }));
beforeEach(() => jest.clearAllMocks());
test('a rejected session check offers retry instead of leaving the reset page loading', async () => {
  mockGetSession.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({data:{session:null},error:null});
  render(<ResetPassword />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not verify');
  fireEvent.click(screen.getByRole('button',{name:'Try again'}));
  expect(await screen.findByText(/invalid or has expired/)).toBeInTheDocument();
});
test('password fields have accessible labels and a rejected save permits retry', async () => {
  mockGetSession.mockResolvedValue({data:{session:{user:{id:'sample'}}},error:null});
  mockUpdatePassword.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({error:null});
  render(<ResetPassword />);
  fireEvent.change(await screen.findByLabelText('New password'), {target:{value:'sample-password'}});
  fireEvent.change(screen.getByLabelText('Confirm new password'), {target:{value:'sample-password'}});
  fireEvent.click(screen.getByRole('button',{name:'Update Password'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not update');
  expect(screen.getByRole('button',{name:'Update Password'})).toBeEnabled();
  fireEvent.click(screen.getByRole('button',{name:'Update Password'}));
  expect(await screen.findByRole('status')).toHaveTextContent('Your password has been updated');
});
