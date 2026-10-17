import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Button from './Button';
import { cancelAccountMerge, completeAccountMerge, createAccountMerge, MergeChoices, previewAccountMerge } from '../lib/accountMerges';
import { SuperuserAccount } from '../lib/superusers';
import { useAuth } from '../contexts/AuthContext';

export default function AccountMerge({ source, onClose, onComplete }: { source: SuperuserAccount; onClose: () => void; onComplete: (email: string) => void }) {
  const { user } = useAuth();
  const client = useQueryClient();
  const panel = useRef<HTMLElement>(null);
  const [targetEmail, setTargetEmail] = useState('');
  const storageKey = `sorora-account-merge:${user?.id}:${source.id}`;
  const [requestId, setRequestId] = useState(() => { try { return sessionStorage.getItem(storageKey) || ''; } catch { return ''; } });
  const clearRequest = () => { try { sessionStorage.removeItem(storageKey); } catch { /* Storage is optional. */ } };
  const [confirmation, setConfirmation] = useState('');
  const [choices, setChoices] = useState<MergeChoices>({ profile: '', memberships: {}, rankings: {} });
  useEffect(() => { panel.current?.scrollIntoView?.({ block: 'center' }); panel.current?.focus(); }, []);
  const create = useMutation({ mutationFn: () => createAccountMerge(source.id, targetEmail.trim()), onSuccess: id => { setRequestId(id); try { sessionStorage.setItem(storageKey, id); } catch { /* The preview remains usable without browser storage. */ } } });
  const preview = useQuery({ queryKey: ['account-merge', user?.id, requestId], queryFn: () => previewAccountMerge(requestId), enabled: !!requestId, staleTime: 0, gcTime: 0, retry: false, refetchOnWindowFocus: false });
  const cancel = useMutation({ mutationFn: async () => { if (requestId) await cancelAccountMerge(requestId); }, onSuccess: () => { clearRequest(); onClose(); } });
  const merge = useMutation({ mutationFn: () => {
    if (!preview.data) throw new Error('Reload the preview first.');
    return completeAccountMerge(requestId, preview.data.nonce, choices, confirmation);
  }, onSuccess: async result => { clearRequest(); await client.invalidateQueries(); onComplete(result.targetEmail); } });
  const data = preview.data;
  const resolved = !!data && !!choices.profile && data.memberships.every(m => choices.memberships[m.groupId]) && data.rankings.every(r => choices.rankings[r.cycleId]);
  const canMerge = !!data && !data.blockers.length && resolved && confirmation === data.sourceEmail && !preview.isFetching && !preview.error;
  const busy = create.isPending || cancel.isPending || merge.isPending;
  const selectClass = 'mt-1 block w-full rounded-lg border bg-white px-3 py-2';
  const error = create.error || preview.error || cancel.error || merge.error;
  return <section ref={panel} tabIndex={-1} aria-label="Merge duplicate account" className="my-6 rounded-2xl border bg-white/80 p-5 focus:outline-none">
    <h2 className="text-xl font-semibold">Merge duplicate account</h2>
    <p className="mt-2 text-sm">Duplicate: <strong>{source.email}</strong>. Choose the account to keep. Its login email and password stay unchanged.</p>
    {!requestId ? <form onSubmit={e => { e.preventDefault(); create.mutate(); }} className="mt-4 flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-sm">Email of the account to keep<input autoFocus type="email" required value={targetEmail} onChange={e => setTargetEmail(e.target.value)} className="rounded-lg border px-3 py-2" /></label>
      <Button type="submit" disabled={busy}>{create.isPending ? 'Preparing…' : 'Prepare merge preview'}</Button>
    </form> : <>
      <Button variant="outline" size="sm" className="mt-3" disabled={busy || preview.isFetching} onClick={() => { setConfirmation(''); merge.reset(); void preview.refetch(); }}>{preview.isFetching ? 'Refreshing…' : 'Refresh preview'}</Button>
      {data && <div className="mt-5 text-sm">
        <h3 className="font-semibold">1. Review the transfer</h3>
        <p className="mt-2">Keep <strong>{data.targetEmail}</strong>; remove the duplicate login <strong>{data.sourceEmail}</strong> after its data moves.</p>
        <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">{Object.entries(data.counts).map(([key, value]) => <div key={key} className="rounded-lg border p-3"><dt className="text-xs">{{ memberships: 'Memberships to transfer', rankings: 'Submitted rankings', rankingReferences: 'Other ranking lists to update', notes: 'Notes to preserve', pairings: 'Pairings to transfer', ownedChapters: 'Chapter ownerships' }[key]}</dt><dd className="mt-1 font-semibold">{value}</dd></div>)}</dl>
        <p className="mt-3">Ranking choices and private note contents are not shown here. References to the duplicate will be updated, keeping the earliest position when a ranking contains both accounts. Historical records remain in the same cycle.</p>
        {data.counts.ownedChapters > 0 && <p className="mt-2">Chapter ownership transfers to the kept account with approved admin access.</p>}
        {!!data.blockers.length && <div role="alert" className="mt-3 rounded-lg border border-brick p-3"><h4 className="font-semibold">Resolve these before merging</h4><ul className="list-disc pl-5">{data.blockers.map(b => <li key={b}>{b}</li>)}</ul></div>}
        <label className="mt-4 block">Profile to keep (login email stays {data.targetEmail})<select className={selectClass} disabled={busy} value={choices.profile} onChange={e => setChoices({ ...choices, profile: e.target.value })}><option value="">Choose a profile</option><option value="target">Keep the profile from {data.targetEmail}</option><option value="source">Use the profile from {data.sourceEmail}</option></select></label>
        {data.memberships.map(m => <label key={m.groupId} className="mt-3 block">{m.name}: membership and saved preferences<select className={selectClass} disabled={busy} value={choices.memberships[m.groupId] || ''} onChange={e => setChoices({ ...choices, memberships: { ...choices.memberships, [m.groupId]: e.target.value } })}><option value="">Choose which membership to keep</option><option value="target">{data.targetEmail}: {m.targetRole}{m.targetAdmin ? ' + Admin' : ''}, {m.targetStatus}</option><option value="source">{data.sourceEmail}: {m.sourceRole}{m.sourceAdmin ? ' + Admin' : ''}, {m.sourceStatus}</option></select>{m.ownsChapter && <span className="text-xs">The kept chapter owner must retain approved admin access.</span>}</label>)}
        {data.rankings.map(r => <label key={r.cycleId} className="mt-3 block">{r.name}: two submitted rankings<select className={selectClass} disabled={busy} value={choices.rankings[r.cycleId] || ''} onChange={e => setChoices({ ...choices, rankings: { ...choices.rankings, [r.cycleId]: e.target.value } })}><option value="">Choose the submission to keep</option><option value="target">{data.targetEmail} · {new Date(r.targetUpdated).toLocaleString()}</option><option value="source">{data.sourceEmail} · {new Date(r.sourceUpdated).toLocaleString()}</option></select></label>)}
        <h3 className="mt-5 font-semibold">2. Confirm the merge</h3>
        <p className="mt-2">The duplicate login will be removed and its sessions revoked. The merge cannot be undone from the app. No matching will be rerun and no reveal emails will be sent.</p>
        <label className="mt-3 block">Type {data.sourceEmail} to confirm<input autoComplete="off" spellCheck={false} disabled={busy} value={confirmation} onChange={e => setConfirmation(e.target.value)} className="mt-1 block w-full rounded-lg border px-3 py-2" /></label>
        <Button className="mt-3" disabled={!canMerge || busy} onClick={() => merge.mutate()}>{merge.isPending ? 'Merging…' : 'Merge into kept account'}</Button>
      </div>}
    </>}
    {preview.isFetching && <p role="status" className="mt-3">Loading the latest merge preview…</p>}
    {error && <p role="alert" className="mt-3 text-brick">{error.message}</p>}
    <Button variant="outline" size="sm" className="mt-4" disabled={busy} onClick={() => cancel.mutate()}>{cancel.isPending ? 'Cancelling…' : 'Cancel merge'}</Button>
  </section>;
}
