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
  const [showConfirmed,setShowConfirmed]=useState(false);
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
    <h2 className="font-medium">Saved pairings ({pairings.length})</h2>
    <p className="ss-caption mt-2">{confirmations.error ? 'Could not load saved confirmations. Refresh before reviewing these pairs.' : 'Loading saved confirmations…'}</p>
    {confirmations.error && <Button variant="quiet" size="sm" className="mt-2" onClick={()=>void confirmations.refetch()}>Retry confirmations</Button>}
    <ul className="mt-3 space-y-3">{pairings.map(pair=><li key={`${pair.bigId}:${pair.littleId}`} className="text-sm break-words">{pair.bigName || 'Unknown Big'} → {pair.littleName || 'Unknown Little'}</li>)}</ul>
  </section>;
  const visibleRankings=!blind && !rankings.error ? rankings.data : undefined;
  const reviewed=reviewPairings(pairings,visibleRankings ?? {members:[]},confirmations.data.decisions);
  const confirmed=reviewed.filter(pair=>pair.confirmed);
  const needsReview=reviewed.filter(pair=>!pair.confirmed);
  const rows=(pairs:typeof reviewed)=><ul className="mt-3 divide-y divide-[color:var(--ss-surface-border)]">{pairs.map(pair=><li key={`${pair.bigId}:${pair.littleId}`} className="flex items-start justify-between gap-3 py-3 text-sm">
    <div className="min-w-0 break-words">
    <p className="font-medium">{pair.bigName || 'Unknown Big'} → {pair.littleName || 'Unknown Little'}</p>
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
    <p className="ss-caption"><strong>Review key:</strong> Confirmed = mutual first choice by default, or confirmed by an admin. Needs review = not yet confirmed. Big/Little show each person’s rank of their partner. #1 = first choice; — = not ranked.</p>
    {blind ? <p className="ss-caption">Blind rankings are on. Rank positions and automatic mutual first-choice confirmation are hidden. Admin confirmations are still saved.</p>
      : rankings.error ? <div role="alert"><p className="ss-caption">Could not load ranking details. Saved admin confirmations remain visible; automatic first-choice confirmation is unavailable.</p><Button variant="quiet" size="sm" className="mt-2" onClick={()=>void rankings.refetch()}>Retry rank grouping</Button></div>
      : rankings.isPending && <p role="status" className="ss-caption">Checking mutual first choices…</p>}
    {saveError && <p role="alert" className="text-sm text-brick">{saveError}</p>}
    {confirmations.data.lockReason && <p className="ss-caption">{confirmations.data.lockReason}</p>}
    <section className="ss-surface" aria-label="Confirmed pairings">
      <h2 className="font-medium">Confirmed ({confirmed.length})</h2>
      <p className="ss-caption mt-2">Mutual first choices start here automatically when rankings are visible. Admins can confirm other reviewed pairs.</p>
      {confirmed.length>0 ? <><Button variant="quiet" size="sm" className="mt-3" aria-expanded={showConfirmed} aria-controls="confirmed-pairs" onClick={()=>setShowConfirmed(!showConfirmed)}>{showConfirmed?'Hide confirmed pairs':'Show confirmed pairs'}</Button>{showConfirmed && <div id="confirmed-pairs">{rows(confirmed)}</div>}</> : <p className="ss-caption mt-3">No confirmed pairs yet.</p>}
    </section>
    <section className="ss-surface" aria-label="Pairings needing review">
      <h2 className="font-medium">Needs review ({needsReview.length})</h2>
      {needsReview.length ? rows(needsReview) : <p className="ss-caption mt-3">All saved pairs are confirmed.</p>}
    </section>
  </div>;
}
