import { invalidateChapter } from '../../lib/cache';
import { useAuth } from '../../contexts/AuthContext';
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
  const { user } = useAuth();
  const { membership, refresh } = useGroup();
  const group = membership?.group;
  const role = membership?.role;
  const oppositeRole = role === 'big' ? 'little' : 'big';
  const oppositeLabel = oppositeRole === 'big' ? 'Bigs' : 'Littles';
  const minRequired = role === 'big' ? group?.min_big_rankings ?? 1 : group?.min_little_rankings ?? 1;
  const cycleId = group?.active_cycle_id ?? null;
  const queryClient = useQueryClient();

  const { data: roster = [], isLoading: rosterLoading } = useQuery({
    queryKey: queryKeys.groupRoster(user?.id ?? '', group?.id ?? '', oppositeRole),
    queryFn: () => getRoster(group!.id, oppositeRole).then(({ roster: r }) => r),
    enabled: !!group,
  });
  // Shares its cache key with Dashboard's OrgCard — whichever page the
  // member visited first already has this warm.
  const { data: existingRankedIds, isLoading: rankingLoading } = useQuery({
    queryKey: queryKeys.myRanking(user?.id ?? '', cycleId ?? ''),
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
      queryClient.setQueryData(queryKeys.myRanking(user!.id, cycleId), [...rankedIds]);
      await invalidateChapter(queryClient, user!.id, group.id, cycleId);
      await refresh();
    }
    setSaving(false);
  };

  if (!group || !role) return null;

  return (
    <div className="min-h-screen w-full flex flex-col items-center px-5 md:px-8 py-8">
      <section className="ss-frost w-full max-w-3xl rounded-[28px] bg-white/25 shadow-[0_20px_60px_-40px_rgba(15,45,32,0.35)] px-6 md:px-12 pt-8 pb-10 md:pt-10 md:pb-14 flex flex-col">
        <header className="flex items-center justify-between mb-8">
          <Link to="/" className="font-display italic text-2xl font-medium text-[color:var(--ss-ink-1)]">
            sorora
          </Link>
          <Link
            to="/dashboard"
            className="inline-flex items-center justify-center gap-2 px-5 py-2 text-sm min-h-[36px] rounded-pill border border-[color:var(--ss-jade-line)] bg-transparent text-[color:var(--ss-ink-2)] font-medium hover:bg-white/60 transition-colors whitespace-nowrap"
          >
            <ArrowLeft size={14} /> Back to dashboard
          </Link>
        </header>

        <span className="ss-kicker">Your rankings</span>
        <h1 className="font-display text-[34px] md:text-[46px] leading-[1.1] font-medium text-[color:var(--ss-ink-1)]">
          Rank your {oppositeLabel.toLowerCase()}.
        </h1>
        <p className="mt-2 ss-caption">
          {groupLabel(group)} · rank at least {minRequired}, most preferred first
        </p>

        {!cycleId ? (
          <p className="mt-8 ss-caption">
            No active cycle yet — check back once your chapter admin starts one.
          </p>
        ) : loading ? (
          <div className="mt-8 flex items-center gap-2 text-[color:var(--ss-ink-5)]">
            <LoadingLogo size={20} /> Loading…
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="ss-surface">
              <div className="ss-kicker" style={{ marginBottom: 8 }}>Available</div>
              <div className="flex flex-col gap-2 min-h-[120px]">
                {available.length === 0 && (
                  <p className="ss-caption">Everyone's been ranked.</p>
                )}
                {available.map(m => (
                  <button
                    key={m.userId}
                    onClick={() => addToRanking(m.userId)}
                    className="text-left px-3 py-2 bg-white/60 border border-[color:var(--ss-input-border)] rounded-lg hover:bg-white/85 transition-colors text-[color:var(--ss-ink-2)]"
                  >
                    {m.name || m.email}
                  </button>
                ))}
              </div>
            </div>

            <div className="ss-surface">
              <div className="ss-kicker" style={{ marginBottom: 8 }}>
                Your ranking ({rankedIds.length})
              </div>
              <div className="flex flex-col gap-2 min-h-[120px]">
                {rankedIds.length === 0 && (
                  <p className="ss-caption">Click a name on the left to add them.</p>
                )}
                {rankedIds.map((id, idx) => (
                  <div
                    key={id}
                    className="flex items-center justify-between px-3 py-2 bg-white/75 border border-[color:var(--ss-input-border)] rounded-lg"
                  >
                    <span className="text-[color:var(--ss-ink-2)]">
                      <span className="text-[color:var(--ss-ink-5)] mr-2 tabular-nums">{idx + 1}.</span>
                      {rosterById.get(id)?.name || rosterById.get(id)?.email || 'Unknown'}
                    </span>
                    <span className="flex gap-1">
                      <button
                        onClick={() => moveUp(idx)}
                        disabled={idx === 0}
                        className="px-2 text-[color:var(--ss-ink-4)] disabled:opacity-30"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => moveDown(idx)}
                        disabled={idx === rankedIds.length - 1}
                        className="px-2 text-[color:var(--ss-ink-4)] disabled:opacity-30"
                      >
                        ↓
                      </button>
                      <button
                        onClick={() => removeFromRanking(id)}
                        className="px-2 text-brick"
                      >
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
          <label className="flex items-center gap-2 mt-6 text-sm text-[color:var(--ss-ink-3)]">
            <input
              type="checkbox"
              checked={willingToTakeTwins}
              onChange={e => setWillingToTakeTwins(e.target.checked)}
              className="accent-[color:var(--ss-jade-deep)] w-4 h-4"
            />
            I'm willing to take two Littles (twins)
          </label>
        )}

        {error && <p className="text-[color:var(--ss-error)] text-sm mt-4">{error}</p>}
        {saved && <p className="text-[color:var(--ss-jade)] text-sm mt-4">Ranking saved.</p>}

        <div className="mt-8">
          <Button size="lg" fullWidth onClick={handleSave} disabled={saving || loading || !cycleId}>
            {saving ? '…' : 'Save ranking'}
          </Button>
        </div>
      </section>
    </div>
  );
};

export default SubmitRanking;
