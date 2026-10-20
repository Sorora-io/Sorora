import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Index from './Index';
jest.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
jest.mock('../contexts/GroupContext', () => ({ useGroup: () => ({ memberships: [], initialized: true }) }));
jest.mock('../hooks/useMyProfile', () => ({ useMyProfile: () => ({ data: null }) }));
test('first intro slide has only Back; restart becomes available on the next slide and frames stay stable', () => {
 render(<MemoryRouter><Index /></MemoryRouter>);
 fireEvent.click(screen.getByRole('button', { name: /Meet sorora/i }));
 expect(screen.queryByRole('button', { name: 'Start over' })).not.toBeInTheDocument();
 expect(screen.getByRole('button', { name: /Back/ })).toBeInTheDocument();
 expect(document.querySelector('.ss-intro-frame')).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button', { name: /Continue/ }));
 expect(screen.getByRole('button', { name: 'Start over' })).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button', { name: /Back/ }));
 expect(screen.queryByRole('button', { name: 'Start over' })).not.toBeInTheDocument();
});
