import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Button from '../components/Button';
import { approveAccountMerge, getMergeApproval } from '../lib/accountMerges';

export default function AccountMergeApproval() {
  const { requestId } = useParams();
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const query = useQuery({ queryKey: ['merge-approval', user?.id, requestId], queryFn: () => getMergeApproval(requestId!), enabled: !!user && !!requestId, staleTime: 0, gcTime: 0, retry: false });
  const mutation = useMutation({ mutationFn: (approved: boolean) => approveAccountMerge(requestId!, approved), onSuccess: () => query.refetch() });
  const data = query.data;
  const inactive = !data || data.status !== 'pending' || data.expired;
  return <div className="mx-auto w-full max-w-xl px-5 py-12">
    <h1 className="text-2xl font-semibold">Approve an account merge</h1>
    {loading ? <p role="status" className="mt-4">Checking your account…</p> : !user ? <>
      <p className="mt-4">Sign in to one of the accounts involved to review this request.</p>
      <Button className="mt-4" onClick={() => navigate(`/login?merge=${encodeURIComponent(requestId || '')}`)}>Sign in to review</Button>
    </> : <>
      <p className="mt-3 text-sm">Signed in as {user.email}.</p>
      {query.isFetching && <p role="status" className="mt-4">Loading request…</p>}
      {query.error && <p role="alert" className="mt-4">{query.error.message}</p>}
      {data && <section className="mt-5 rounded-xl border bg-white/70 p-5">
        <p>Keep <strong>{data.targetEmail}</strong>.</p><p className="mt-2">Merge and remove the duplicate login <strong>{data.sourceEmail}</strong>.</p>
        <p className="mt-3 text-sm">Only approve if both accounts are yours. Your profile, chapter access, submitted rankings, and private notes may move to the kept account. A superuser will review duplicate submissions and memberships before completing the merge. It cannot be undone from the app.</p>
        {inactive ? <p role="status" className="mt-4">This request is {data.expired ? 'expired' : data.status}.</p> : <>
          <p className="mt-3 text-sm">Sign in within 15 minutes before approving. Approval lasts 30 minutes. Both accounts must approve separately.</p>
          <p role="status" className="mt-3">{data.approved ? 'This account has approved the merge.' : 'This account has not approved yet.'}</p>
          <Button className="mt-4" disabled={mutation.isPending || query.isFetching} onClick={() => mutation.mutate(!data.approved)}>{mutation.isPending ? 'Saving…' : data.approved ? 'Withdraw my approval' : 'Approve for this account'}</Button>
        </>}
      </section>}
      {mutation.error && <p role="alert" className="mt-4">{mutation.error.message}</p>}
      <Button variant="outline" className="mt-5" disabled={mutation.isPending} onClick={async () => { await signOut(); navigate(`/login?merge=${encodeURIComponent(requestId || '')}`); }}>Sign in with the other account</Button>
    </>}
    <Button variant="ghost" className="mt-4" onClick={() => navigate('/dashboard')}>Back to dashboard</Button>
  </div>;
}
