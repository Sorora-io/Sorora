import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import AccountMenu from './AccountMenu';
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
  const trigger = screen.getByRole('button', { name: 'Sign out' });
  fireEvent.click(trigger);
  expect(mockSignOut).not.toHaveBeenCalled();
  const armed = screen.getByRole('button', { name: 'Click again to confirm' });
  await act(async () => { fireEvent.click(armed); });
  await waitFor(() => expect(mockSignOut).toHaveBeenCalledTimes(1));
});

test('armed state disarms after the timeout without signing out', () => {
  render(<AccountMenu />);
  fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
  expect(screen.getByRole('button', { name: 'Click again to confirm' })).toBeInTheDocument();
  act(() => { jest.advanceTimersByTime(3000); });
  expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  expect(mockSignOut).not.toHaveBeenCalled();
});

test('Escape disarms the button and restores focus', () => {
  render(<AccountMenu />);
  const trigger = screen.getByRole('button', { name: 'Sign out' });
  fireEvent.click(trigger);
  expect(screen.getByRole('button', { name: 'Click again to confirm' })).toBeInTheDocument();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  expect(trigger).toHaveFocus();
  expect(mockSignOut).not.toHaveBeenCalled();
});
