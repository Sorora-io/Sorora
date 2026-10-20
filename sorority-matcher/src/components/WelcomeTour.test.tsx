import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import WelcomeTour, { WELCOME_TOUR_KEY } from './WelcomeTour';
let mockUser: any = { id: 'sample-user' };
let mockMembership: any;
jest.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock('../contexts/GroupContext', () => ({ useGroup: () => ({ membership: mockMembership }) }));
jest.mock('../lib/groups', () => ({ isEffectiveAdmin: (m: any) => m.is_admin || m.role === 'admin' }));
function Location() { const location = useLocation(); const navigate = useNavigate(); return <><p data-testid="route">{location.pathname}{location.search}</p><button onClick={() => navigate('/')}>Home</button><button onClick={() => navigate('/dashboard?tab=roster')}>Open roster</button></>; }
function mount(path = '/dashboard') { return render(<MemoryRouter initialEntries={[path]}><nav><button data-tour="roster">Roster</button></nav><Location /><WelcomeTour /></MemoryRouter>); }
beforeEach(() => { localStorage.clear(); mockUser = { id: 'sample-user' }; mockMembership = { id: 'sample-membership', status: 'approved', role: 'little', is_admin: false }; window.scrollTo = jest.fn(); });
test('walks through actual member pages, highlights navigation, and remembers completion per membership', () => {
 const view = mount();
 expect(screen.getByRole('heading', { name: 'Your chapter at a glance' })).toHaveFocus();
 fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
 expect(screen.getByTestId('route')).toHaveTextContent('/dashboard?tab=rankings');
 fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
 expect(screen.getByTestId('route')).toHaveTextContent('/group/submit-ranking');
 fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
 expect(screen.getByTestId('route')).toHaveTextContent('/dashboard?tab=roster');
 expect(screen.getByText('Roster')).toHaveClass('ss-tour-highlight');
 fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
 expect(screen.getByTestId('route')).toHaveTextContent('/profile');
 expect(screen.getByText('Roster')).not.toHaveClass('ss-tour-highlight');
 fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
 expect(screen.getByTestId('route')).toHaveTextContent('/faq');
 fireEvent.click(screen.getByRole('button', { name: 'Finish tour' }));
 expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
 expect(screen.getByTestId('route')).toHaveTextContent('/dashboard');
 view.unmount(); mount(); expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
});
test('admin route includes organization and settings; skip and replay both work', () => {
 mockMembership.is_admin = true;
 const view = mount();
 for (let i = 0; i < 4; i++) fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
 expect(screen.getByTestId('route')).toHaveTextContent('/dashboard?tab=organization');
 fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
 expect(screen.getByTestId('route')).toHaveTextContent('/group/status');
 fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
 expect(screen.getByTestId('route')).toHaveTextContent('/group/pairings');
 fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
 expect(screen.getByTestId('route')).toHaveTextContent('/dashboard?tab=settings');
 fireEvent.click(screen.getByRole('button', { name: 'Skip tour' }));
 expect(localStorage.getItem(`sorora-tour-seen-${WELCOME_TOUR_KEY}:sample-user:sample-membership`)).toBe('1');
 view.unmount(); mount('/dashboard?tour=1');
 expect(screen.getByRole('heading', { name: 'Your chapter at a glance' })).toBeInTheDocument();
});
test('pending members do not start a tour, and another account does not inherit completion', () => {
 mockMembership.status = 'pending'; const view = mount();
 expect(screen.queryByRole('complementary')).not.toBeInTheDocument(); view.unmount();
 mockMembership.status = 'approved';
 localStorage.setItem(`sorora-tour-seen-${WELCOME_TOUR_KEY}:other-user:sample-membership`, '1');
 mount(); expect(screen.getByRole('complementary', { name: 'Site walkthrough' })).toBeInTheDocument();
 fireEvent.keyDown(screen.getByRole('complementary'), { key: 'Escape' });
 expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
});

test('leaving for the welcome page hides the dashboard tour without marking it complete or redirecting back', () => {
 mount();
 fireEvent.click(screen.getByRole('button', { name: 'Home' }));
 expect(screen.getByTestId('route')).toHaveTextContent('/');
 expect(screen.queryByRole('complementary', { name: 'Site walkthrough' })).not.toBeInTheDocument();
 expect(document.body).not.toHaveClass('ss-touring');
 expect(localStorage.getItem(`sorora-tour-seen-${WELCOME_TOUR_KEY}:sample-user:sample-membership`)).toBeNull();
});
test('manual navigation to another tour page updates the guide to match the visible page', () => {
 mount();
 fireEvent.click(screen.getByRole('button', { name: 'Open roster' }));
 expect(screen.getByRole('heading', { name: 'Meet your chapter' })).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
 expect(screen.getByTestId('route')).toHaveTextContent('/profile');
 expect(screen.getByRole('heading', { name: 'Your profile and account' })).toBeInTheDocument();
});
