import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useGroup } from '../../contexts/GroupContext';
import { getPairings, PairingRow } from '../../lib/rankings';

const Pairings = () => {
  const { membership } = useGroup();
  const group = membership?.group;

  const [pairings, setPairings] = useState<PairingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!group) return;
    setLoading(true);
    const { pairings: p, error: loadError } = await getPairings(group.id);
    if (loadError) setError(loadError);
    setPairings(p);
    setLoading(false);
  }, [group]);

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
          <h1 className="text-4xl font-bold text-center">Sorora</h1>
        </Link>
      </header>

      <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8">
        <h2 className="text-2xl font-semibold mb-6">Pairings</h2>

        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : byBig.size === 0 ? (
          <p className="text-gray-500">No pairings yet — run matching from the Status page.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {Array.from(byBig.values()).map(({ bigName, littles }) => (
              <div key={bigName} className="flex justify-between px-4 py-3 border-2 border-gray-200 rounded-md">
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
