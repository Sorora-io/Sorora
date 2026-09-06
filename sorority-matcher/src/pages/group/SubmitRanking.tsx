import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useGroup } from '../../contexts/GroupContext';
import { setMyTwinWillingness, groupLabel } from '../../lib/groups';
import { getRoster, getMyRanking, submitRanking, RosterMember } from '../../lib/rankings';

const SubmitRanking = () => {
  const { membership, refresh } = useGroup();
  const group = membership?.group;
  const role = membership?.role;
  const oppositeRole = role === 'big' ? 'little' : 'big';
  const oppositeLabel = oppositeRole === 'big' ? 'Bigs' : 'Littles';
  const minRequired = role === 'big' ? group?.min_big_rankings ?? 1 : group?.min_little_rankings ?? 1;

  const [roster, setRoster] = useState<RosterMember[]>([]);
  const [rankedIds, setRankedIds] = useState<string[]>([]);
  const [willingToTakeTwins, setWillingToTakeTwins] = useState(membership?.willing_to_take_twins ?? false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    if (!group || !oppositeRole) return;
    setLoading(true);
    const [{ roster: r, error: rosterError }, { rankedIds: existing, error: rankError }] = await Promise.all([
      getRoster(group.id, oppositeRole),
      getMyRanking(group.id),
    ]);
    if (rosterError) setError(rosterError);
    else if (rankError) setError(rankError);
    setRoster(r);
    // Drop any previously-ranked ids that are no longer on the roster.
    const rosterIds = new Set(r.map(m => m.userId));
    setRankedIds(existing.filter(id => rosterIds.has(id)));
    setLoading(false);
  }, [group, oppositeRole]);

  useEffect(() => {
    load();
  }, [load]);

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
    if (!group) return;
    if (rankedIds.length < minRequired) {
      setError(`Please rank at least ${minRequired} ${minRequired === 1 ? oppositeLabel.slice(0, -1) : oppositeLabel}.`);
      return;
    }
    setSaving(true);
    setError('');
    setSaved(false);

    const tasks: Promise<{ error: string | null }>[] = [submitRanking(group.id, rankedIds)];
    if (role === 'big') tasks.push(setMyTwinWillingness(group.id, willingToTakeTwins));

    const results = await Promise.all(tasks);
    const failed = results.find(r => r.error);
    if (failed) {
      setError(failed.error!);
    } else {
      setSaved(true);
      await refresh();
    }
    setSaving(false);
  };

  if (!group || !role) return null;

  return (
    <div className="min-h-screen flex flex-col items-center p-8">
      <header className="mb-8">
        <Link to="/">
          <h1 className="text-4xl font-bold text-center">Sorora</h1>
        </Link>
      </header>

      <div className="max-w-3xl w-full bg-white rounded-lg shadow-lg p-8">
        <h2 className="text-2xl font-semibold mb-1">Rank your {oppositeLabel}</h2>
        <p className="text-gray-500 text-sm mb-6">
          {groupLabel(group)} · rank at least {minRequired}, most preferred first
        </p>

        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : (
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Available</h3>
              <div className="flex flex-col gap-2 min-h-[100px]">
                {available.length === 0 && (
                  <p className="text-gray-400 text-sm">Everyone's been ranked.</p>
                )}
                {available.map(m => (
                  <button
                    key={m.userId}
                    onClick={() => addToRanking(m.userId)}
                    className="text-left px-3 py-2 border-2 border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    {m.name || m.email}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Your ranking ({rankedIds.length})
              </h3>
              <div className="flex flex-col gap-2 min-h-[100px]">
                {rankedIds.length === 0 && (
                  <p className="text-gray-400 text-sm">Click a name on the left to add them.</p>
                )}
                {rankedIds.map((id, idx) => (
                  <div
                    key={id}
                    className="flex items-center justify-between px-3 py-2 border-2 border-gray-200 rounded-md bg-gray-50"
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
                      <button onClick={() => removeFromRanking(id)} className="px-2 text-red-600">
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
            />
            I'm willing to take two Littles (twins)
          </label>
        )}

        {error && <p className="text-red-600 text-sm mt-4">{error}</p>}
        {saved && <p className="text-green-700 text-sm mt-4">Ranking saved.</p>}

        <button
          onClick={handleSave}
          disabled={saving || loading}
          className="w-full mt-6 py-3 bg-black text-white rounded-md hover:bg-gray-800 transition-colors disabled:opacity-50"
        >
          {saving ? '...' : 'Save Ranking'}
        </button>
      </div>
    </div>
  );
};

export default SubmitRanking;
