import { fireEvent, render, screen } from '@testing-library/react';
import PasswordInput from './PasswordInput';
test('password is masked by default and the eye toggles without changing its value or submitting', () => {
 const submit = jest.fn();
 render(<form onSubmit={submit}><label htmlFor="password">Password</label><PasswordInput id="password" aria-label="Password" defaultValue="sample secret" autoComplete="current-password" /></form>);
 const input = screen.getByLabelText('Password');
 expect(input).toHaveAttribute('type', 'password');
 fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
 expect(input).toHaveAttribute('type', 'text'); expect(input).toHaveValue('sample secret');
 expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute('aria-pressed', 'true');
 fireEvent.click(screen.getByRole('button', { name: 'Hide password' }));
 expect(input).toHaveAttribute('type', 'password'); expect(submit).not.toHaveBeenCalled();
});
