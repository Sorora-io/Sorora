import { Check, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { getRankingExport } from '../lib/rankingExport';
import { PairingRow } from '../lib/rankings';
import { reviewPairings } from '../lib/pairingReview';
import { getPairingConfirmations, setPairingConfirmation } from '../lib/pairingConfirmations';
import Button from './Button';

export default function PairingGroups({groupId,cycleId,blind,pairings,onRefresh}:{
  groupId:string;cycleId:string;blind:boolean;pairings:PairingRow[];onRefresh?:()=>Promise<void>;
}) {
  const {user}=useAuth();
  const queryClient=useQueryClient();
  const [saving,setSaving]=useState<string|null>(null);
  const [saveError,setSaveError]=useState('');
  const signature=pairings.map(p=>`${p.bigId}:${p.littleId}`).sort().join(',');
  const confirmations=useQuery({
    queryKey:['user',user?.id,'pairing-confirmations',groupId,cycleId,signature],
    queryFn:()=>getPairingConfirmations(groupId,cycleId),
    enabled:!!user && pairings.length>0,gcTime:0,staleTime:0,retry:false,refetchInterval:15000,
  });
  const rankings=useQuery({
    queryKey:['user',user?.id,'pairing-ranks',groupId,cycleId,signature],
    queryFn:()=>getRankingExport(groupId,cycleId,true),
    enabled:!!user && !blind && pairings.length>0,
    gcTime:0,staleTime:0,retry:false,refetchInterval:15000,
  });
  const changeConfirmation=async(pair:PairingRow,confirmed:boolean)=>{
    if(!confirmations.data || saving || confirmations.data.lockReason)return;
    setSaving(`${pair.bigId}:${pair.littleId}`);setSaveError('');
    try {
      await setPairingConfirmation(groupId,cycleId,pair.bigId,pair.littleId,confirmations.data.version,confirmed);
    } catch(failure) {
      setSaveError(failure instanceof Error ? failure.message : 'Could not confirm whether the status was saved. Refresh before trying again.');
    } finally {
      await Promise.allSettled([
        confirmations.refetch(),onRefresh?.(),
        queryClient.invalidateQueries({queryKey:['user',user?.id,'matching-review',groupId,cycleId]}),
        queryClient.invalidateQueries({queryKey:['user',user?.id,'pairing-editor',groupId,cycleId]}),
      ]);
      setSaving(null);
    }
  };
  if(!confirmations.data || confirmations.error)return <section className="ss-surface" aria-label="Saved pairings">
    <h2 className="flex items-center gap-2 font-medium">Saved pairings <span className="inline-flex min-h-[24px] min-w-[24px] items-center justify-center rounded-badge bg-[color:var(--ss-pill-bg)] px-1 text-xs font-semibold tabular-nums">{pairings.length}</span></h2>
    <p className="ss-caption mt-2">{confirmations.error ? 'Could not load saved confirmations. Refresh before reviewing these pairs.' : 'Loading saved confirmations…'}</p>
    {confirmations.error && <Button variant="quiet" size="sm" className="mt-2" onClick={()=>void confirmations.refetch()}>Retry confirmations</Button>}
    <ul className="mt-3 space-y-3">{pairings.map(pair=><li key={`${pair.bigId}:${pair.littleId}`} className="text-sm break-words">{pair.bigName || 'Unknown Big'} → {pair.littleName || 'Unknown Little'}</li>)}</ul>
  </section>;
  const visibleRankings=!blind && !rankings.error ? rankings.data : undefined;
  const reviewed=reviewPairings(pairings,visibleRankings ?? {members:[]},confirmations.data.decisions);
  const counts = new Map<string, number>();
  pairings.forEach(pair => counts.set(pair.bigId, (counts.get(pair.bigId) || 0) + 1));
  const sizes = Array.from(new Set(counts.values())).sort((a,b) => a-b);
  const familyCount = (size: number) => Array.from(counts.values()).filter(count => count === size).length;
  const rows=(pairs:typeof reviewed)=><ul className="mt-3 divide-y divide-[color:var(--ss-surface-border)]">{pairs.map(pair=><li key={`${pair.bigId}:${pair.littleId}`} className="flex items-start justify-between gap-3 py-3 text-sm">
    <div className="min-w-0 break-words">
    <p className="font-medium">{pair.bigName || 'Unknown Big'} → {pair.littleName || 'Unknown Little'}</p>
    <p className="ss-caption mt-1">{pair.confirmed ? 'Confirmed' : 'Needs review'}</p>
    {visibleRankings && <p className="ss-caption mt-1">
      Big {typeof pair.bigRank==='number' ? `#${pair.bigRank}` : pair.bigRank==='Not ranked' ? '—' : pair.bigRank} · Little {typeof pair.littleRank==='number' ? `#${pair.littleRank}` : pair.littleRank==='Not ranked' ? '—' : pair.littleRank}
      {!pair.mutualFirst && <span> · {pair.matchType}</span>}
    </p>}
    {pair.decision && <p className="ss-caption mt-2">{pair.decision.confirmed?'Confirmed':'Marked for review'} by {pair.decision.reviewedBy || 'Chapter admin'} · {new Date(pair.decision.reviewedAt).toLocaleString()}</p>}
    </div>
    <Button variant="ghost" size="sm" className="shrink-0 !px-3 !py-1.5 !min-h-[32px]" disabled={!!saving || confirmations.isFetching || !!confirmations.data?.lockReason}
      aria-label={`${pair.confirmed?'Move pairing to needs review':'Confirm pairing'}: ${pair.bigName || 'Unknown Big'} and ${pair.littleName || 'Unknown Little'}`}
      onClick={()=>void changeConfirmation(pair,!pair.confirmed)}>
      {saving===`${pair.bigId}:${pair.littleId}` ? 'Saving…' : <>{pair.confirmed ? <Undo2 size={14} aria-hidden="true" /> : <Check size={14} aria-hidden="true" />}{pair.confirmed ? 'Review' : 'Confirm'}</>}
    </Button>
  </li>)}</ul>;
  return <div className="space-y-4">
    <aside aria-label="Review key" className="rounded-xl border border-[color:var(--ss-surface-border)] px-4 py-3">
      <dl className="grid gap-3 sm:grid-cols-2 text-sm">
        <div>
          <dt className="font-semibold text-[color:var(--ss-ink-1)]">Confirmed</dt>
          <dd className="ss-caption mt-1">{blind ? 'Confirmed by an admin' : 'Mutual #1 or confirmed by an admin'}</dd>
        </div>
        <div>
          <dt className="font-semibold text-[color:var(--ss-ink-1)]">Needs review</dt>
          <dd className="ss-caption mt-1">Awaiting admin confirmation</dd>
        </div>
      </dl>
      {!blind && <div className="ss-caption mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t border-[color:var(--ss-surface-border)] pt-3">
        <span>Big / Little = rank of partner</span>
        <span><strong>#1</strong> First choice</span>
        <span><strong>—</strong> Not ranked</span>
      </div>}
    </aside>
    {blind ? <p className="ss-caption">Blind rankings are on. Rank positions and automatic mutual first-choice confirmation are hidden. Admin confirmations are still saved.</p>
      : rankings.error ? <div role="alert"><p className="ss-caption">Could not load ranking details. Saved admin confirmations remain visible; automatic first-choice confirmation is unavailable.</p><Button variant="quiet" size="sm" className="mt-2" onClick={()=>void rankings.refetch()}>Retry rank grouping</Button></div>
      : rankings.isPending && <p role="status" className="ss-caption">Checking mutual first choices…</p>}
    {saveError && <p role="alert" className="text-sm text-brick">{saveError}</p>}
    {confirmations.data.lockReason && <p className="ss-caption">{confirmations.data.lockReason}</p>}
    {sizes.map(size => <section key={size} className="ss-surface" aria-label={`1:${size} matchings`}>
      <h2 className="font-medium">1:{size} matchings</h2>
      <p className="ss-caption mt-1">One Big with {size === 1 ? 'one Little' : `${size} Littles`} · {familyCount(size)} {size === 1 ? 'pair' : 'group'}{familyCount(size) === 1 ? '' : 's'}</p>
      {rows(reviewed.filter(pair => counts.get(pair.bigId) === size).sort((a,b) => (a.bigName || '').localeCompare(b.bigName || '')))}
    </section>)}
  </div>;
}
