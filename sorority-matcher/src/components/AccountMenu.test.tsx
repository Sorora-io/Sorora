import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AccountMenu from './AccountMenu';
const mockSignOut = jest.fn();
jest.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ signOut: mockSignOut }) }));
jest.mock('react-router-dom', () => ({ Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a> }), { virtual: true });
beforeEach(() => mockSignOut.mockReset());
test('confirmation opens, closes with Escape, and restores focus', () => {
  render(<AccountMenu />);
  const trigger = screen.getByRole('button', { name: 'Sign out' });
  fireEvent.click(trigger);
  expect(screen.getByRole('region', { name: 'Sign out?' })).toBeInTheDocument();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('region', { name: 'Sign out?' })).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});
test('outside click dismisses the dropdown', () => {
  render(<AccountMenu />);
  fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
  fireEvent.pointerDown(document.body);
  expect(screen.queryByRole('region', { name: 'Sign out?' })).not.toBeInTheDocument();
});
test('sign out only runs after confirmation', async () => {
  mockSignOut.mockResolvedValue(undefined);
  render(<AccountMenu />);
  fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
  expect(mockSignOut).not.toHaveBeenCalled();
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
  await waitFor(() => expect(screen.queryByRole('region', { name: 'Sign out?' })).not.toBeInTheDocument());
  expect(mockSignOut).toHaveBeenCalledTimes(1);
});

test('cancel dismisses confirmation without signing out', () => {
  render(<AccountMenu />);
  fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByRole('region', { name: 'Sign out?' })).not.toBeInTheDocument();
  expect(mockSignOut).not.toHaveBeenCalled();
});
