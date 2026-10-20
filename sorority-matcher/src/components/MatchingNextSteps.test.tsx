import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MatchingNextSteps from './MatchingNextSteps';
test('review guidance advances through context, careful edits, and a reveal plan without sending anything', () => {
 render(<MemoryRouter><MatchingNextSteps /></MemoryRouter>);
 expect(screen.getByRole('heading')).toHaveTextContent('Start with the submitted preferences');
 expect(screen.getByRole('link', { name: 'How Sorora works' })).toHaveAttribute('href', '/about');
 fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
 expect(screen.getByText(/relevant context, rather than familiarity/)).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
 expect(screen.getByRole('heading')).toHaveTextContent('Make a thoughtful plan');
 fireEvent.click(screen.getByRole('button', { name: 'Review pairings' }));
 expect(screen.getByText(/Your next step: review and confirm/)).toBeInTheDocument();
 expect(screen.queryByRole('button', { name: /Send/ })).not.toBeInTheDocument();
});
