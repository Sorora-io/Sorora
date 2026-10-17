import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Button from './Button';
import { RosterEntry } from '../lib/rankings';
import { setCycleParticipation, useCycleParticipation } from '../lib/cycleParticipation';

export default function CycleParticipationControls({ userId, groupId, cycleId, roster }: {
  userId: string; groupId: string; cycleId: string; roster: RosterEntry[];
}) {
  const client = useQueryClient();
  const participation = useCycleParticipation(userId, groupId, cycleId);
  useEffect(() => { setAcknowledged(false); }, [participation.data?.version]);
  const [selectedId, setSelectedId] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const members = roster.filter(r => r.role === 'big' || r.role === 'little');
  const excluded = participation.data?.excludedIds ?? [];
  const selected = members.find(m => m.userId === selectedId);
  const restoring = excluded.includes(selectedId);
  const affected = participation.data?.pairings.filter(p => p.bigId === selectedId || p.littleId === selectedId) ?? [];
  const name = (id: string) => roster.find(m => m.userId === id)?.name || roster.find(m => m.userId === id)?.email || 'Member';
  const save = async () => {
    if (!selected || !participation.data || participation.data.locked || saving || (!restoring && affected.length > 0 && !acknowledged)) return;
    setSaving(true); setError(''); setMessage('');
    try {
      await setCycleParticipation(groupId, cycleId, selectedId, !restoring, acknowledged, participation.data.version);
      setMessage(restoring ? `${name(selectedId)} is participating again. Saved rankings are preserved; previous pairings are not restored automatically.` : `${name(selectedId)} is excluded from this cycle. Chapter membership and saved rankings are preserved.${affected.length ? ' Review the newly unpaired members before revealing results.' : ''}`);
      setSelectedId(''); setAcknowledged(false);
      await client.invalidateQueries({ queryKey: ['user', userId] });
    } catch (e) { setError((e as Error).message); setAcknowledged(false); void participation.refetch(); }
    finally { setSaving(false); }
  };
  return <section className="ss-surface mt-6" aria-label="Cycle participation">
    <h2 className="font-display text-2xl">Cycle participation</h2>
    <p className="ss-caption mt-2">Exclude a member from this cycle’s rankings, matching, reminders, and submission counts. They stay in your chapter and can be restored before reveal sending begins.</p>
    {participation.isLoading && <p role="status">Loading participation…</p>}
    {participation.error && <div role="alert"><p>Couldn’t load cycle participation.</p><Button variant="quiet" size="sm" onClick={() => void participation.refetch()}>Try again</Button></div>}
    {participation.data && <>
      <p className="ss-caption mt-2">{members.length - excluded.filter(id => members.some(m => m.userId === id)).length} participating · {excluded.filter(id => members.some(m => m.userId === id)).length} excluded</p>
      {participation.data.locked ? <p role="status" className="mt-3">Participation is locked because this cycle has closed or reveal sending has started.</p> : <>
        <label className="block mt-4">Member
          <select className="block w-full mt-2 rounded-lg border p-2" value={selectedId} disabled={saving} onChange={e => { setSelectedId(e.target.value); setAcknowledged(false); setError(''); }}>
            <option value="">Choose a Big or Little</option>
            {members.map(m => <option key={m.userId} value={m.userId}>{name(m.userId)} · {m.role === 'big' ? 'Big' : 'Little'}{excluded.includes(m.userId) ? ' · Excluded' : ''}</option>)}
          </select>
        </label>
        {selected && <div className="mt-4">
          <p>{restoring ? `Restore ${name(selectedId)} to this cycle?` : `Exclude ${name(selectedId)} from this cycle?`}</p>
          {!restoring && affected.length > 0 && <div className="mt-3">
            <p>The following pairings will be removed:</p>
            <ul className="list-disc pl-5">{affected.map(p => <li key={p.littleId}>{name(p.bigId)} → {name(p.littleId)}</li>)}</ul>
            <label className="flex gap-2 mt-3"><input type="checkbox" checked={acknowledged} onChange={e => setAcknowledged(e.target.checked)} disabled={saving} />I understand these pairings will be removed and will review the unpaired members.</label>
          </div>}
          <Button variant="outline" className="mt-3" disabled={saving || (!restoring && affected.length > 0 && !acknowledged)} onClick={() => void save()}>{saving ? 'Saving…' : restoring ? 'Restore to this cycle' : 'Exclude from this cycle'}</Button>
          <Button variant="ghost" className="mt-3 ml-2" disabled={saving} onClick={() => setSelectedId('')}>Cancel</Button>
        </div>}
      </>}
      {excluded.length > 0 && <div className="mt-4"><h3 className="font-medium">Excluded this cycle</h3><ul>{members.filter(m => excluded.includes(m.userId)).map(m => <li key={m.userId}>{name(m.userId)}</li>)}</ul></div>}
    </>}
    {participation.data && participation.data.history.length > 0 && <details className="mt-4"><summary>Participation history</summary><ul className="mt-2 ss-caption">{participation.data.history.map((h, i) => <li key={i}>{name(h.userId)} · {h.excluded ? 'Excluded' : 'Restored'} by {h.actor} · {new Date(h.at).toLocaleString()}</li>)}</ul></details>}
    {message && <p role="status" className="mt-3">{message}</p>}
    {error && <p role="alert" className="mt-3">{error}</p>}
  </section>;
}
