import PageHeader from '../../components/PageHeader';
import { invalidateChapter } from '../../lib/cache';
import { useAuth } from '../../contexts/AuthContext';
import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useGroup } from '../../contexts/GroupContext';
import { setMyLittlePreference, groupLabel } from '../../lib/groups';
import { getRoster, getMyRanking, submitRanking } from '../../lib/rankings';
import { queryKeys, STALE } from '../../lib/queryKeys';
import LoadingLogo from '../../components/LoadingLogo';
import Button from '../../components/Button';
import Avatar from '../../components/Avatar';
import SceneShell from '../../components/SceneShell';
import ChooseMatchingRole from '../../components/ChooseMatchingRole';

const RankingEditor = () => {
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
    staleTime: STALE.medium,
  });
  // Shares its cache key with Dashboard's OrgCard — whichever page the
  // member visited first already has this warm.
  const { data: existingRankedIds, isLoading: rankingLoading } = useQuery({
    queryKey: queryKeys.myRanking(user?.id ?? '', cycleId ?? ''),
    queryFn: () => getMyRanking(cycleId).then(({ rankedIds: ids }) => ids),
    enabled: !!cycleId,
  });

  const [rankedIds, setRankedIds] = useState<string[]>([]);
  const [willingToTakeTwins, setWillingToTakeTwins] = useState(membership?.wanted_little_count ? false : membership?.willing_to_take_twins ?? false);
  const [wantedLittleCount, setWantedLittleCount] = useState<2 | 3 | null>(membership?.wanted_little_count ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  // Seed the editable draft from cached/fetched data exactly once — after
  // that, this is the user's own in-progress edit, and a background
  // refetch of the same query must not silently overwrite it.
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || !existingRankedIds || rosterLoading) return;
    const rosterIds = new Set(roster.map(m => m.userId));
    setRankedIds(existingRankedIds.filter(id => rosterIds.has(id)));
    seeded.current = true;
  }, [existingRankedIds, roster, rosterLoading]);

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
    if (role === 'big') tasks.push(setMyLittlePreference(group.id, willingToTakeTwins, wantedLittleCount));

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
        <PageHeader className="flex items-center justify-between mb-8">
          <Link to="/" className="font-display italic text-2xl font-medium text-[color:var(--ss-ink-1)]">
            sorora
          </Link>
          <Link
            to="/dashboard"
            className="inline-flex items-center justify-center gap-2 px-5 py-2 text-sm min-h-[36px] rounded-pill border border-[color:var(--ss-jade-line)] bg-transparent text-[color:var(--ss-ink-2)] font-medium hover:bg-white/60 transition-colors whitespace-nowrap"
          >
            <ArrowLeft size={14} /> Back to dashboard
          </Link>
        </PageHeader>

        <span className="ss-kicker">Your rankings</span>
        <h1 className="font-display text-[34px] md:text-[46px] leading-[1.1] font-medium text-[color:var(--ss-ink-1)]">
          Rank your {oppositeLabel.toLowerCase()}.
        </h1>
        <p className="mt-2 ss-caption">
          {groupLabel(group)} · rank at least {minRequired}, most preferred first
        </p>

        <p className="mt-3 ss-caption">{(group.blind_rankings ?? true) ? 'Blind rankings are on. Admins can see that you submitted, but cannot view your ranking order.' : 'Blind rankings are off. Chapter admins can access your ranked preferences.'}</p>

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
                    className="flex items-center gap-3 text-left px-3 py-2 bg-white/60 border border-[color:var(--ss-input-border)] rounded-lg hover:bg-white/85 transition-colors text-[color:var(--ss-ink-2)]"
                  >
                    <Avatar src={m.avatarUrl} name={m.name} email={m.email} size="sm" />
                    <span>{m.name || m.email}</span>
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
                    <span className="flex min-w-0 items-center gap-2 text-[color:var(--ss-ink-2)]">
                      <Avatar src={rosterById.get(id)?.avatarUrl} name={rosterById.get(id)?.name} email={rosterById.get(id)?.email} size="sm" />
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
          <fieldset className="mt-6 space-y-3 text-sm text-[color:var(--ss-ink-3)]" disabled={saving}>
            <legend className="font-medium mb-2">How many Littles would you like?</legend>
            <label className="flex items-center gap-2">
              <input type="radio" name="littlePreference" checked={wantedLittleCount !== null}
                onChange={() => { setWantedLittleCount(2); setWillingToTakeTwins(false); }}
                className="accent-[color:var(--ss-jade-deep)] w-4 h-4" />
              I’m WANTING to take multiple Littles
            </label>
            {wantedLittleCount !== null && (
              <div role="radiogroup" aria-label="Wanted number of Littles" className="grid grid-cols-2 gap-3 pl-6 max-w-sm">
                {([2, 3] as const).map(count => (
                  <label key={count} className={`relative cursor-pointer rounded-2xl border px-4 py-3 transition-colors ${wantedLittleCount === count ? 'border-[color:var(--ss-jade-deep)] bg-[color:var(--ss-jade-deep)] text-white shadow-sm' : 'border-[color:var(--ss-input-border)] bg-white/60 hover:bg-white/90'}`}>
                    <input type="radio" name="wantedLittleCount" value={count}
                      checked={wantedLittleCount === count} onChange={() => setWantedLittleCount(count)}
                      className="peer sr-only" />
                    <span className="absolute inset-0 rounded-2xl peer-focus-visible:ring-2 peer-focus-visible:ring-[color:var(--ss-jade-deep)] peer-focus-visible:ring-offset-2" />
                    <span className="block font-medium">{count} Littles</span>
                    <span className={`block text-xs mt-1 ${wantedLittleCount === count ? 'text-white/80' : 'text-[color:var(--ss-ink-5)]'}`}>{count === 2 ? 'Twins' : 'Triplets'}</span>
                  </label>
                ))}
              </div>
            )}
            <label className="flex items-center gap-2">
              <input type="radio" name="littlePreference" checked={willingToTakeTwins && wantedLittleCount === null}
                onChange={() => { setWillingToTakeTwins(true); setWantedLittleCount(null); }}
                className="accent-[color:var(--ss-jade-deep)] w-4 h-4" />
              I’m WILLING to take twins if needed
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="littlePreference" checked={!willingToTakeTwins && wantedLittleCount === null}
                onChange={() => { setWillingToTakeTwins(false); setWantedLittleCount(null); }}
                className="accent-[color:var(--ss-jade-deep)] w-4 h-4" />
              I’d like 1 Little only
            </label>
            <p className="ss-caption">Wanting records your preference for 2 or 3 Littles. Willing means you’re open to 2 without requesting them. Matches still depend on everyone’s rankings and availability.</p>
          </fieldset>
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

const SubmitRanking = () => {
  const navigate = useNavigate();
  const { membership } = useGroup();
  if (membership?.role === 'admin') {
    return (
      <SceneShell topRightLabel="Dashboard" onTopRight={() => navigate('/dashboard')}>
        <h1 className="font-display text-4xl">Your rankings</h1>
        <ChooseMatchingRole />
      </SceneShell>
    );
  }
  return <RankingEditor key={`${membership?.id}:${membership?.role}:${membership?.group.active_cycle_id}`} />;
};

export default SubmitRanking;
