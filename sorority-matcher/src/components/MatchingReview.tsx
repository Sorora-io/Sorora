import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import Button from './Button';
interface Review { oneSidedPairings?:{bigId:string;littleId:string;bigName:string;littleName:string}[]; unmatched: {userId:string;name:string;role:string}[]; unsupportedPairings:{bigId:string;littleId:string;bigName:string;littleName:string}[]; }
export default function MatchingReview({groupId,cycleId}:{groupId:string;cycleId:string}) {
 const {user}=useAuth();
 const query=useQuery({queryKey:['user',user?.id,'matching-review',groupId,cycleId],queryFn:async()=>{
  const {data,error}=await supabase.rpc('get_matching_review',{p_group_id:groupId,p_cycle_id:cycleId});if(error)throw new Error(error.message);return data as Review;
 },enabled:!!user,staleTime:0,refetchInterval:15000,retry:false});
 return <section className="ss-surface mt-6" aria-label="Manual matching review">
  <h2 className="font-medium">Members without a match</h2>
  <p className="ss-caption mt-2">Automatic matching requires at least one person to have ranked the other. Members without a match stay unpaired for an admin to review and assign manually.</p>
  {query.isPending ? <p role="status" className="mt-3">Checking members needing review…</p> : query.error ? <p role="alert" className="mt-3">Could not load matching review. Refresh before revealing pairings.</p> : query.data && <>
   {query.data.unmatched.length>0 ? <div className="mt-4"><h3 className="font-medium">Unmatched — needs admin review</h3><ul className="mt-2 space-y-2">{query.data.unmatched.map(m=><li key={m.userId} className="text-sm">{m.name} · {m.role==='big'?'Big':'Little'} · Unmatched</li>)}</ul></div> : <p className="ss-caption mt-3">Every participating member has a pairing.</p>}
   {!!query.data.oneSidedPairings?.length && <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4"><h3 className="font-medium">★ One-sided rankings — review</h3><p className="ss-caption mt-2">Only one person ranked the other in these pairs. These are flagged for admin review; the flag does not change the pairing.</p><ul className="mt-3 space-y-2">{query.data.oneSidedPairings.map(p=><li key={`${p.bigId}:${p.littleId}`} className="flex flex-wrap items-center justify-between gap-2 text-sm"><span>{p.bigName} → {p.littleName}</span><span className="rounded-badge bg-amber-100 px-3 py-1 font-medium">★ One-sided ranking</span></li>)}</ul></div>}
   {query.data.unsupportedPairings.length>0 && <div role="alert" className="mt-4 rounded-lg border border-brick p-3"><h3 className="font-medium">Pairings with no ranking connection</h3><p className="ss-caption mt-2">Neither person ranked the other in these existing pairs. Confirm they were deliberately assigned manually or adjust them before reveal.</p><ul className="mt-2 space-y-2">{query.data.unsupportedPairings.map(p=><li key={`${p.bigId}:${p.littleId}`} className="text-sm">{p.bigName} → {p.littleName}</li>)}</ul></div>}
  </>}
  <Button variant="quiet" size="sm" className="mt-3" disabled={query.isFetching} onClick={()=>void query.refetch()}>Refresh matching review</Button>
 </section>;
}
