import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HomeHeader from './HomeHeader';
import Index from '../pages/Index';
jest.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'sample' } }) }));
jest.mock('../contexts/GroupContext', () => ({ useGroup: () => ({ memberships: [{ id: 'chapter' }], initialized: true }) }));
jest.mock('../hooks/useMyProfile', () => ({ useMyProfile: () => ({ data: { name: 'Sample Member' }, isPending: false }) }));
jest.mock('./AccountMenu', () => () => <button aria-label="Account options">Sample Member</button>);

test('the welcome page has one main header and no duplicate branding or account control inside the card', () => {
 render(<MemoryRouter><HomeHeader /><main><Index /></main></MemoryRouter>);
 const header = screen.getByRole('banner', { name: 'Main header' });
 expect(within(header).getByRole('button', { name: 'Sorora home' })).toBeInTheDocument();
 expect(within(header).getByRole('button', { name: 'Account options' })).toBeInTheDocument();
 const main = screen.getByRole('main');
 expect(within(main).getByRole('heading', { name: /Welcome back, Sample/ })).toBeInTheDocument();
 expect(within(main).getByRole('button', { name: 'Go to my dashboard' })).toBeInTheDocument();
 expect(within(main).queryByRole('link', { name: 'sorora' })).not.toBeInTheDocument();
 expect(within(main).queryByRole('button', { name: 'Account options' })).not.toBeInTheDocument();
});
