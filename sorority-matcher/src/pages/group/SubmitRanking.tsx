import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useGroup } from '../../contexts/GroupContext';
import { setMyTwinWillingness, groupLabel } from '../../lib/groups';
import { getRoster, getMyRanking, submitRanking } from '../../lib/rankings';
import { queryKeys } from '../../lib/queryKeys';
import LoadingLogo from '../../components/LoadingLogo';
import Button from '../../components/Button';

const SubmitRanking = () => {
  const { membership, refresh } = useGroup();
  const group = membership?.group;
  const role = membership?.role;
  const oppositeRole = role === 'big' ? 'little' : 'big';
  const oppositeLabel = oppositeRole === 'big' ? 'Bigs' : 'Littles';
  const minRequired = role === 'big' ? group?.min_big_rankings ?? 1 : group?.min_little_rankings ?? 1;
  const cycleId = group?.active_cycle_id ?? null;
  const queryClient = useQueryClient();

  const { data: roster = [], isLoading: rosterLoading } = useQuery({
    queryKey: queryKeys.groupRoster(group?.id ?? '', oppositeRole),
    queryFn: () => getRoster(group!.id, oppositeRole).then(({ roster: r }) => r),
    enabled: !!group,
  });
  // Shares its cache key with Dashboard's OrgCard — whichever page the
  // member visited first already has this warm.
  const { data: existingRankedIds, isLoading: rankingLoading } = useQuery({
    queryKey: queryKeys.myRanking(cycleId ?? ''),
    queryFn: () => getMyRanking(cycleId).then(({ rankedIds: ids }) => ids),
    enabled: !!cycleId,
  });

  const [rankedIds, setRankedIds] = useState<string[]>([]);
  const [willingToTakeTwins, setWillingToTakeTwins] = useState(membership?.willing_to_take_twins ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  // Seed the editable draft from cached/fetched data exactly once — after
  // that, this is the user's own in-progress edit, and a background
  // refetch of the same query must not silently overwrite it.
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || !existingRankedIds) return;
    const rosterIds = new Set(roster.map(m => m.userId));
    setRankedIds(existingRankedIds.filter(id => rosterIds.has(id)));
    seeded.current = true;
  }, [existingRankedIds, roster]);

  const loading = (rosterLoading || rankingLoading) && !seeded.current;

  const rosterById = new Map(roster.map(m => [m.userId, m]));
  const available = roster.filter(m => !rankedIds.includes(m.userId));

  const addToRanking = (userId: string) => setRankedIds(prev => [...prev, userId]);
  const removeFromRanking = (userId: string) => setRankedIds(prev => prev.filter(id => id !== userId));
  const moveUp = (index: number) => {
    if (index === 0) return;
    setRankedIds(prev => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  };
  const moveDown = (index: number) => {
    setRankedIds(prev => {
      if (index === prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  };

  const handleSave = async () => {
    if (!group || !cycleId) return;
    if (rankedIds.length < minRequired) {
      setError(`Please rank at least ${minRequired} ${minRequired === 1 ? oppositeLabel.slice(0, -1) : oppositeLabel}.`);
      return;
    }
    setSaving(true);
    setError('');
    setSaved(false);

    const tasks: Promise<{ error: string | null }>[] = [submitRanking(group.id, cycleId, rankedIds)];
    if (role === 'big') tasks.push(setMyTwinWillingness(group.id, willingToTakeTwins));

    const results = await Promise.all(tasks);
    const failed = results.find(r => r.error);
    if (failed) {
      setError(failed.error!);
    } else {
      setSaved(true);
      // Other pages (Dashboard's OrgCard) cache this same query — without
      // invalidating it here, they'd keep showing "not submitted" until
      // their own cache happens to go stale on its own.
      queryClient.invalidateQueries({ queryKey: queryKeys.myRanking(cycleId) });
      await refresh();
    }
    setSaving(false);
  };

  if (!group || !role) return null;

  return (
    <div className="min-h-screen flex flex-col items-center p-8">
      <header className="mb-8">
        <Link to="/">
          <h1 className="text-4xl font-display font-semibold text-center text-jade-800">Sorora</h1>
        </Link>
      </header>

      <div className="max-w-3xl w-full">
        <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-black mb-4">
          <ArrowLeft size={14} /> Back to Dashboard
        </Link>
      </div>

      <div className="max-w-3xl w-full bg-white rounded-lg shadow-sm p-5">
        <h2 className="text-2xl font-semibold mb-1">Rank your {oppositeLabel}</h2>
        <p className="text-gray-500 text-sm mb-6">
          {groupLabel(group)} · rank at least {minRequired}, most preferred first
        </p>

        {!cycleId ? (
          <p className="text-gray-500 text-sm">
            No active cycle yet — check back once your chapter admin starts one.
          </p>
        ) : loading ? (
          <div className="flex items-center gap-2 text-gray-500"><LoadingLogo size={20} /> Loading...</div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Available</h3>
              <div className="flex flex-col gap-2 min-h-[100px]">
                {available.length === 0 && (
                  <p className="text-gray-400 text-sm">Everyone's been ranked.</p>
                )}
                {available.map(m => (
                  <button
                    key={m.userId}
                    onClick={() => addToRanking(m.userId)}
                    className="text-left px-3 py-2 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    {m.name || m.email}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                Your ranking ({rankedIds.length})
              </h3>
              <div className="flex flex-col gap-2 min-h-[100px]">
                {rankedIds.length === 0 && (
                  <p className="text-gray-400 text-sm">Click a name on the left to add them.</p>
                )}
                {rankedIds.map((id, idx) => (
                  <div
                    key={id}
                    className="flex items-center justify-between px-3 py-2 border border-gray-200 rounded-md bg-gray-50"
                  >
                    <span>
                      <span className="text-gray-400 mr-2">{idx + 1}.</span>
                      {rosterById.get(id)?.name || rosterById.get(id)?.email || 'Unknown'}
                    </span>
                    <span className="flex gap-1">
                      <button onClick={() => moveUp(idx)} disabled={idx === 0} className="px-2 disabled:opacity-30">
                        ↑
                      </button>
                      <button
                        onClick={() => moveDown(idx)}
                        disabled={idx === rankedIds.length - 1}
                        className="px-2 disabled:opacity-30"
                      >
                        ↓
                      </button>
                      <button onClick={() => removeFromRanking(id)} className="px-2 text-brick">
                        ×
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {role === 'big' && (
          <label className="flex items-center gap-2 mt-6 text-sm">
            <input
              type="checkbox"
              checked={willingToTakeTwins}
              onChange={(e) => setWillingToTakeTwins(e.target.checked)}
              className="accent-jade-600 w-4 h-4"
            />
            I'm willing to take two Littles (twins)
          </label>
        )}

        {error && <p className="text-brick text-sm mt-4">{error}</p>}
        {saved && <p className="text-jade-700 text-sm mt-4">Ranking saved.</p>}

        <Button className="mt-6" fullWidth onClick={handleSave} disabled={saving || loading || !cycleId}>
          {saving ? '...' : 'Save Ranking'}
        </Button>
      </div>
    </div>
  );
};

export default SubmitRanking;
