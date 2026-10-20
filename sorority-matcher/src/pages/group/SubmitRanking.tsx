import { trackEvent } from '../../lib/analytics';
import { useCycleParticipation } from '../../lib/cycleParticipation';
import { rankingDeadlinePassed, useRankingDeadline, groupRankingDeadline, formatRankingDeadline } from '../../lib/rankingDeadline';
import PageHeader from '../../components/PageHeader';
import { invalidateChapter } from '../../lib/cache';
import { useAuth } from '../../contexts/AuthContext';
import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowUp, ArrowDown, X } from 'lucide-react';
import { useGroup } from '../../contexts/GroupContext';
import { setMyLittlePreference } from '../../lib/groups';
import { getRoster, getMyRanking, submitRanking } from '../../lib/rankings';
import { queryKeys, STALE } from '../../lib/queryKeys';
import LoadingLogo from '../../components/LoadingLogo';
import Button from '../../components/Button';
import Avatar from '../../components/Avatar';
import SceneShell from '../../components/SceneShell';
import ChooseMatchingRole from '../../components/ChooseMatchingRole';

const RankingEditor = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { membership, refresh } = useGroup();
  const group = membership?.group;
  const role = membership?.role;
  const oppositeRole = role === 'big' ? 'little' : 'big';
  const oppositeLabel = oppositeRole === 'big' ? 'Bigs' : 'Littles';
  const minRequired = role === 'big' ? group?.min_big_rankings ?? 1 : group?.min_little_rankings ?? 1;
  const deadlineClosed = useRankingDeadline(groupRankingDeadline(group));
  const cycleId = group?.active_cycle_id ?? null;
  const queryClient = useQueryClient();
  const participation = useCycleParticipation(user?.id ?? "", group?.id, cycleId);
  const excluded = participation.data?.excludedIds.includes(user?.id ?? "") ?? false;

  const { data: roster = [], isLoading: rosterLoading, isSuccess: rosterReady, error: rosterError, refetch: retryRoster } = useQuery({
    queryKey: queryKeys.groupRoster(user?.id ?? '', group?.id ?? '', oppositeRole),
    queryFn: () => getRoster(group!.id, oppositeRole).then(({ roster: r, error }) => { if (error) throw new Error(error); return r; }),
    enabled: !!group,
    staleTime: STALE.medium,
  });
  // Shares its cache key with Dashboard's OrgCard — whichever page the
  // member visited first already has this warm.
  const { data: existingRankedIds, isLoading: rankingLoading, isSuccess: rankingReady, error: rankingError, refetch: retryRanking } = useQuery({
    queryKey: queryKeys.myRanking(user?.id ?? '', cycleId ?? ''),
    queryFn: () => getMyRanking(cycleId).then(({ rankedIds: ids, error }) => { if (error) throw new Error(error); return ids; }),
    enabled: !!cycleId,
  });

  const [rankedIds, setRankedIds] = useState<string[]>([]);
  const [littleCapacity, setLittleCapacity] = useState<1 | 2 | 3>(
    membership?.wanted_little_count ?? (membership?.willing_to_take_twins ? 2 : 1)
  );
  const maximum = group?.max_littles_per_big ?? 3;
  const effectiveCapacity = Math.min(littleCapacity, maximum) as 1 | 2 | 3;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  // Seed the editable draft from cached/fetched data exactly once — after
  // that, this is the user's own in-progress edit, and a background
  // refetch of the same query must not silently overwrite it.
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    if (seeded || !existingRankedIds || !rosterReady || !rankingReady) return;
    const rosterIds = new Set(roster.map(m => m.userId));
    setRankedIds(existingRankedIds.filter(id => rosterIds.has(id)));
    setSeeded(true);
  }, [existingRankedIds, roster, rosterReady, rankingReady, seeded]);

  const loading = (rosterLoading || rankingLoading) && !seeded;

  const loadError = rosterError || rankingError || participation.error;
  const canSave = seeded && rosterReady && rankingReady && !loadError && !deadlineClosed && participation.isSuccess && !excluded;

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
    if (!group || !cycleId || !canSave || saving) return;
    if (rankedIds.length < minRequired) {
      setError(`Please rank at least ${minRequired} ${minRequired === 1 ? oppositeLabel.slice(0, -1) : oppositeLabel}.`);
      return;
    }
    if (rankingDeadlinePassed(groupRankingDeadline(group))) {
      setError('The ranking deadline has passed. Rankings are closed.');
      return;
    }
    setSaving(true);
    setError('');
    setSaved(false);

    try {
      const tasks: Promise<{ error: string | null }>[] = [submitRanking(group.id, cycleId, rankedIds)];
      if (role === 'big') tasks.push(setMyLittlePreference(group.id, false, effectiveCapacity === 1 ? null : effectiveCapacity));

      const results = await Promise.all(tasks);
      const failed = results.find(r => r.error);
      if (failed) {
        setError(failed.error!);
      } else {
        // Other pages (Dashboard's OrgCard) cache this same query — without
        // invalidating it here, they'd keep showing "not submitted" until
        // their own cache happens to go stale on its own.
        trackEvent('ranking_submitted');
        queryClient.setQueryData(queryKeys.myRanking(user!.id, cycleId), [...rankedIds]);
        await invalidateChapter(queryClient, user!.id, group.id, cycleId);
        await refresh();
        setSaved(true);
      }
    } catch {
      setSaved(false);
      setError('Could not confirm all ranking changes were saved. Your choices are still here. Check your connection and save again.');
    } finally {
      setSaving(false);
    }
  };

  if (!group || !role) return null;

  return (
    <div className="ss-ranking-page min-h-screen w-full flex flex-col items-center px-5 md:px-8 py-8">
      <section className="ss-ranking-sheet ss-frost w-full max-w-4xl rounded-[28px] shadow-[0_20px_60px_-40px_rgba(15,45,32,0.35)] px-6 md:px-12 pt-8 pb-10 md:pt-10 md:pb-14 flex flex-col">
        <PageHeader className="flex items-center justify-between mb-8">
          <Link to="/" className="font-display italic text-2xl font-medium text-[color:var(--ss-ink-1)]">
            sorora
          </Link>
          <Button variant="quiet" size="sm" onClick={() => navigate('/dashboard')}>
            <ArrowLeft size={14} aria-hidden="true" /> Back to dashboard
          </Button>
        </PageHeader>

        <h1 className="font-display text-[34px] md:text-[46px] leading-[1.1] font-medium text-[color:var(--ss-ink-1)]">
          Rank your {oppositeLabel.toLowerCase()}.
        </h1>
        <p className="mt-2 ss-caption">
          {group.school || group.name} · rank at least <strong className="text-[color:var(--ss-ink-2)] font-bold">{minRequired}</strong>, most preferred first
        </p>

        <p className="mt-3 ss-caption">{(group.blind_rankings ?? true) ? 'Your ranking order is hidden from chapter admins.' : 'Chapter admins can view your ranking order.'}</p>

        {groupRankingDeadline(group) && <p className="mt-3 ss-caption">Deadline: {formatRankingDeadline(group)}</p>}
        {deadlineClosed && <p role="status" className="mt-3 ss-caption">The ranking deadline has passed. You can view your saved ranking, but submissions are closed.</p>}

        {excluded ? <p role="status" className="mt-8 ss-caption">You’re not participating in this cycle. Your chapter membership and saved rankings are unchanged. Contact your chapter admin with questions.</p> : !cycleId ? (
          <p className="mt-8 ss-caption">
            No active cycle yet — check back once your chapter admin starts one.
          </p>
        ) : loadError ? (
          <div role="alert" className="mt-8 ss-surface">
            <p>We couldn’t load your ranking or chapter roster. Your saved ranking has not been changed.</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => { void retryRoster(); void retryRanking(); void participation.refetch(); }}>Try again</Button>
          </div>
        ) : loading || !seeded ? (
          <div className="mt-8 flex items-center gap-2 text-[color:var(--ss-ink-5)]">
            <LoadingLogo size={20} /> Loading…
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="ss-surface ss-ranking-panel">
              <div className="ss-kicker" style={{ marginBottom: 8 }}>Available</div>
              <div className="flex flex-col gap-2 min-h-[120px]">
                {available.length === 0 && (
                  <p className="ss-caption">Everyone's been ranked.</p>
                )}
                {available.map(m => (
                  <Button variant="quiet" size="sm" disabled={deadlineClosed || saving}
                    key={m.userId}
                    onClick={() => addToRanking(m.userId)}
                    className="flex items-center gap-3 text-left px-3 py-2 bg-white/60 border border-[color:var(--ss-input-border)] rounded-lg hover:bg-[color:var(--ss-button-quiet-hover)] transition-colors text-[color:var(--ss-ink-2)]"
                  >
                    <Avatar src={m.avatarUrl} name={m.name} email={m.email} size="sm" />
                    <span>{m.name || m.email}</span>
                  </Button>
                ))}
              </div>
            </div>

            <div className="ss-surface ss-ranking-panel">
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
                    className="ss-ranked-row flex items-center justify-between gap-2 px-3 py-2 border rounded-lg"
                  >
                    <span className="flex flex-1 min-w-0 items-center gap-2 text-[color:var(--ss-ink-2)]">
                      <span className="ss-ranking-number" data-first={idx === 0 || undefined}
                        style={{ backgroundColor: idx === 0 ? 'var(--ss-jade-deep)' : `hsl(140, 22%, ${68 + 24 * (idx - 1) / Math.max(1, rankedIds.length - 2)}%)` }}>
                        {idx + 1}
                      </span>
                      <Avatar src={rosterById.get(id)?.avatarUrl} name={rosterById.get(id)?.name} email={rosterById.get(id)?.email} size="sm" />
                      <span className="ss-ranked-name">{rosterById.get(id)?.name || rosterById.get(id)?.email || 'Unknown'}</span>
                    </span>
                    <span className="ss-ranking-controls flex shrink-0 gap-1">
                      <Button variant="ghost" size="sm"
                        onClick={() => moveUp(idx)}
                        aria-label={`Move ${rosterById.get(id)?.name || rosterById.get(id)?.email || "member"} up`}
                        disabled={deadlineClosed || saving || idx === 0}
                        className="ss-ranking-reorder !px-2 min-w-[36px] disabled:opacity-30"
                      >
                        <ArrowUp size={18} strokeWidth={3} aria-hidden="true" />
                      </Button>
                      <Button variant="ghost" size="sm"
                        onClick={() => moveDown(idx)}
                        aria-label={`Move ${rosterById.get(id)?.name || rosterById.get(id)?.email || "member"} down`}
                        disabled={deadlineClosed || saving || idx === rankedIds.length - 1}
                        className="ss-ranking-reorder !px-2 min-w-[36px] disabled:opacity-30"
                      >
                        <ArrowDown size={18} strokeWidth={3} aria-hidden="true" />
                      </Button>
                      <Button variant="ghost" size="sm"
                        onClick={() => removeFromRanking(id)}
                        aria-label={`Remove ${rosterById.get(id)?.name || rosterById.get(id)?.email || "member"} from ranking`}
                        disabled={deadlineClosed || saving}
                        className="ss-ranking-remove !px-2 min-w-[36px]"
                      >
                        <X size={18} strokeWidth={3} aria-hidden="true" />
                      </Button>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {role === 'big' && (
          <fieldset className="mt-6 space-y-3 text-sm text-[color:var(--ss-ink-3)]" disabled={saving || deadlineClosed}>
            <legend className="font-medium mb-2">How many Littles are you open to taking?</legend>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {([1, 2, 3] as const).filter(count => count <= maximum).map(count => (
                <label key={count} className={`relative cursor-pointer rounded-2xl border px-4 py-3 transition-colors ${effectiveCapacity === count ? 'border-[color:var(--ss-selection-border)] bg-[color:var(--ss-selection-bg)] text-[color:var(--ss-selection-text)]' : 'border-[color:var(--ss-input-border)] bg-white/60 hover:bg-[color:var(--ss-button-quiet-hover)]'}`}>
                  <input type="radio" name="littleCapacity" value={count}
                    checked={effectiveCapacity === count} onChange={() => setLittleCapacity(count)}
                    className="peer sr-only" />
                  <span className="absolute inset-0 rounded-2xl peer-focus-visible:ring-2 peer-focus-visible:ring-[color:var(--ss-jade-deep)] peer-focus-visible:ring-offset-2" />
                  <span className="block font-medium">{count === 1 ? '1 Little' : `Up to ${count} Littles`}</span>
                </label>
              ))}
            </div>
            <p className="ss-caption">Your organization allows up to {maximum} {maximum === 1 ? 'Little' : 'Littles'} per Big. Your final number depends on rankings and availability.</p>
          </fieldset>
        )}

        {error && <p className="text-[color:var(--ss-error)] text-sm mt-4">{error}</p>}
        {saved && <p className="text-[color:var(--ss-jade)] text-sm mt-4">Ranking saved.</p>}

        <div className="mt-8">
          <Button size="lg" fullWidth onClick={handleSave} disabled={saving || !canSave || !cycleId}>
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
      <SceneShell topRightAction={<Button variant="quiet" size="sm" onClick={() => navigate('/dashboard')}><ArrowLeft size={14} aria-hidden="true" /> Back to dashboard</Button>}>
        <h1 className="font-display text-4xl">Your rankings</h1>
        <ChooseMatchingRole />
      </SceneShell>
    );
  }
  return <RankingEditor key={`${membership?.id}:${membership?.role}:${membership?.group.active_cycle_id}`} />;
};

export default SubmitRanking;
