import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useGroup } from '../../contexts/GroupContext';
import { getFullRoster, RosterEntry } from '../../lib/rankings';
import { groupLabel, MembershipRole } from '../../lib/groups';

const roleLabel: Record<MembershipRole, string> = { admin: 'Admin', big: 'Big', little: 'Little' };
const roleBadgeClasses: Record<MembershipRole, string> = {
  admin: 'bg-jade-100 text-jade-700',
  big: 'bg-gold-100 text-gold-700',
  little: 'bg-gray-100 text-gray-600',
};

const Roster = () => {
  const { membership } = useGroup();
  const group = membership?.group;

  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!group) return;
    setLoading(true);
    const { roster: r, error: loadError } = await getFullRoster(group.id);
    if (loadError) setError(loadError);
    setRoster(r);
    setLoading(false);
  }, [group]);

  useEffect(() => {
    load();
  }, [load]);

  if (!group) return null;

  const admins = roster.filter(r => r.role === 'admin');
  const bigs = roster.filter(r => r.role === 'big');
  const littles = roster.filter(r => r.role === 'little');

  const renderList = (label: string, list: RosterEntry[]) => (
    <div>
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
        {label} ({list.length})
      </h3>
      <div className="flex flex-col gap-1">
        {list.map(r => (
          <div key={r.userId} className="flex items-center justify-between px-3 py-2 border-2 border-gray-100 rounded-md">
            <span>{r.name || r.email}</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${roleBadgeClasses[r.role]}`}>
              {roleLabel[r.role]}
            </span>
          </div>
        ))}
        {list.length === 0 && <p className="text-gray-400 text-sm">No one here yet.</p>}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col items-center p-8">
      <header className="mb-8">
        <Link to="/">
          <h1 className="text-4xl font-display font-semibold text-center text-jade-800">Sorora</h1>
        </Link>
      </header>

      <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8">
        <h2 className="text-2xl font-semibold mb-1">Roster</h2>
        <p className="text-gray-500 text-sm mb-6">{groupLabel(group)}</p>

        {error && <p className="text-brick text-sm mb-4">{error}</p>}

        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : (
          <div className="flex flex-col gap-6">
            {renderList('Bigs', bigs)}
            {renderList('Littles', littles)}
            {renderList('Admins', admins)}
          </div>
        )}
      </div>
    </div>
  );
};

export default Roster;
