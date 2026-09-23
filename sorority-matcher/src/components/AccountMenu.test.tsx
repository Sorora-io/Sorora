import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import AccountMenu from './AccountMenu';
jest.mock('../hooks/useMyProfile', () => ({ useMyProfile: () => ({ data: undefined }) }));
jest.mock('./SuperuserLink', () => () => <a href="/superuser">Superuser</a>);
const mockSignOut = jest.fn();
jest.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ signOut: mockSignOut }) }));
beforeEach(() => {
  mockSignOut.mockReset();
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});

test('first click arms the button, second click signs out', async () => {
  mockSignOut.mockResolvedValue(undefined);
  render(<AccountMenu />);
  fireEvent.click(screen.getByRole('button', { name: /Account options/ }));
  const trigger = screen.getByRole('button', { name: 'Sign out' });
  fireEvent.click(trigger);
  expect(mockSignOut).not.toHaveBeenCalled();
  const armed = screen.getByRole('button', { name: 'Click again to confirm' });
  await act(async () => { fireEvent.click(armed); });
  await waitFor(() => expect(mockSignOut).toHaveBeenCalledTimes(1));
});

test('armed state disarms after the timeout without signing out', () => {
  render(<AccountMenu />);
  fireEvent.click(screen.getByRole('button', { name: /Account options/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
  expect(screen.getByRole('button', { name: 'Click again to confirm' })).toBeInTheDocument();
  act(() => { jest.advanceTimersByTime(3000); });
  expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  expect(mockSignOut).not.toHaveBeenCalled();
});

test('Escape disarms the button and restores focus', () => {
  render(<AccountMenu />);
  fireEvent.click(screen.getByRole('button', { name: /Account options/ }));
  const trigger = screen.getByRole('button', { name: 'Sign out' });
  fireEvent.click(trigger);
  expect(screen.getByRole('button', { name: 'Click again to confirm' })).toBeInTheDocument();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Account options/ })).toHaveFocus();
  expect(mockSignOut).not.toHaveBeenCalled();
});

test('superuser is tucked into account dropdown and Escape closes it', () => {
  render(<AccountMenu />);
  expect(screen.queryByRole('link', { name: 'Superuser' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument();
  const account = screen.getByRole('button', { name: /Account options/ });
  fireEvent.click(account);
  expect(screen.getByRole('link', { name: 'Superuser' })).toBeInTheDocument();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('link', { name: 'Superuser' })).not.toBeInTheDocument();
  expect(account).toHaveFocus();
});

test('superuser mode offers only Main app and Sign out', () => {
  render(<AccountMenu superuserMode />);
  fireEvent.click(screen.getByRole('button', { name: /Account options/ }));
  expect(screen.getAllByRole('link')).toHaveLength(1);
  expect(screen.getByRole('link', { name: 'Main app' })).toHaveAttribute('href', '/dashboard');
  expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'My profile' })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Superuser' })).not.toBeInTheDocument();
});
