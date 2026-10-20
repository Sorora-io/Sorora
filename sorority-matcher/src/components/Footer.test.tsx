import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Footer from './Footer';
test('footer keeps site links and Instagram without a separate replay-tour row', () => {
 render(<MemoryRouter><Footer /></MemoryRouter>);
 expect(screen.getByRole('link', { name: 'About' })).toHaveAttribute('href', '/about');
 expect(screen.getByRole('link', { name: 'FAQ' })).toHaveAttribute('href', '/faq');
 expect(screen.getByRole('link', { name: 'Contact us' })).toHaveAttribute('href', '/contact');
 expect(screen.getByRole('link', { name: 'Sorora on Instagram' })).toBeInTheDocument();
 expect(screen.queryByRole('button', { name: 'Replay the tour' })).not.toBeInTheDocument();
});
