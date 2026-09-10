import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { LayoutGrid, List, ArrowLeft } from 'lucide-react';
import { useGroup } from '../../contexts/GroupContext';
import { getFullRoster, RosterEntry } from '../../lib/rankings';
import { groupLabel, MembershipRole } from '../../lib/groups';
import LoadingLogo from '../../components/LoadingLogo';

type View = 'card' | 'list';
const VIEW_KEY = 'sorora-roster-view';

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
  const [view, setView] = useState<View>(() => {
    try {
      return (localStorage.getItem(VIEW_KEY) as View) || 'card';
    } catch {
      return 'card';
    }
  });

  const changeView = (v: View) => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      // ignore — per-device preference only, fine to lose
    }
  };

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

  const renderRow = (r: RosterEntry) => {
    const details = [
      r.major && `${r.major}`,
      r.college,
      r.year && `Class of ${r.year}`,
      r.hometown,
    ].filter(Boolean) as string[];

    return (
      <div key={r.userId} className="bg-white rounded-lg shadow-sm px-4 py-3 flex items-center gap-3">
        <div className="w-9 h-9 flex-shrink-0 rounded-full overflow-hidden bg-jade-100 flex items-center justify-center">
          {r.avatarUrl ? (
            <img src={r.avatarUrl} alt={r.name ?? r.email} className="w-full h-full object-cover" />
          ) : (
            <span className="text-sm font-display font-semibold text-jade-700">
              {(r.name || r.email || '?').charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1 flex items-center gap-3">
          <div className="min-w-0 flex-shrink-0 w-48">
            <p className="font-semibold truncate">{r.name || r.email}</p>
            <p className="text-xs text-gray-500 truncate">{r.email}</p>
          </div>
          <p className="text-sm text-gray-600 truncate flex-1 min-w-0">
            {details.length > 0 ? details.join(' · ') : <span className="text-gray-400">No details added yet.</span>}
          </p>
        </div>
        <span className={`flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${roleBadgeClasses[r.role]}`}>
          {roleLabel[r.role]}
          {r.isAdmin && r.role !== 'admin' && ' + Admin'}
        </span>
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
      ) : view === 'card' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{list.map(renderCard)}</div>
      ) : (
        <div className="flex flex-col gap-2">{list.map(renderRow)}</div>
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
        <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-black mb-4">
          <ArrowLeft size={14} /> Back to Dashboard
        </Link>

        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-2xl font-semibold mb-1">Roster</h2>
            <p className="text-gray-500 text-sm">{groupLabel(group)}</p>
          </div>
          <div className="flex-shrink-0 flex items-center gap-1 bg-gray-100 rounded-md p-1">
            <button
              type="button"
              onClick={() => changeView('card')}
              aria-label="Card view"
              aria-pressed={view === 'card'}
              className={`p-1.5 rounded ${view === 'card' ? 'bg-white shadow-sm text-jade-700' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <LayoutGrid size={16} />
            </button>
            <button
              type="button"
              onClick={() => changeView('list')}
              aria-label="List view"
              aria-pressed={view === 'list'}
              className={`p-1.5 rounded ${view === 'list' ? 'bg-white shadow-sm text-jade-700' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <List size={16} />
            </button>
          </div>
        </div>

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
