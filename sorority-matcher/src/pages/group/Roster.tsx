import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useGroup } from '../../contexts/GroupContext';
import { getFullRoster, RosterEntry } from '../../lib/rankings';
import { groupLabel, MembershipRole } from '../../lib/groups';
import LoadingLogo from '../../components/LoadingLogo';

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

  const renderCard = (r: RosterEntry) => {
    const details = [
      r.major && `${r.major}`,
      r.college,
      r.year && `Class of ${r.year}`,
      r.hometown,
    ].filter(Boolean) as string[];

    return (
      <div key={r.userId} className="bg-white rounded-lg shadow-sm p-5 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 flex-shrink-0 rounded-full overflow-hidden bg-jade-100 flex items-center justify-center">
            {r.avatarUrl ? (
              <img src={r.avatarUrl} alt={r.name ?? r.email} className="w-full h-full object-cover" />
            ) : (
              <span className="text-lg font-display font-semibold text-jade-700">
                {(r.name || r.email || '?').charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold truncate">{r.name || r.email}</p>
            <p className="text-xs text-gray-500 truncate">{r.email}</p>
          </div>
          <span className={`flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${roleBadgeClasses[r.role]}`}>
            {roleLabel[r.role]}
            {r.isAdmin && r.role !== 'admin' && ' + Admin'}
          </span>
        </div>

        {details.length > 0 ? (
          <p className="text-sm text-gray-600">{details.join(' · ')}</p>
        ) : (
          <p className="text-sm text-gray-400">No details added yet.</p>
        )}
      </div>
    );
  };

  const renderSection = (label: string, list: RosterEntry[]) => (
    <div>
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
        {label} ({list.length})
      </h3>
      {list.length === 0 ? (
        <p className="text-gray-400 text-sm">No one here yet.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{list.map(renderCard)}</div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col items-center p-8">
      <header className="mb-8">
        <Link to="/">
          <h1 className="text-4xl font-display font-semibold text-center text-jade-800">Sorora</h1>
        </Link>
      </header>

      <div className="max-w-4xl w-full">
        <h2 className="text-2xl font-semibold mb-1">Roster</h2>
        <p className="text-gray-500 text-sm mb-6">{groupLabel(group)}</p>

        {error && <p className="text-brick text-sm mb-4">{error}</p>}

        {loading ? (
          <div className="flex items-center gap-2 text-gray-500"><LoadingLogo size={20} /> Loading...</div>
        ) : (
          <div className="flex flex-col gap-8">
            {renderSection('Bigs', bigs)}
            {renderSection('Littles', littles)}
            {renderSection('Admins', admins)}
          </div>
        )}
      </div>
    </div>
  );
};

export default Roster;
