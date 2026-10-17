import { render, screen } from '@testing-library/react';
import App from './App';

// Keep actual providers, routes, and pages. Stub only the external Auth boundary.
jest.mock('./lib/supabase', () => ({ supabase: { auth: {
  onAuthStateChange: () => ({ data: { subscription: { unsubscribe: jest.fn() } } }),
  getSession: async () => ({ data: { session: null } }),
} } }));

test('signed-out protected route renders the real login page', async () => {
  window.history.replaceState({}, '', '/dashboard');
  render(<App />);
  expect(await screen.findByRole('heading', {name: 'Welcome back to sorora.'})).toBeInTheDocument();
  expect(screen.getByRole('button', {name:'Sign in'})).toBeInTheDocument();
  expect(window.location.pathname).toBe('/login');
});
