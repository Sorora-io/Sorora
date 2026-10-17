import MemberRankingPicker from './MemberRankingPicker';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { getRankingExport } from '../lib/rankingExport';
import Button from './Button';

// Mounted only for nonblind chapters on the admin-only submission status page.
// The export RPC independently checks admin access, chapter, cycle and privacy.
export default function MemberRankings({ groupId, cycleId, initiallyOpen = false }: { groupId: string; cycleId: string; initiallyOpen?: boolean }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(initiallyOpen);
  const [memberId, setMemberId] = useState('');
  const query = useQuery({
    queryKey: ['user', user?.id, 'member-rankings', groupId, cycleId],
    queryFn: () => getRankingExport(groupId, cycleId, true),
    enabled: open,
    gcTime: 0,
    retry: false,
  });
  const member = query.data?.members.find(m => m.userId === memberId);
  return <section className="mt-6 ss-surface" aria-label="Individual member rankings">
    <h2 className="font-medium text-[color:var(--ss-ink-1)]">Individual member rankings</h2>
    <p className="mt-2 ss-caption">Review each approved Big or Little’s submitted choices for the current cycle. Rank 1 is their first choice.</p>
    <Button variant="quiet" size="sm" className="mt-3" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="member-rankings-content">
      {open ? 'Hide member rankings' : 'View member rankings'}
    </Button>
    {open && <div id="member-rankings-content" className="mt-4">
      {query.isFetching ? <p role="status" className="ss-caption">Loading member rankings…</p>
        : query.error ? <div role="alert">
          <p className="ss-caption">{query.error.message}</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => void query.refetch()}>Retry rankings</Button>
        </div>
        : query.data && <>
          {!query.data.members.length ? <p className="ss-caption">No approved Bigs or Littles yet.</p> : <>
            <MemberRankingPicker members={query.data.members} value={memberId} onChange={setMemberId} />
            {member && <div className="mt-4" aria-live="polite">
              <h3 className="font-medium">{member.name || member.email}</h3>
              {!member.submitted ? <p className="mt-2 ss-caption">This member hasn’t submitted a ranking yet.</p>
                : <>
                  {member.updatedAt && <p className="mt-1 ss-caption">Last submitted: {new Date(member.updatedAt).toLocaleString()}</p>}
                  {member.preferences?.length ? <ol className="mt-3 space-y-2" aria-label="Ranked preferences">
                    {[...member.preferences].sort((a, b) => a.rank - b.rank).map(pref => <li key={`${pref.rank}:${pref.userId}`} className="flex gap-3 text-sm">
                      <span className="font-medium">{pref.rank}.</span><span>{pref.name || pref.email || 'Unavailable member'}</span>
                    </li>)}
                  </ol> : <p className="mt-2 ss-caption">Submitted with no ranked preferences.</p>}
                </>}
            </div>}
          </>}
        </>}
    </div>}
  </section>;
}
