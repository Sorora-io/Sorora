import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Login from './Login';
import { stashPendingGroupAction, clearPendingGroupAction } from '../contexts/GroupContext';
import { createGroup, findGroupByJoinCode, requestToJoinGroup } from '../lib/groups';

jest.mock('../hooks/useSuperuser', () => ({ useSuperuser: () => ({ data: false }) }));
jest.mock('../hooks/useMyProfile', () => ({ useMyProfile: () => ({ data: undefined }) }));
const mockNavigate = jest.fn();
const mockSignUp = jest.fn();
const mockSignIn = jest.fn();
const mockRefresh = jest.fn();
const mockSetActive = jest.fn();
let mockUser: any = null;
let mockParams = new URLSearchParams();
jest.mock('react-router-dom', () => ({
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
  useNavigate: () => mockNavigate,
  useLocation: () => ({ key: 'default' }),
  useSearchParams: () => [mockParams],
}), { virtual: true });
jest.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: mockUser, signUp: mockSignUp, signIn: mockSignIn }) }));
jest.mock('../contexts/GroupContext', () => ({
  stashPendingGroupAction: jest.fn(), clearPendingGroupAction: jest.fn(),
  useGroup: () => ({ refresh: mockRefresh, setActiveGroupId: mockSetActive }),
}));
jest.mock('../lib/groups', () => ({ createGroup: jest.fn(), requestToJoinGroup: jest.fn(), findGroupByJoinCode: jest.fn(), groupLabel: (g: any) => g.name }));
const next = () => fireEvent.click(screen.getByRole('button', { name: /Continue/ }));
const fill = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
beforeEach(() => {
  jest.clearAllMocks();
  mockUser = null;
  mockParams = new URLSearchParams('mode=signup&path=create');
  mockRefresh.mockResolvedValue(undefined);
  (createGroup as jest.Mock).mockResolvedValue({ group: { id: 'chapter' }, error: null });
  (findGroupByJoinCode as jest.Mock).mockResolvedValue({ group: { id: 'chapter', name: 'Test chapter' }, error: null });
  (requestToJoinGroup as jest.Mock).mockResolvedValue({ error: null });
});
const reachAccount = () => {
  fill('Sorority group name', 'Test chapter'); next();
  fill('School', 'Test University'); next();
  fill('First name', 'Test'); fill('Last name', 'Member');
  fill('Email', 'test@example.com'); fill('Password', 'test-password');
};
test('signup saves the chapter action before authentication and proceeds to dashboard', async () => {
  mockSignUp.mockImplementation(async () => {
    expect(stashPendingGroupAction).toHaveBeenCalledWith({ mode: 'create', email: 'test@example.com', groupName: 'Test chapter', school: 'Test University' });
    return { session: { user: { id: 'new-user' } }, error: null };
  });
  render(<Login />); reachAccount();
  fireEvent.click(screen.getByRole('button', { name: /Create my profile/ }));
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/dashboard'));
});
test('failed signup removes its pending chapter action', async () => {
  mockSignUp.mockResolvedValue({ session: null, error: new Error('Email already registered') });
  render(<Login />); reachAccount();
  fireEvent.click(screen.getByRole('button', { name: /Create my profile/ }));
  await screen.findByText('Email already registered');
  expect(clearPendingGroupAction).toHaveBeenCalled();
  expect(mockNavigate).not.toHaveBeenCalled();
});
test('signed-in chapter creation skips account creation', async () => {
  mockUser = { id: 'user' };
  render(<Login />);
  fill('Sorority group name', 'Test chapter'); next();
  fill('School', 'Test University'); next();
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true }));
  expect(createGroup).toHaveBeenCalledWith('Test chapter', 'Test University');
  expect(mockSignUp).not.toHaveBeenCalled();
});
test('invite links validate the code and signed-in joins go to approval', async () => {
  mockUser = { id: 'user' };
  mockParams = new URLSearchParams('join=TEST123');
  render(<Login />); next();
  await screen.findByText('Are you a Big or a Little?'); next();
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/group/pending', { replace: true }));
  expect(requestToJoinGroup).toHaveBeenCalledWith('chapter', 'big');
  expect(mockSignUp).not.toHaveBeenCalled();
});
test('switching from join to create clears the chapter-code error', () => {
  mockParams = new URLSearchParams('mode=signup&path=join');
  render(<Login />); next();
  expect(screen.getByText('Please enter your chapter code.')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Create a chapter instead.'));
  expect(screen.queryByText('Please enter your chapter code.')).not.toBeInTheDocument();
  next();
  expect(screen.getByText('Please enter your chapter’s name.')).toBeInTheDocument();
});
test('successful sign-in opens the dashboard', async () => {
  mockParams = new URLSearchParams();
  mockSignIn.mockResolvedValue({ error: null });
  render(<Login />); fill('Email', 'test@example.com'); fill('Password', 'password');
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/dashboard'));
});
