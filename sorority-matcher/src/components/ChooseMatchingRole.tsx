import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { useGroup } from '../contexts/GroupContext';
import { isEffectiveAdmin, setMyAdminMatchingRole } from '../lib/groups';
import { invalidateChapter } from '../lib/cache';
import Button from './Button';

// An admin may participate as a Big while keeping admin access.
const ChooseMatchingRole = () => {
  const { user } = useAuth();
  const { membership, refresh } = useGroup();
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!membership || membership.role !== 'admin' || !isEffectiveAdmin(membership)) return null;

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      // The dedicated RPC checks this admin’s own approved membership.
      const result = await setMyAdminMatchingRole(membership.group_id, 'big');
      if (result.error) throw new Error(result.error);
      await invalidateChapter(client, user!.id, membership.group_id, membership.group.active_cycle_id);
      await refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not save your role. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-6 flex w-full flex-col gap-3 rounded-2xl border border-[color:var(--ss-surface-border)] bg-white/40 p-5">
      <h2 className="text-base font-semibold text-[color:var(--ss-ink-1)]">Are you taking a Little?</h2>
      <p className="ss-caption">You’re currently admin-only, so Littles cannot rank you. Become a Big to appear in their ranking lists right away, even before you submit your own rankings. You’ll keep your admin access.</p>
      <p className="ss-caption">If you’re only managing matching, keep your current role. Admins cannot be Littles.</p>
      {error && <p role="alert" className="text-sm text-brick">{error}</p>}
      <Button variant="outline" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Become a Big'}</Button>
    </div>
  );
};

export default ChooseMatchingRole;
