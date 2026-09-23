import { fireEvent, render, screen } from '@testing-library/react';
import Avatar from './Avatar';

test('falls back to consistent initials when a photo fails, and retries a changed URL', () => {
  const view = render(<Avatar src="/old-photo.png" name="Jamie Lee" alt="Profile photo" />);
  fireEvent.error(screen.getByRole('img', { name: 'Profile photo' }));
  expect(screen.getByRole('img', { name: 'Profile photo' })).toHaveTextContent('JL');
  view.rerender(<Avatar src="/new-photo.png" name="Jamie Lee" alt="Profile photo" />);
  expect(screen.getByRole('img', { name: 'Profile photo' })).toHaveAttribute('src', '/new-photo.png');
});
