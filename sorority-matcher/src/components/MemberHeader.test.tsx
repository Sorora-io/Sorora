import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MemberHeader from './MemberHeader';
jest.mock('./PageHeader', () => ({ __esModule: true, default: ({ children }: any) => <header>{children}</header> }));

test('members keep roster access without organization tools', () => {
  render(<MemoryRouter><MemberHeader /></MemoryRouter>);
  expect(screen.getByRole('button', { name: 'Roster' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'My rankings' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Organization' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Org Settings' })).not.toBeInTheDocument();
});

test('admins can select organization while keeping roster alongside it', () => {
  const onSelect = jest.fn();
  render(<MemoryRouter><MemberHeader isAdmin activeTab="organization" onSelect={onSelect} /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Organization' }));
  expect(onSelect).toHaveBeenCalledWith('organization');
  expect(screen.getByRole('button', { name: 'Organization' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('button', { name: 'Roster' })).toBeInTheDocument();
});

test('settings is a separate admin dashboard tab', () => {
  const onSelect = jest.fn();
  render(<MemoryRouter><MemberHeader isAdmin activeTab="settings" onSelect={onSelect} /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Org Settings' }));
  expect(onSelect).toHaveBeenCalledWith('settings');
  expect(screen.getByRole('button', { name: 'Org Settings' })).toHaveAttribute('aria-current', 'page');
});
