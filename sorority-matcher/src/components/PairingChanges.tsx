import { trackEvent } from '../lib/analytics';
import PairingBoard from './PairingBoard';
import { useRef, useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { changePairing, changePairings, PairingOperation, getPairingEditor, PairingEditorData } from '../lib/pairingChanges';
import { queryKeys } from '../lib/queryKeys';
import Button from './Button';

export default function PairingChanges({ groupId, cycleId, onSaved }: {
  groupId: string; cycleId: string; onSaved: () => Promise<void>;
}) {
  const { user } = useAuth();
  const client = useQueryClient();
  const key = ['user', user?.id, 'pairing-editor', groupId, cycleId];
  const query = useQuery({ queryKey: key, queryFn: () => getPairingEditor(groupId, cycleId), refetchInterval: 30_000 });
  // Capture the reviewed version; a background refresh must never silently
  // rebase a draft onto someone else's assignments.
  const [draft, setDraft] = useState<PairingEditorData | null>(null);
  const [operations, setOperations] = useState<PairingOperation[]>([]);
  const [littleId, setLittleId] = useState('');
  const [toBigId, setToBigId] = useState('');
  const [swapId, setSwapId] = useState('');
  const [reason, setReason] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const reviewTitle = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (reviewing) reviewTitle.current?.focus(); }, [reviewing]);
  const data = query.data;
  const source = draft?.pairings.find(p => p.littleId === littleId);
  const destination = draft?.bigs.find(b => b.id === toBigId);
  const occupants = draft?.pairings.filter(p => p.bigId === toBigId) ?? [];
  const full = !!destination && occupants.length >= destination.capacity;
  const swap = occupants.find(p => p.littleId === swapId);
  const blocked = !!data?.lockReason || !!query.error || data?.version !== draft?.version;
  const valid = !!source && !!destination && source.bigId !== toBigId && (!full || !!swap) && reason.trim().length > 0 && reason.trim().length <= 2000;
  const pendingChanges = source && destination ? [
    { little: source.littleName, from: source.bigName, to: destination.name },
    ...(swap ? [{ little: swap.littleName, from: swap.bigName, to: source.bigName }] : []),
  ] : [];
  const applyProposal = () => draft?.pairings.map(pair => valid && pair.littleId === littleId
    ? {...pair, bigId: toBigId, bigName: destination!.name}
    : valid && swap && pair.littleId === swapId ? {...pair, bigId: source!.bigId, bigName: source!.bigName} : pair) ?? [];
  const finalPairings = applyProposal();
  const changes = operations.length ? finalPairings.flatMap(pair => {
    const original = data?.pairings.find(p => p.littleId === pair.littleId);
    return original && original.bigId !== pair.bigId ? [{little: pair.littleName, from: original.bigName, to: pair.bigName}] : [];
  }) : pendingChanges;
  const reasonValid = reason.trim().length > 0 && reason.trim().length <= 2000;
  const ready = reasonValid && changes.length > 0 && (valid || (operations.length > 0 && !littleId));
  const stage = () => {
    if (!draft || !valid || blocked) return;
    setOperations(previous => [...previous, {littleId, toBigId, swapLittleId: swapId || null}]);
    setDraft({...draft, pairings: finalPairings});
    setLittleId(''); setToBigId(''); setSwapId('');
  };
  const reset = () => { setOperations([]); setDraft(null); setReviewing(false); setLittleId(''); setToBigId(''); setSwapId(''); setReason(''); setError(''); };
  const save = async () => {
    if (!draft || !ready || blocked || busy) return;
    setBusy(true); setError('');
    try {
      if (operations.length) {
        await changePairings(groupId, cycleId, [...operations, ...(valid ? [{littleId, toBigId, swapLittleId: swapId || null}] : [])], draft.version, reason.trim());
      } else {
        await changePairing(groupId, cycleId, littleId, toBigId, swapId || null, draft.version, reason.trim());
      }
      trackEvent('pairings_updated');
      reset(); setSaved(true);
      await Promise.all([
        client.invalidateQueries({ queryKey: key }),
        client.invalidateQueries({ queryKey: queryKeys.revealStatus(user?.id ?? '', cycleId) }),
        onSaved(),
      ]);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not save changes. Please refresh and review again.');
    } finally { setBusy(false); }
  };
  return <section className="mt-6 ss-surface" aria-labelledby="pairing-changes-heading">
    <h2 id="pairing-changes-heading" className="text-lg font-medium">Pairing changes</h2>
    <p className="ss-caption mt-1">Choose a pool of names, then move or swap Littles and review your changes together. Every change needs a reason and is recorded for chapter admins.</p>
    {query.isPending && <p role="status" className="ss-caption mt-3">Loading change history…</p>}
    {query.error && <div role="alert" className="mt-3"><p>Could not load pairing changes. Editing is unavailable until this loads.</p><Button variant="outline" size="sm" onClick={() => void query.refetch()}>Try again</Button></div>}
    {saved && <p role="status" className="mt-3 text-jade-700">Pairings updated. Your reason was saved to the change history.</p>}
    {data?.lockReason && <p className="mt-3 ss-caption">{data.lockReason}</p>}
    {data && !draft && !data.lockReason && !query.error && data.pairings.length > 0 && <Button variant="outline" size="sm" className="mt-4" onClick={() => { reset(); setSaved(false); setDraft(data); }}>Edit pairings</Button>}
    {draft && <div className="mt-4 border-t pt-4">
      {blocked && <p role="alert" className="mb-3">{data?.lockReason || 'Pairing information changed or could not be refreshed. Refresh and review before saving.'}</p>}
      {!reviewing ? <fieldset disabled={busy || blocked} className="space-y-4">
        <PairingBoard draft={draft} littleId={littleId} toBigId={toBigId} swapId={swapId} disabled={busy || blocked}
          onMove={(little, big) => { if (busy || blocked) return; setLittleId(little); setToBigId(big); setSwapId(''); setError(''); }}
          onSwap={little => { if (!busy && !blocked) setSwapId(little); }} />
        {source && destination && (!full || swap) && <div className="rounded-xl bg-white/60 p-4">
          <h3 className="text-sm font-medium">Proposed changes · not saved</h3>
          <ul className="mt-2 text-sm space-y-1">{changes.map((c, i) => <li key={i}>{c.little}: {c.from} → {c.to}</li>)}</ul>
        </div>}
        <label className="block ss-label">Reason for this change (required)
          <textarea className="ss-input mt-1 w-full" rows={3} maxLength={2000} value={reason} onChange={e => setReason(e.target.value)} placeholder="Explain why these pairings need to change." />
        </label>
        <p className="ss-caption">Visible to chapter admins, including after the cycle closes. Manual changes may alter the algorithm’s stable matching result.</p>
        {valid && <Button variant="outline" size="sm" onClick={stage}>Add to batch</Button>}
        {operations.length > 0 && <p className="ss-caption">{operations.length} edits staged. Choose another Little or review all changes.</p>}
        <Button size="sm" disabled={!ready} onClick={() => setReviewing(true)}>Review changes</Button>
      </fieldset> : <div>
        <h3 ref={reviewTitle} tabIndex={-1} className="font-medium">Confirm pairing changes</h3>
        <ul className="mt-3 space-y-2">{changes.map((c, i) => <li key={i}><strong>{c.little}</strong>: {c.from} → {c.to}</li>)}</ul>
        <p className="mt-3 whitespace-pre-wrap break-words"><strong>Reason:</strong> {reason.trim()}</p>
        <p className="ss-caption mt-3">This updates the final pairings and records your name, reason, and these changes. No emails will be sent.</p>
        <div className="flex flex-wrap gap-2 mt-4">
          <Button variant="outline" size="sm" disabled={busy} onClick={() => setReviewing(false)}>Back to edit</Button>
          <Button size="sm" disabled={busy || blocked || !ready} onClick={() => void save()}>{busy ? 'Saving…' : 'Confirm changes'}</Button>
        </div>
      </div>}
      {error && <p role="alert" className="mt-3 text-brick">{error}</p>}
      <div className="flex flex-wrap gap-2 mt-3">
        <Button variant="ghost" size="sm" disabled={busy} onClick={reset}>Cancel editing</Button>
        {(blocked || error) && <Button variant="outline" size="sm" disabled={busy} onClick={() => { reset(); void query.refetch(); }}>Refresh pairings</Button>}
      </div>
    </div>}
    {data && <div className="mt-6 border-t pt-4">
      <h3 className="font-medium">Change history</h3>
      {data.history.length === 0 ? <p className="ss-caption mt-2">No manual changes have been made.</p> :
        <ol className="mt-3 space-y-4">{data.history.map(entry => <li key={entry.id} className="rounded-xl border border-[color:var(--ss-surface-border)] p-4">
          <p className="text-sm font-medium">{entry.actor_name} · <time dateTime={entry.created_at}>{new Date(entry.created_at).toLocaleString()}</time></p>
          <ul className="mt-2 text-sm space-y-1">{entry.changes.map(c => <li key={c.littleId}>{c.littleName}: {c.fromBigName} → {c.toBigName}</li>)}</ul>
          <p className="mt-2 text-sm whitespace-pre-wrap break-words"><strong>Reason:</strong> {entry.reason}</p>
        </li>)}</ol>}
    </div>}
  </section>;
}
