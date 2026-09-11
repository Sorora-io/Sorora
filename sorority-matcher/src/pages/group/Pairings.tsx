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
    <div className="min-h-screen flex flex-col items-center p-8">
      <header className="mb-8">
        <Link to="/">
          <h1 className="text-4xl font-display font-semibold text-center text-jade-800">Sorora</h1>
        </Link>
      </header>

      <div className="max-w-2xl w-full bg-white rounded-lg shadow-sm p-5">
        <div className="flex items-start justify-between gap-4 mb-6">
          <h2 className="text-2xl font-semibold">Pairings</h2>
          {cycles.length > 1 && (
            <select
              value={selectedCycleId ?? ''}
              onChange={e => setSelectedCycleId(e.target.value)}
              className="flex-shrink-0 text-sm border border-jade-300 rounded-md px-2 py-1.5 focus:border-jade-500 focus:outline-none focus:ring-2 focus:ring-jade-100"
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

        {cycles.length > 0 && selectedCycleId && (
          <p className="text-xs text-gray-400 -mt-4 mb-6">
            {cycles.find(c => c.id === selectedCycleId)?.ended_at
              ? `Ended ${formatDate(cycles.find(c => c.id === selectedCycleId)!.ended_at!)}`
              : 'Currently active'}
          </p>
        )}

        {error && <p className="text-brick text-sm mb-4">{error}</p>}

        {loading ? (
          <div className="flex items-center gap-2 text-gray-500"><LoadingLogo size={20} /> Loading...</div>
        ) : byBig.size === 0 ? (
          <p className="text-gray-500">No pairings yet — run matching from the Status page.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {Array.from(byBig.values()).map(({ bigName, littles }) => (
              <div key={bigName} className="flex justify-between px-4 py-2.5 border border-gray-200 rounded-md">
                <span className="font-medium">{bigName}</span>
                <span className="text-gray-600">{littles.join(', ')}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Pairings;
