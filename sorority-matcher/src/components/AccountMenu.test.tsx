import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AccountMenu from './AccountMenu';
const mockSignOut = jest.fn();
jest.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ signOut: mockSignOut }) }));
jest.mock('react-router-dom', () => ({ Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a> }), { virtual: true });
beforeEach(() => mockSignOut.mockReset());
test('navigation opens, closes with Escape, and restores focus', () => {
  render(<AccountMenu />);
  const trigger = screen.getByRole('button', { name: 'Open navigation' });
  fireEvent.click(trigger);
  expect(screen.getByRole('navigation')).toBeInTheDocument();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});
test('outside click dismisses the dropdown', () => {
  render(<AccountMenu />);
  fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
  fireEvent.pointerDown(document.body);
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
});
test('sign out runs directly without an inline confirmation', async () => {
  mockSignOut.mockResolvedValue(undefined);
  render(<AccountMenu />);
  fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
  fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
  await waitFor(() => expect(screen.queryByRole('navigation')).not.toBeInTheDocument());
  expect(mockSignOut).toHaveBeenCalledTimes(1);
});
