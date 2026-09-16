import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useGroup } from '../../contexts/GroupContext';
import { getPairings, PairingRow } from '../../lib/rankings';
import { getGroupCycles, Cycle } from '../../lib/groups';
import LoadingLogo from '../../components/LoadingLogo';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

const Pairings = () => {
  const { membership } = useGroup();
  const group = membership?.group;

  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
  const [pairings, setPairings] = useState<PairingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  const load = useCallback(async () => {
    if (!selectedCycleId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { pairings: p, error: loadError } = await getPairings(selectedCycleId);
    if (loadError) setError(loadError);
    setPairings(p);
    setLoading(false);
  }, [selectedCycleId]);

  useEffect(() => {
    load();
  }, [load]);

  const byBig = new Map<string, { bigName: string | null; littles: string[] }>();
  for (const p of pairings) {
    if (!byBig.has(p.bigId)) byBig.set(p.bigId, { bigName: p.bigName, littles: [] });
    byBig.get(p.bigId)!.littles.push(p.littleName || 'Unknown');
  }

  if (!group) return null;

  return (
    <div className="min-h-screen w-full flex flex-col items-center px-5 md:px-8 py-8">
      <section className="ss-frost w-full max-w-3xl rounded-[28px] bg-white/25 shadow-[0_20px_60px_-40px_rgba(15,45,32,0.35)] px-6 md:px-12 pt-8 pb-10 md:pt-10 md:pb-14 flex flex-col">
        <header className="flex items-center justify-between mb-8">
          <Link to="/" className="font-display italic text-2xl font-medium text-[color:var(--ss-ink-1)]">
            sorora
          </Link>
          <Link
            to="/dashboard"
            className="text-sm text-[color:var(--ss-ink-4)] hover:text-[color:var(--ss-ink-1)] underline underline-offset-4"
          >
            Back to dashboard
          </Link>
        </header>

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
              onChange={e => setSelectedCycleId(e.target.value)}
              className="flex-shrink-0 text-sm bg-white/60 border border-[color:var(--ss-input-border)] rounded-pill px-4 py-2 text-[color:var(--ss-ink-3)] focus:outline-none focus:border-[color:var(--ss-jade)]"
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

        {error && <p className="mt-4 text-[color:var(--ss-error)] text-sm">{error}</p>}

        <div className="mt-8">
          {loading ? (
            <div className="flex items-center gap-2 text-[color:var(--ss-ink-5)]">
              <LoadingLogo size={20} /> Loading…
            </div>
          ) : byBig.size === 0 ? (
            <div className="ss-surface">
              <h3 className="font-display text-[22px] font-medium text-[color:var(--ss-ink-1)]">
                No pairings yet.
              </h3>
              <p className="ss-caption mt-2">Run matching from the Status page to generate this cycle's pairings.</p>
            </div>
          ) : (
            <div className="ss-surface">
              <div className="flex flex-col divide-y divide-[color:var(--ss-surface-border)]">
                {Array.from(byBig.values()).map(({ bigName, littles }) => (
                  <div key={bigName} className="flex justify-between items-center gap-4 py-3">
                    <span className="font-medium text-[color:var(--ss-ink-2)] truncate">{bigName}</span>
                    <span className="text-[color:var(--ss-ink-4)] text-right truncate">{littles.join(', ')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default Pairings;
