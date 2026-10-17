import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AccountMerge from './AccountMerge';
import { createAccountMerge, previewAccountMerge, completeAccountMerge, cancelAccountMerge } from '../lib/accountMerges';
jest.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'operator' } }) }));
jest.mock('../lib/accountMerges', () => ({ createAccountMerge: jest.fn(), previewAccountMerge: jest.fn(), completeAccountMerge: jest.fn(), cancelAccountMerge: jest.fn() }));
const source: any = { id: 'source', email: 'duplicate@example.com' };
const preview: any = { requestId: 'request', nonce: 'nonce', sourceEmail: source.email, targetEmail: 'kept@example.com', sourceApproved: false, targetApproved: false, blockers: [], counts: { memberships: 1, rankings: 1, rankingReferences: 2, notes: 3, pairings: 0, ownedChapters: 0 }, memberships: [{ groupId: 'chapter', name: 'Chapter', sourceRole: 'big', targetRole: 'big', sourceStatus: 'approved', targetStatus: 'approved' }], rankings: [{ cycleId: 'cycle', name: 'Chapter · Fall', sourceUpdated: '2026-10-01', targetUpdated: '2026-10-02' }] };
const onComplete = jest.fn(), onClose = jest.fn();
const setup = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}><AccountMerge source={source} onClose={onClose} onComplete={onComplete} /></QueryClientProvider>);
const start = async () => { fireEvent.change(screen.getByLabelText('Email of the account to keep'), { target: { value: 'kept@example.com' } }); fireEvent.click(screen.getByRole('button', { name: 'Prepare merge preview' })); await screen.findByText('2. Review the transfer'); };
beforeEach(() => { sessionStorage.clear(); jest.clearAllMocks(); (createAccountMerge as jest.Mock).mockResolvedValue('request'); (previewAccountMerge as jest.Mock).mockResolvedValue(preview); (completeAccountMerge as jest.Mock).mockResolvedValue({ targetEmail: preview.targetEmail }); (cancelAccountMerge as jest.Mock).mockResolvedValue(undefined); });
test('shows metadata only and blocks merging until both accounts approve', async () => {
  setup(); await start();
  expect(createAccountMerge).toHaveBeenCalledWith('source', 'kept@example.com');
  expect(screen.getByLabelText('Merge approval link')).toHaveValue('http://localhost/account-merge/request');
  expect(screen.getByRole('button', { name: 'Merge into kept account' })).toBeDisabled();
  expect(completeAccountMerge).not.toHaveBeenCalled();
});
test('requires explicit conflict choices and exact duplicate email confirmation', async () => {
  (previewAccountMerge as jest.Mock).mockResolvedValue({ ...preview, sourceApproved: true, targetApproved: true }); setup(); await start();
  fireEvent.change(screen.getByLabelText(/Profile to keep/), { target: { value: 'target' } });
  fireEvent.change(screen.getByLabelText(/Chapter: membership/), { target: { value: 'source' } });
  fireEvent.change(screen.getByLabelText(/Chapter · Fall: two/), { target: { value: 'target' } });
  fireEvent.change(screen.getByLabelText(/Type duplicate@example.com/), { target: { value: 'duplicate@example.com' } });
  fireEvent.click(screen.getByRole('button', { name: 'Merge into kept account' }));
  await waitFor(() => expect(completeAccountMerge).toHaveBeenCalledWith('request', 'nonce', { profile: 'target', memberships: { chapter: 'source' }, rankings: { cycle: 'target' } }, source.email));
  expect(await screen.findByRole('button', { name: 'Merge into kept account' })).toBeInTheDocument();
  await waitFor(() => expect(onComplete).toHaveBeenCalledWith('kept@example.com'));
});
test('server blockers remain visible and prevent completion', async () => {
  (previewAccountMerge as jest.Mock).mockResolvedValue({ ...preview, sourceApproved: true, targetApproved: true, blockers: ['Chapter roles differ.'] }); setup(); await start();
  expect(screen.getByRole('alert')).toHaveTextContent('Chapter roles differ.'); expect(screen.getByRole('button', { name: 'Merge into kept account' })).toBeDisabled();
});
test('failed preview shows an error and allows retry', async () => {
  (previewAccountMerge as jest.Mock).mockRejectedValue(new Error('Could not load preview')); setup();
  fireEvent.change(screen.getByLabelText('Email of the account to keep'), { target: { value: 'kept@example.com' } }); fireEvent.click(screen.getByRole('button', { name: 'Prepare merge preview' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load preview');
  expect(screen.getByRole('button', { name: 'Refresh approvals & preview' })).toBeEnabled();
});
test('cancel marks a pending request cancelled before closing', async () => {
  setup(); await start(); fireEvent.click(screen.getByRole('button', { name: 'Cancel merge' })); await waitFor(() => expect(cancelAccountMerge).toHaveBeenCalledWith('request')); await waitFor(() => expect(onClose).toHaveBeenCalled());
});
