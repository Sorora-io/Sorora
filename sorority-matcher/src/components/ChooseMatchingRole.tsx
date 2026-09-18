import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { useGroup } from '../contexts/GroupContext';
import { isEffectiveAdmin, resolveRoleChange } from '../lib/groups';
import { invalidateChapter } from '../lib/cache';
import Button from './Button';

// An admin keeps admin access while choosing their own side of matching.
const ChooseMatchingRole = () => {
  const { user } = useAuth();
  const { membership, refresh } = useGroup();
  const client = useQueryClient();
  const [role, setRole] = useState<'big' | 'little'>('big');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!membership || membership.role !== 'admin' || !isEffectiveAdmin(membership)) return null;

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      // This existing RPC checks approved admin access on the server and
      // preserves is_admin when changing the matching role.
      const result = await resolveRoleChange(membership.id, true, role);
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
    <div className="mt-6 flex w-full max-w-md flex-col gap-4">
      <p className="ss-caption">Choose your Big or Little role to submit your own rankings. You’ll keep your admin access.</p>
      <label className="ss-label" htmlFor="matching-role">My matching role</label>
      <select id="matching-role" className="ss-input" value={role} disabled={busy} onChange={event => setRole(event.target.value as 'big' | 'little')}>
        <option value="big">Big — I rank Littles</option>
        <option value="little">Little — I rank Bigs</option>
      </select>
      {error && <p role="alert" className="text-sm text-brick">{error}</p>}
      <Button onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Continue to my rankings'}</Button>
    </div>
  );
};

export default ChooseMatchingRole;
