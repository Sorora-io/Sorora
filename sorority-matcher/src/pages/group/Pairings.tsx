import PairingGroups from '../../components/PairingGroups';
import { downloadPairingExport } from '../../lib/pairingExport';
import ClearPairings from '../../components/ClearPairings';
import MatchingReview from '../../components/MatchingReview';
import { groupRankingDeadline } from '../../lib/rankingDeadline';
import UnrankedMemberReview from '../../components/UnrankedMemberReview';
import { ArrowLeft } from 'lucide-react';
import PairingChanges from '../../components/PairingChanges';
import { revealDeliveryWarning } from '../../lib/revealStatus';
import PageHeader from '../../components/PageHeader';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useGroup } from '../../contexts/GroupContext';
import { getPairings, PairingRow } from '../../lib/rankings';
import { getPairingRevealStatus, RevealStatus } from '../../lib/pairings';
import MatchingNextSteps from '../../components/MatchingNextSteps';
import { getGroupCycles, Cycle } from '../../lib/groups';
import LoadingLogo from '../../components/LoadingLogo';
import Button from '../../components/Button';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

const Pairings = () => {
  const navigate = useNavigate();
  const { membership } = useGroup();
  const group = membership?.group;

  const loadVersion = useRef(0);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
  const [pairings, setPairings] = useState<PairingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');

  const [reveal, setReveal] = useState<RevealStatus | null>(null);
  const [revealError, setRevealError] = useState('');
  // Every past cycle for this group, so admins/members can look back at
  // who matched with whom in a prior year, not just the current one.
  useEffect(() => {
    if (!group) return;
    getGroupCycles(group.id).then(({ cycles: c, error: cyclesError }) => {
      if (cyclesError) setError(cyclesError);
      setCycles(c);
      setSelectedCycleId(prev => prev ?? group.active_cycle_id ?? c[0]?.id ?? null);
    });
  }, [group]);

  const load = useCallback(async (showLoading = true) => {
    const version = ++loadVersion.current;
    if (!selectedCycleId) {
      setLoading(false);
      return;
    }
    if (showLoading) setLoading(true);
    setError('');
    try {
      const { pairings: p, error: loadError } = await getPairings(selectedCycleId);
      if (version !== loadVersion.current) return;
      if (loadError) { setError(loadError); setPairings([]); }
      else setPairings(p);
    } catch {
      if (version === loadVersion.current) { setError('Could not load pairings. Please try again.'); setPairings([]); }
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }, [selectedCycleId]);

  const invalidateLoad = useCallback(() => { loadVersion.current++; }, []);
  useEffect(() => {
    void load();
    return invalidateLoad;
  }, [load, invalidateLoad]);

  const loadReveal = useCallback(async (_updateSchedule = true) => {
    if (!group || !selectedCycleId) return;
    const { status, error: statusError } = await getPairingRevealStatus(group.id, selectedCycleId);
    if (statusError) { setRevealError('Could not refresh delivery status. Please try again.'); return; }
    setReveal(status);
  }, [group, selectedCycleId]);

  useEffect(() => {
    setRevealError('');
    loadReveal();
  }, [loadReveal]);

  useEffect(() => {
    if (!reveal?.scheduledAt) return;
    const timer = window.setInterval(() => { void loadReveal(false); }, 30_000);
    return () => window.clearInterval(timer);
  }, [reveal?.scheduledAt, loadReveal]);

  const deliveryWarning = revealDeliveryWarning(reveal);
  const handleExport = async () => {
    if (!group || !selectedCycleId || exporting) return;
    setExporting(true);
    setExportError('');
    try {
      await downloadPairingExport(cycles.find(c => c.id === selectedCycleId)?.label || 'Selected cycle', selectedCycleId, group.blind_rankings === false ? group.id : undefined, group.id);
    } catch (failure) {
      setExportError(failure instanceof Error ? failure.message : 'Could not export pairings. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  if (!group) return null;

  const hasPairings = pairings.length > 0;

  return (
    <div className="min-h-screen w-full flex flex-col items-center px-5 md:px-8 py-8">
      <section className="ss-frost w-full max-w-3xl rounded-panel bg-white/25 shadow-[0_20px_60px_-40px_rgba(15,45,32,0.35)] px-6 md:px-12 pt-8 pb-10 md:pt-10 md:pb-14 flex flex-col">
        <PageHeader className="flex items-center justify-between mb-8">
          <Link to="/" className="font-display italic text-2xl font-medium text-[color:var(--ss-ink-1)]">
            sorora
          </Link>
          <Button variant="quiet" size="sm" onClick={() => navigate('/dashboard')}><ArrowLeft size={14} aria-hidden="true" /> Back to dashboard</Button>
        </PageHeader>

        <span className="ss-kicker">03 · After collection</span>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-[34px] md:text-[46px] leading-[1.1] font-medium text-[color:var(--ss-ink-1)]">
              Pairings
            </h1>
            {cycles.length > 0 && selectedCycleId && (
              <p className="mt-2 ss-caption">
                {cycles.find(c => c.id === selectedCycleId)?.ended_at
                  ? `Ended ${formatDate(cycles.find(c => c.id === selectedCycleId)!.ended_at!)}`
                  : 'Currently active'}
              </p>
            )}
          </div>
          {cycles.length > 1 && (
            <select
              value={selectedCycleId ?? ''}
              aria-label="Pairing cycle"
              disabled={exporting}
              onChange={e => { setSelectedCycleId(e.target.value); setExportError(''); }}
              className="flex-shrink-0 text-sm bg-white/60 border border-[color:var(--ss-input-border)] rounded-control px-4 py-2 text-[color:var(--ss-ink-3)] focus:outline-none focus:border-[color:var(--ss-jade)]"
            >
              {cycles.map(c => (
                <option key={c.id} value={c.id}>
                  {c.label}
                  {c.id === group.active_cycle_id ? ' (active)' : ''}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="mt-5">
          <Button variant="outline" size="sm" disabled={exporting || loading || !selectedCycleId || !hasPairings} onClick={handleExport}>
            {exporting ? 'Exporting…' : 'Export pairings CSV'}
          </Button>
          <p className="ss-caption mt-2">Downloads this cycle’s saved pairs with Confirmed first, then Needs review. Rank positions are included when visible.</p>
          {exportError && <p role="alert" className="mt-2 text-sm text-brick">{exportError}</p>}
        </div>

        {error && <div role="alert" className="mt-4 text-[color:var(--ss-error)] text-sm"><p>{error}</p><Button variant="outline" size="sm" className="mt-2" onClick={() => void load()}>Retry pairings</Button></div>}

        {!loading && !error && hasPairings && <MatchingNextSteps key={selectedCycleId} />}
        {!loading && selectedCycleId && <MatchingReview groupId={group.id} cycleId={selectedCycleId} />}

        <div data-tour="pairing-results" className="mt-8">
          {loading ? (
            <div className="flex items-center gap-2 text-[color:var(--ss-ink-5)]">
              <LoadingLogo size={20} /> Loading…
            </div>
          ) : error ? null : !hasPairings ? (
            <div className="ss-surface">
              <h3 className="font-display text-[22px] font-medium text-[color:var(--ss-ink-1)]">
                No pairings yet.
              </h3>
              <p className="ss-caption mt-2">Run matching from the Status page to generate this cycle's pairings.</p>
            </div>
          ) : (
            <PairingGroups key={`${group.id}:${selectedCycleId}:${group.blind_rankings}`} groupId={group.id} cycleId={selectedCycleId!} blind={group.blind_rankings ?? true} pairings={pairings} onRefresh={() => load(false)} />
          )}
        </div>

        {selectedCycleId && <UnrankedMemberReview groupId={group.id} cycleId={selectedCycleId} deadline={groupRankingDeadline(group)} blind={group.blind_rankings ?? true} />}

        {selectedCycleId && <ClearPairings key={`clear:${group.id}:${selectedCycleId}`} groupId={group.id} cycleId={selectedCycleId} onCleared={async () => { await Promise.all([load(), loadReveal(false)]); }} />}

        {selectedCycleId && <PairingChanges key={`${group.id}:${selectedCycleId}`} groupId={group.id} cycleId={selectedCycleId} onSaved={async () => { await Promise.all([load(), loadReveal(false)]); }} />}

        {deliveryWarning && (
          <div role="alert" className="mt-6 ss-surface border border-brick text-sm">
            <h2 className="font-semibold">Reveal delivery needs attention</h2>
            <p className="mt-2">{deliveryWarning}</p>
            {reveal && reveal.total > reveal.sent && <p className="mt-2">{reveal.total - reveal.sent} of {reveal.total} pairings have not been confirmed as emailed.</p>}
            <Button variant="outline" size="sm" className="mt-3" onClick={() => void loadReveal(false)}>Refresh delivery status</Button>
          </div>
        )}
        {revealError && <p role="alert" className="mt-4 text-brick">{revealError}</p>}


      </section>
    </div>
  );
};

export default Pairings;
