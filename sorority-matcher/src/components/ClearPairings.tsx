import {useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {useAuth} from '../contexts/AuthContext';
import {getPairingEditor,clearCyclePairings} from '../lib/pairingChanges';
import Button from './Button';
export default function ClearPairings({groupId,cycleId,onCleared}:{groupId:string;cycleId:string;onCleared:()=>Promise<void>}) {
 const {user}=useAuth();const client=useQueryClient();
 const query=useQuery({queryKey:['user',user?.id,'pairing-editor',groupId,cycleId],queryFn:()=>getPairingEditor(groupId,cycleId),enabled:!!user});
 const [version,setVersion]=useState<string|null>(null);const [confirmation,setConfirmation]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [message,setMessage]=useState('');
 const blocked=!!query.error||query.isFetching||!!query.data?.lockReason||version!==query.data?.version;
 const clear=async()=>{if(blocked||busy||confirmation!=='clear'||!version)return;setBusy(true);setError('');try{
  const count=await clearCyclePairings(groupId,cycleId,version,confirmation);setVersion(null);setConfirmation('');setMessage(`${count} pairings cleared. Rankings are kept. You can change the matching limit and run matching again.`);await client.invalidateQueries({queryKey:['user',user?.id]});await onCleared();
 }catch(e){setError((e as Error).message);}finally{setBusy(false);}};
 return <section className="ss-surface mt-6" aria-label="Clear cycle pairings"><h2 className="font-medium">Clear pairings</h2><p className="ss-caption mt-2">Remove this cycle’s pairings so you can adjust matching rules and rerun. Submitted rankings and chapter members are kept. Any scheduled reveal is cancelled.</p>
 {query.data?.lockReason && <p className="ss-caption mt-2">{query.data.lockReason}</p>}
 {query.error && <p role="alert" className="mt-2">Could not load current pairings. Refresh before clearing.</p>}
 {version===null ? <Button variant="danger-outline" size="sm" className="mt-3" disabled={(!query.data?.pairings.length&&!query.data?.history?.length)||!!query.data?.lockReason||query.isFetching||!!query.error} onClick={()=>{setVersion(query.data!.version);setConfirmation('');setError('');setMessage('');}}>Clear pairings</Button> : <div role="dialog" aria-label="Confirm clear pairings" className="mt-3 rounded-xl border p-4"><p>Clear all {query.data?.pairings.length} pairings in this cycle? Rankings will stay saved.</p><label className="mt-3 block text-sm">Type clear to confirm<input className="ss-input mt-1 block" value={confirmation} disabled={busy} onChange={e=>setConfirmation(e.target.value)} autoComplete="off"/></label>{blocked && <p role="alert" className="mt-2">Pairing information changed or is refreshing. Cancel and review again.</p>}<div className="mt-3 flex flex-wrap gap-2"><Button variant="danger-outline" size="sm" disabled={blocked||busy||confirmation!=='clear'} onClick={()=>void clear()}>{busy?'Clearing…':'Confirm clear pairings'}</Button><Button variant="outline" size="sm" disabled={busy} onClick={()=>{setVersion(null);setError('');}}>Cancel</Button></div></div>}
 {error && <p role="alert" className="mt-3">{error}</p>}{message && <p role="status" className="mt-3">{message}</p>}
 </section>;
}
