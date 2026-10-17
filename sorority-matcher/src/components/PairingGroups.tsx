import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { getRankingExport } from '../lib/rankingExport';
import { PairingRow } from '../lib/rankings';
import { reviewPairings } from '../lib/pairingReview';
import Button from './Button';

export default function PairingGroups({groupId,cycleId,blind,pairings}:{groupId:string;cycleId:string;blind:boolean;pairings:PairingRow[]}) {
  const {user}=useAuth();
  const [showFirst,setShowFirst]=useState(false);
  const query=useQuery({
    queryKey:['user',user?.id,'pairing-ranks',groupId,cycleId,pairings.map(p=>`${p.bigId}:${p.littleId}`).sort().join(',')],
    queryFn:()=>getRankingExport(groupId,cycleId,true),
    enabled:!!user && !blind && pairings.length>0,
    gcTime:0,staleTime:0,retry:false,refetchInterval:15000,
  });
  const plainRows=()=> <ul className="divide-y divide-[color:var(--ss-surface-border)]">{pairings.map(pair=><li key={`${pair.bigId}:${pair.littleId}`} className="py-3 text-sm break-words"><span className="font-medium">{pair.bigName || 'Unknown Big'}</span> → {pair.littleName || 'Unknown Little'}</li>)}</ul>;
  if(blind || !query.data || query.error) return <section className="ss-surface" aria-label="Saved pairings">
    <h2 className="font-medium">Saved pairings ({pairings.length})</h2>
    <p className="ss-caption mt-2">{blind ? 'Blind rankings are on. Rank positions and mutual first-choice grouping are hidden.' : query.error ? 'Could not load ranking details. Pairings remain visible; no first-choice assumptions have been made.' : 'Checking mutual first choices…'}</p>
    {!blind && query.error && <Button variant="quiet" size="sm" className="mt-2" onClick={()=>void query.refetch()}>Retry rank grouping</Button>}
    {plainRows()}
  </section>;
  const reviewed=reviewPairings(pairings,query.data);
  const first=reviewed.filter(pair=>pair.mutualFirst);
  const rest=reviewed.filter(pair=>!pair.mutualFirst);
  const rows=(pairs:typeof reviewed)=><ul className="mt-3 divide-y divide-[color:var(--ss-surface-border)]">{pairs.map(pair=><li key={`${pair.bigId}:${pair.littleId}`} className="py-3 text-sm break-words">
    <p className="font-medium">{pair.bigName || 'Unknown Big'} → {pair.littleName || 'Unknown Little'}</p>
    <p className="mt-1 font-medium">{pair.matchType}</p>
    <p className="ss-caption mt-1">Big’s rank of Little: {typeof pair.bigRank==='number' ? `#${pair.bigRank}` : pair.bigRank}</p>
    <p className="ss-caption">Little’s rank of Big: {typeof pair.littleRank==='number' ? `#${pair.littleRank}` : pair.littleRank}</p>
  </li>)}</ul>;
  return <div className="space-y-4">
    <p className="ss-caption"><strong>Review key:</strong> Confirmed = both ranked each other #1. Needs review = all other pairs. #1 = first choice. Not ranked = omitted from that person’s list. Not submitted = no ranking submitted for this cycle.</p>
    <section className="ss-surface" aria-label="Confirmed pairings">
      <h2 className="font-medium">Confirmed ({first.length})</h2>
      <p className="ss-caption mt-2">Confirmed automatically because both ranked each other #1. This status does not lock or change a pairing.</p>
      {first.length>0 ? <><Button variant="quiet" size="sm" className="mt-3" aria-expanded={showFirst} aria-controls="mutual-first-pairs" onClick={()=>setShowFirst(!showFirst)}>{showFirst?'Hide confirmed pairs':'Show confirmed pairs'}</Button>{showFirst && <div id="mutual-first-pairs">{rows(first)}</div>}</> : <p className="ss-caption mt-3">No pairs are confirmed automatically.</p>}
    </section>
    <section className="ss-surface" aria-label="Pairings needing review">
      <h2 className="font-medium">Needs review ({rest.length})</h2>
      {rest.length ? rows(rest) : <p className="ss-caption mt-3">All saved pairs are confirmed mutual first choices.</p>}
    </section>
  </div>;
}
