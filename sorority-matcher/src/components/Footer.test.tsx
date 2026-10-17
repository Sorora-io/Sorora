import { render, screen, fireEvent } from '@testing-library/react';
import Footer from './Footer';
jest.mock('./AnalyticsConsent', () => ({ __esModule: true, default: ({ children }: any) => <div>{children}<button>Analytics preferences</button></div> }));
const mockNavigate = jest.fn();
let mockMembership: any;
jest.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>,
  useNavigate: () => mockNavigate,
}), { virtual: true });
jest.mock('../contexts/GroupContext', () => ({ useGroup: () => ({ membership: mockMembership }) }));
beforeEach(() => { mockNavigate.mockClear(); mockMembership = { status: 'approved' }; });
test('approved members can replay the dashboard tour from the footer', () => {
  render(<Footer />);
  const button = screen.getByRole('button', { name: 'Replay the tour' });
  expect(screen.getByRole('contentinfo')).toContainElement(button);
  fireEvent.click(button);
  expect(mockNavigate).toHaveBeenCalledWith('/dashboard?tour=1');
});
test.each([null, { status: 'pending' }])('hides replay without an approved chapter membership (%p)', membership => {
  mockMembership = membership;
  render(<Footer />);
  expect(screen.queryByRole('button', { name: 'Replay the tour' })).not.toBeInTheDocument();
});
