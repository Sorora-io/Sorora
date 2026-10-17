import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { useRankingDeadline } from '../lib/rankingDeadline';
import { supabase } from '../lib/supabase';
import Button from './Button';

interface Review { state: 'not_due' | 'private' | 'ready'; members: {userId: string; name: string; role: string}[]; }
export default function UnrankedMemberReview({groupId, cycleId, deadline, blind}: {
  groupId: string; cycleId: string; deadline: string | null; blind: boolean;
}) {
  const {user} = useAuth();
  const passed = useRankingDeadline(deadline);
  const query = useQuery({
    queryKey: ['user',user?.id,'unranked-review',groupId,cycleId,deadline,blind],
    queryFn: async () => {
      const {data,error} = await supabase.rpc('get_unranked_member_review',{p_group_id:groupId,p_cycle_id:cycleId});
      if (error) throw new Error(error.message);
      return data as Review;
    },
    enabled: passed && !blind,
    refetchInterval: 30000,
  });
  if (!passed) return null;
  return <section className="ss-surface mt-6" aria-label="Post-deadline review">
    <h2 className="font-medium">Post-deadline review</h2>
    {blind || query.data?.state === 'private' ? <p className="ss-caption mt-2">Blind rankings are on. Members with no rankings received are not identified, to keep preferences private.</p>
      : query.isPending ? <p className="ss-caption mt-2" role="status">Checking rankings received…</p>
      : query.error ? <div role="alert"><p className="ss-caption mt-2">Could not check rankings received. Review is unavailable until this loads.</p><Button variant="outline" size="sm" className="mt-2" onClick={() => void query.refetch()}>Retry review</Button></div>
      : query.data?.state === 'ready' ? <>
        {query.data.members.length ? <>
          <p className="ss-caption mt-2">These members received no rankings from approved members of the opposite role this cycle. Review their pairings before reveal. They remain eligible for matching, and their own submitted preferences can still be used.</p>
          <ul className="mt-3 space-y-2">{query.data.members.map(member => <li key={member.userId} className="flex flex-wrap justify-between gap-2 text-sm"><span>{member.name} · {member.role === 'big' ? 'Big' : 'Little'}</span><span className="font-medium text-[color:var(--ss-error)]">No rankings received</span></li>)}</ul>
        </> : <p className="ss-caption mt-2">Every approved Big and Little received at least one ranking this cycle.</p>}
      </> : <p className="ss-caption mt-2">Review is available after the active cycle’s ranking deadline.</p>}
  </section>;
}
