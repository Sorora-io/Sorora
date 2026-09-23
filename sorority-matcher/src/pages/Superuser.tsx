import { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSuperuser } from '../hooks/useSuperuser';
import { getSuperuserAccounts, grantSuperuser, deleteSuperuserAccount, SuperuserAccount } from '../lib/superusers';
import PageHeader from '../components/PageHeader';
import LoadingScreen from '../components/LoadingScreen';
import Button from '../components/Button';
import SuperuserOrganizations from '../components/SuperuserOrganizations';

export default function Superuser() {
  const { user, loading } = useAuth();
  const access = useSuperuser();
  const client = useQueryClient();
  const [view, setView] = useState<'accounts' | 'organizations'>('accounts');
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState('');
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<SuperuserAccount | null>(null);
  const [deleting, setDeleting] = useState<SuperuserAccount | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [notice, setNotice] = useState('');
  const promotionPanel = useRef<HTMLElement>(null);
  useEffect(() => {
    if (selected) {
      promotionPanel.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      promotionPanel.current?.focus({ preventScroll: true });
    }
  }, [selected]);
  const accounts = useQuery({
    queryKey: ['superuser-accounts', user?.id, search, offset],
    queryFn: () => getSuperuserAccounts(search, offset),
    enabled: !!user && access.data === true && view === 'accounts',
    staleTime: 0,
    retry: false,
  });
  const promote = useMutation({
    mutationFn: grantSuperuser,
    onSuccess: async () => {
      setNotice(`${selected?.email || 'Account'} is now a superuser.`);
      setSelected(null);
      await client.invalidateQueries({ queryKey: ['superuser-accounts'] });
    },
  });

  const removeAccount = useMutation({
    mutationFn: deleteSuperuserAccount,
    onSuccess: async () => {
      setNotice(`${deleting?.email || 'Account'} was deleted.`);
      setDeleting(null);
      setConfirmation('');
      setOffset(0);
      await client.invalidateQueries({ queryKey: ['superuser-accounts'] });
    },
  });

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (access.isPending) return <LoadingScreen />;
  if (access.error) return <div className="p-8" role="alert">Could not verify superuser access. <Button onClick={() => void access.refetch()}>Try again</Button></div>;
  if (!access.data) return <div className="p-8"><h1 className="text-2xl">Superuser access required</h1><p>This view is restricted to authorized superusers.</p><Link to="/dashboard" className="underline">Back to dashboard</Link></div>;

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8">
      <PageHeader superuserMode><Link to="/dashboard" className="font-display italic text-2xl">sorora</Link></PageHeader>
      <h1 className="mt-10 text-3xl font-semibold">Superuser</h1>
      <p className="mt-2 text-sm">All accounts across Sorora, including chapter admins, Bigs, Littles, and accounts without a chapter.</p>
      <p className="mt-2 text-sm">Superusers can view this directory, promote verified accounts, and delete accounts or organizations. Chapter roles are shown separately.</p>
      <nav aria-label="Superuser directories" className="mt-6 flex gap-2">
        <Button variant={view === 'accounts' ? 'primary' : 'outline'} aria-pressed={view === 'accounts'} onClick={() => setView('accounts')}>Accounts</Button>
        <Button variant={view === 'organizations' ? 'primary' : 'outline'} aria-pressed={view === 'organizations'} onClick={() => { setSelected(null); setDeleting(null); setConfirmation(''); setView('organizations'); }}>Organizations</Button>
      </nav>
      {view === 'organizations' ? <SuperuserOrganizations /> : <>
      <form className="my-6 flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); setSearch(draft.trim()); setOffset(0); }}>
        <label className="flex flex-col gap-1 text-sm">Search name or email<input className="rounded-lg border bg-white/70 px-3 py-2" value={draft} onChange={e => setDraft(e.target.value)} /></label>
        <Button type="submit">Search</Button>
        <Button type="button" variant="outline" onClick={() => void accounts.refetch()}>Refresh</Button>
      </form>
      {notice && <p role="status" className="mb-4">{notice}</p>}
      {selected && <section ref={promotionPanel} tabIndex={-1} role="dialog" aria-label="Confirm promotion" className="mb-6 rounded-xl border bg-white/70 p-5">
        <h2 className="font-semibold">Make {selected.email} a superuser?</h2>
        <p className="my-2 text-sm">They will be able to view every account, delete accounts or organizations, and grant superuser access to others.</p>
        <div className="flex gap-3"><Button disabled={promote.isPending} onClick={() => promote.mutate(selected.id)}>{promote.isPending ? 'Promoting…' : 'Confirm promotion'}</Button><Button variant="outline" disabled={promote.isPending} onClick={() => { setSelected(null); promote.reset(); }}>Cancel</Button></div>
        {promote.error && <p role="alert" className="mt-2 text-brick">{promote.error.message}</p>}
      </section>}
      {deleting && <section role="dialog" aria-labelledby="delete-account-title" className="mb-6 rounded-xl border border-red-200 bg-white p-5">
        <h2 id="delete-account-title" className="font-semibold">Delete {deleting.email || deleting.name || 'this account'}?</h2>
        <p className="my-2 text-sm">This permanently removes the account and its profile, memberships, submitted rankings, notes, and pairings. This cannot be undone. Chapter owners must transfer ownership first.</p>
        <label className="flex flex-col gap-2 text-sm">Type delete to confirm
          <input autoFocus autoComplete="off" spellCheck={false} value={confirmation} disabled={removeAccount.isPending}
            onChange={e => setConfirmation(e.target.value)} className="max-w-xs rounded-lg border px-3 py-2" />
        </label>
        <div className="mt-4 flex gap-3">
          <Button variant="danger-outline" disabled={confirmation !== 'delete' || removeAccount.isPending}
            onClick={() => { if (confirmation === 'delete') removeAccount.mutate({ userId: deleting.id, confirmation }); }}>
            {removeAccount.isPending ? 'Deleting…' : 'Permanently delete account'}
          </Button>
          <Button variant="outline" disabled={removeAccount.isPending} onClick={() => { setDeleting(null); setConfirmation(''); removeAccount.reset(); }}>Cancel</Button>
        </div>
        {removeAccount.error && <p role="alert" className="mt-2 text-brick">{removeAccount.error.message}</p>}
      </section>}
      {accounts.isFetching && <p role="status">Loading accounts…</p>}
      {accounts.error ? <p role="alert">Could not load accounts: {accounts.error.message}</p> : accounts.data && <>
        <p className="mb-3 text-sm">{accounts.data.total} {search ? 'matching ' : ''}accounts</p>
        {accounts.data.accounts.length === 0 ? <p>No accounts found.</p> : <div className="overflow-x-auto rounded-xl border bg-white/50">
          <table className="w-full text-left text-sm">
            <thead><tr className="border-b"><th className="p-4">Account</th><th className="p-4">Platform role</th><th className="p-4">Chapters & account types</th><th className="p-4 w-48">Actions</th></tr></thead>
            <tbody>{accounts.data.accounts.map(account => <tr key={account.id} className="border-b last:border-0">
              <td className="p-4 align-top"><p className="font-medium">{account.name || 'Unnamed account'}</p><p>{account.email || 'No email'}</p><p className="mt-1 text-xs">{account.verified ? 'Verified' : 'Email unverified'} · Joined {new Date(account.created_at).toLocaleDateString()}</p></td>
              <td className="p-4 align-top">{account.is_superuser ? 'Superuser' : 'Standard'}</td>
              <td className="p-4 align-top">{account.memberships.length === 0 ? 'No chapter' : <ul className="space-y-3">{account.memberships.map(m => <li key={m.group_id}><p className="font-medium">{m.group_name}{m.school ? ` · ${m.school}` : ''}</p><p className="capitalize">{m.role}{m.is_admin && m.role !== 'admin' ? ' + Admin' : ''}{m.is_owner ? ' · Owner' : ''} · {m.status}</p>{m.requested_role && <p className="text-xs">Requested role: {m.requested_role}</p>}</li>)}</ul>}</td>
              <td className="p-4 align-top w-48"><div className="flex w-40 flex-col items-stretch gap-2">{!account.is_superuser && <Button size="sm" variant="outline" fullWidth disabled={!account.verified || promote.isPending} onClick={() => { setDeleting(null); setConfirmation(''); setSelected(account); promote.reset(); setNotice(''); }}>Make superuser</Button>}
                {!account.is_superuser && !account.verified && <p className="text-xs text-[color:var(--ss-ink-5)]">Verify email before promoting.</p>}
                <Button size="sm" variant="danger-outline" fullWidth disabled={account.id === user.id || removeAccount.isPending || promote.isPending}
                  onClick={() => { setDeleting(account); setSelected(null); setConfirmation(''); removeAccount.reset(); setNotice(''); }}>Delete account</Button>
                </div>
              </td>
            </tr>)}</tbody>
          </table>
        </div>}
        <div className="mt-5 flex items-center gap-4"><Button variant="outline" disabled={offset === 0 || accounts.isFetching} onClick={() => setOffset(Math.max(0, offset - 50))}>Previous</Button><span className="text-sm">Page {offset / 50 + 1}</span><Button variant="outline" disabled={offset + 50 >= accounts.data.total || accounts.isFetching} onClick={() => setOffset(offset + 50)}>Next</Button></div>
      </>}
      </>}
    </div>
  );
}
