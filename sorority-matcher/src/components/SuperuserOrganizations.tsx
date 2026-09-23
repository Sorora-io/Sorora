import { useState } from 'react';
import { toast } from 'sonner';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { getSuperuserOrganizations, deleteSuperuserOrganization, transferSuperuserOrganization, SuperuserOrganization } from '../lib/superusers';
import Button from './Button';

export default function SuperuserOrganizations() {
  const { user } = useAuth();
  const client = useQueryClient();
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [target, setTarget] = useState<SuperuserOrganization | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [notice, setNotice] = useState('');
  const [transferTarget, setTransferTarget] = useState<SuperuserOrganization | null>(null);
  const [newOwnerEmail, setNewOwnerEmail] = useState('');
  const organizations = useQuery({
    queryKey: ['superuser-organizations', user?.id, search, offset],
    queryFn: () => getSuperuserOrganizations(search, offset), retry: false, staleTime: 0,
  });
  const remove = useMutation({
    mutationFn: deleteSuperuserOrganization,
    onSuccess: async () => {
      setNotice(`${target?.name || 'Organization'} was deleted.`);
      setTarget(null); setConfirmation(''); setOffset(0);
      await Promise.all([
        client.invalidateQueries({ queryKey: ['superuser-organizations'] }),
        client.invalidateQueries({ queryKey: ['superuser-accounts'] }),
      ]);
    },
  });
  const transfer = useMutation({
    mutationFn: transferSuperuserOrganization,
    onSuccess: async result => {
      setNotice(`${result.group_name} now belongs to ${result.owner_name || result.owner_email}.`);
      setTransferTarget(null); setNewOwnerEmail('');
      await Promise.all([
        client.invalidateQueries({ queryKey: ['superuser-organizations'] }),
        client.invalidateQueries({ queryKey: ['superuser-accounts'] }),
      ]);
    },
  });
  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success('Join code copied', { duration: 2500 });
    } catch { toast.error('Could not copy. Select the code and copy it manually.'); }
  };
  return <section aria-label="Organizations">
    <form className="my-6 flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); setSearch(draft.trim()); setOffset(0); }}>
      <label className="flex flex-col gap-1 text-sm">Search organization or school<input value={draft} onChange={e => setDraft(e.target.value)} className="rounded-lg border bg-white/70 px-3 py-2" /></label>
      <Button type="submit">Search</Button>
      <Button type="button" variant="outline" onClick={() => void organizations.refetch()}>Refresh</Button>
    </form>
    {notice && <p role="status" className="mb-4">{notice}</p>}
    {target && <section role="dialog" aria-labelledby="delete-org-title" className="mb-6 rounded-xl border border-red-200 bg-white p-5">
      <h2 id="delete-org-title" className="font-semibold">Delete {target.name}?</h2>
      <p className="my-2 text-sm">{target.school} · {target.member_count} members</p>
      <p className="my-2 text-sm">This permanently deletes this organization, its memberships, cycles, rankings, notes, and pairings. Members’ accounts are kept. This cannot be undone.</p>
      <label className="flex flex-col gap-2 text-sm">Type delete to confirm<input autoFocus autoComplete="off" spellCheck={false} value={confirmation} disabled={remove.isPending} onChange={e => setConfirmation(e.target.value)} className="max-w-xs rounded-lg border px-3 py-2" /></label>
      <div className="mt-4 flex gap-3">
        <Button variant="danger-outline" disabled={confirmation !== 'delete' || remove.isPending} onClick={() => { if (confirmation === 'delete') remove.mutate({ groupId: target.id, confirmation }); }}>{remove.isPending ? 'Deleting…' : 'Permanently delete organization'}</Button>
        <Button variant="outline" disabled={remove.isPending} onClick={() => { setTarget(null); setConfirmation(''); remove.reset(); }}>Cancel</Button>
      </div>
      {remove.error && <p role="alert" className="mt-2 text-brick">{remove.error.message}</p>}
    </section>}
    {transferTarget && <section role="dialog" aria-labelledby="transfer-org-title" className="mb-6 rounded-xl border bg-white p-5">
      <h2 id="transfer-org-title" className="font-semibold">Transfer {transferTarget.name}</h2>
      <p className="my-2 text-sm">Current owner: {transferTarget.owner_email || '—'}</p>
      <p className="my-2 text-sm">The new owner is granted approved admin access to this chapter as part of the transfer — owner alone carries no permissions. They don’t need to be a member already. The previous owner keeps their membership and admin access.</p>
      <label className="flex flex-col gap-2 text-sm">New owner’s email
        <input autoFocus type="email" autoComplete="off" spellCheck={false} value={newOwnerEmail} disabled={transfer.isPending}
          onChange={e => setNewOwnerEmail(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && newOwnerEmail.trim()) transfer.mutate({ groupId: transferTarget.id, email: newOwnerEmail.trim() }); }}
          className="max-w-sm rounded-lg border px-3 py-2" />
      </label>
      <div className="mt-4 flex gap-3">
        <Button disabled={!newOwnerEmail.trim() || transfer.isPending} onClick={() => transfer.mutate({ groupId: transferTarget.id, email: newOwnerEmail.trim() })}>{transfer.isPending ? 'Transferring…' : 'Transfer ownership'}</Button>
        <Button variant="outline" disabled={transfer.isPending} onClick={() => { setTransferTarget(null); setNewOwnerEmail(''); transfer.reset(); }}>Cancel</Button>
      </div>
      {transfer.error && <p role="alert" className="mt-2 text-brick">{transfer.error.message}</p>}
    </section>}
    {organizations.isFetching && <p role="status">Loading organizations…</p>}
    {organizations.error ? <p role="alert">Could not load organizations: {organizations.error.message}</p> : organizations.data && <>
      <p className="mb-3 text-sm">{organizations.data.total} {search ? 'matching ' : ''}organizations</p>
      {organizations.data.organizations.length === 0 ? <p>No organizations found.</p> : <div className="overflow-x-auto rounded-xl border bg-white/50">
        <table className="w-full text-left text-sm">
          <thead><tr className="border-b"><th className="p-4">Organization</th><th className="p-4">School</th><th className="p-4">Owner</th><th className="p-4">Join code</th><th className="p-4">Members</th><th className="p-4">Actions</th></tr></thead>
          <tbody>{organizations.data.organizations.map(org => <tr key={org.id} className="border-b last:border-0">
            <td className="p-4 font-medium">{org.name}</td><td className="p-4">{org.school || '—'}</td><td className="p-4">{org.owner_email || '—'}</td><td className="p-4"><div className="flex items-center gap-2"><code className="select-all whitespace-nowrap font-mono tracking-wider">{org.join_code || '—'}</code><Button size="sm" variant="ghost" disabled={!org.join_code} aria-label={`Copy join code for ${org.name}`} onClick={() => void copyCode(org.join_code)}>Copy</Button></div></td><td className="p-4">{org.member_count}</td>
            <td className="p-4"><div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={transfer.isPending} onClick={() => { setTransferTarget(org); setNewOwnerEmail(''); setNotice(''); transfer.reset(); }}>Transfer ownership</Button>
              <Button size="sm" variant="danger-outline" disabled={remove.isPending} onClick={() => { setTarget(org); setConfirmation(''); setNotice(''); remove.reset(); }}>Delete organization</Button>
            </div></td>
          </tr>)}</tbody>
        </table>
      </div>}
      <div className="mt-5 flex items-center gap-4"><Button variant="outline" disabled={offset === 0 || organizations.isFetching} onClick={() => setOffset(Math.max(0, offset - 50))}>Previous</Button><span className="text-sm">Page {offset / 50 + 1}</span><Button variant="outline" disabled={offset + 50 >= organizations.data.total || organizations.isFetching} onClick={() => setOffset(offset + 50)}>Next</Button></div>
    </>}
  </section>;
}
