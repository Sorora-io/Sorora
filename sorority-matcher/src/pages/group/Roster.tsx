import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { LayoutGrid, List, ArrowLeft } from 'lucide-react';
import { useGroup } from '../../contexts/GroupContext';
import { getFullRoster, RosterEntry } from '../../lib/rankings';
import { groupLabel, MembershipRole } from '../../lib/groups';
import { queryKeys } from '../../lib/queryKeys';
import LoadingLogo from '../../components/LoadingLogo';

// Design canvas: roster shows a single sage ss-surface with rows of
// "Avatar · Name · Role pill". This page keeps the existing sort + view
// toggles (useful for large chapters), but drops them into the same
// frosted centered frame the rest of the app uses.
type View = 'card' | 'list';
const VIEW_KEY = 'sorora-roster-view';

type SortMode = 'role' | 'az' | 'za';
const SORT_KEY = 'sorora-roster-sort';

const displayName = (r: RosterEntry) => r.name || r.email;
const initial = (r: RosterEntry) => (r.name || r.email || '?').charAt(0).toUpperCase();

const roleWord: Record<MembershipRole, string> = { admin: 'Admin', big: 'Big', little: 'Little' };

const Roster = () => {
  const { membership } = useGroup();
  const group = membership?.group;

  const [view, setView] = useState<View>(() => {
    try {
      return (localStorage.getItem(VIEW_KEY) as View) || 'list';
    } catch {
      return 'list';
    }
  });

  const changeView = (v: View) => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      // ignore — per-device preference only
    }
  };

  const [sortMode, setSortMode] = useState<SortMode>(() => {
    try {
      return (localStorage.getItem(SORT_KEY) as SortMode) || 'role';
    } catch {
      return 'role';
    }
  });

  const changeSort = (s: SortMode) => {
    setSortMode(s);
    try {
      localStorage.setItem(SORT_KEY, s);
    } catch {
      // ignore
    }
  };

  const {
    data: roster = [] as RosterEntry[],
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey: queryKeys.fullRoster(group?.id ?? ''),
    queryFn: () =>
      getFullRoster(group!.id).then(({ roster: r, error: loadError }) => {
        if (loadError) throw new Error(loadError);
        return r;
      }),
    enabled: !!group,
  });
  const error = queryError ? (queryError as Error).message : '';

  if (!group) return null;

  const admins = roster.filter(r => r.role === 'admin');
  const bigs = roster.filter(r => r.role === 'big');
  const littles = roster.filter(r => r.role === 'little');

  const sortedRoster = [...roster].sort((a, b) =>
    sortMode === 'za'
      ? displayName(b).localeCompare(displayName(a))
      : displayName(a).localeCompare(displayName(b))
  );

  // -------------------------- Row + card renderers -----------------------
  const rolePill = (r: RosterEntry) => (
    <span className="ss-pill flex-shrink-0">
      {roleWord[r.role]}
      {r.isAdmin && r.role !== 'admin' && ' · Admin'}
    </span>
  );

  const avatar = (r: RosterEntry, size: 'sm' | 'md' = 'sm') => (
    <span
      className={`${
        size === 'md' ? 'w-12 h-12 text-lg' : 'w-9 h-9 text-sm'
      } flex-shrink-0 rounded-full overflow-hidden bg-[color:var(--ss-pill-bg)] text-[color:var(--ss-jade)] flex items-center justify-center font-medium`}
    >
      {r.avatarUrl ? (
        <img src={r.avatarUrl} alt={displayName(r)} className="w-full h-full object-cover" />
      ) : (
        initial(r)
      )}
    </span>
  );

  const renderRow = (r: RosterEntry) => {
    const details = [r.major, r.college, r.year && `Class of ${r.year}`, r.hometown]
      .filter(Boolean)
      .join(' · ');
    return (
      <div
        key={r.userId}
        className="flex items-center gap-3 py-3"
      >
        {avatar(r)}
        <div className="min-w-0 flex-1">
          <p className="text-[color:var(--ss-ink-2)] truncate font-medium">{displayName(r)}</p>
          {details ? (
            <p className="text-xs text-[color:var(--ss-ink-5)] truncate">{details}</p>
          ) : (
            <p className="text-xs text-[color:var(--ss-ink-6)] truncate">
              {r.email !== displayName(r) ? r.email : 'No details added yet.'}
            </p>
          )}
        </div>
        {rolePill(r)}
      </div>
    );
  };

  const renderCard = (r: RosterEntry) => {
    const details = [r.major, r.college, r.year && `Class of ${r.year}`, r.hometown]
      .filter(Boolean)
      .join(' · ');
    return (
      <div
        key={r.userId}
        className="bg-white/60 border border-[color:var(--ss-surface-border)] rounded-2xl p-4 flex flex-col gap-3"
      >
        <div className="flex items-center gap-3">
          {avatar(r, 'md')}
          <div className="min-w-0 flex-1">
            <p className="text-[color:var(--ss-ink-2)] font-medium truncate">{displayName(r)}</p>
            <p className="text-xs text-[color:var(--ss-ink-5)] truncate">{r.email}</p>
          </div>
          {rolePill(r)}
        </div>
        <p className="text-sm text-[color:var(--ss-ink-4)]">
          {details || <span className="text-[color:var(--ss-ink-6)]">No details added yet.</span>}
        </p>
      </div>
    );
  };

  const renderSection = (label: string, list: RosterEntry[]) => (
    <div>
      <div className="ss-kicker flex items-center gap-2">
        {label}
        <span className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-md border border-[color:var(--ss-surface-border)] bg-[color:var(--ss-pill-bg)] px-1 text-xs font-semibold tracking-normal tabular-nums">{list.length}</span>
      </div>
      {list.length === 0 ? (
        <p className="ss-caption">No one here yet.</p>
      ) : view === 'card' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{list.map(renderCard)}</div>
      ) : (
        <div className="ss-surface">
          <div className="flex flex-col divide-y divide-[color:var(--ss-surface-border)]">
            {list.map(renderRow)}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen w-full flex flex-col items-center px-5 md:px-8 py-8">
      <section className="ss-frost w-full max-w-4xl rounded-[28px] bg-white/25 shadow-[0_20px_60px_-40px_rgba(15,45,32,0.35)] px-6 md:px-12 pt-8 pb-10 md:pt-10 md:pb-14 flex flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 mb-8">
          <Link to="/" className="font-display italic text-2xl font-medium text-[color:var(--ss-ink-1)]">
            sorora
          </Link>
          <Link
            to="/dashboard"
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-pill border border-[color:var(--ss-jade-line)] px-4 py-2 text-sm text-[color:var(--ss-ink-2)] hover:bg-white/60"
          >
            <ArrowLeft size={14} /> Back to dashboard
          </Link>
        </header>

        <h1 className="font-display text-[34px] md:text-[46px] leading-[1.1] font-medium text-[color:var(--ss-ink-1)]">
          Your chapter roster
        </h1>
        <p className="mt-2 ss-caption">{groupLabel(group)}</p>

        <div className="mt-6 flex items-center justify-end gap-2 flex-wrap">
          <select
            value={sortMode}
            onChange={e => changeSort(e.target.value as SortMode)}
            className="text-sm bg-white/60 border border-[color:var(--ss-input-border)] rounded-pill px-4 py-2 text-[color:var(--ss-ink-3)] focus:outline-none focus:border-[color:var(--ss-jade)]"
          >
            <option value="role">By member type</option>
            <option value="az">Name (A–Z)</option>
            <option value="za">Name (Z–A)</option>
          </select>
          <div className="inline-flex items-center gap-1 bg-white/60 border border-[color:var(--ss-input-border)] rounded-pill p-1">
            <button
              type="button"
              onClick={() => changeView('list')}
              aria-label="List view"
              aria-pressed={view === 'list'}
              className={`p-1.5 rounded-pill transition-colors ${
                view === 'list'
                  ? 'bg-[color:var(--ss-jade-deep)] text-white'
                  : 'text-[color:var(--ss-ink-5)] hover:text-[color:var(--ss-ink-2)]'
              }`}
            >
              <List size={16} />
            </button>
            <button
              type="button"
              onClick={() => changeView('card')}
              aria-label="Card view"
              aria-pressed={view === 'card'}
              className={`p-1.5 rounded-pill transition-colors ${
                view === 'card'
                  ? 'bg-[color:var(--ss-jade-deep)] text-white'
                  : 'text-[color:var(--ss-ink-5)] hover:text-[color:var(--ss-ink-2)]'
              }`}
            >
              <LayoutGrid size={16} />
            </button>
          </div>
        </div>

        {error && (
          <p className="mt-4 text-[color:var(--ss-error)] text-sm">{error}</p>
        )}

        <div className="mt-6">
          {loading ? (
            <div className="flex items-center gap-2 text-[color:var(--ss-ink-5)]">
              <LoadingLogo size={20} /> Loading…
            </div>
          ) : sortMode === 'role' ? (
            <div className="flex flex-col gap-6">
              {renderSection('Bigs', bigs)}
              {renderSection('Littles', littles)}
              {renderSection('Admins', admins)}
            </div>
          ) : sortedRoster.length === 0 ? (
            <p className="ss-caption">No one here yet.</p>
          ) : view === 'card' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {sortedRoster.map(renderCard)}
            </div>
          ) : (
            <div className="ss-surface">
              <div className="flex flex-col divide-y divide-[color:var(--ss-surface-border)]">
                {sortedRoster.map(renderRow)}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default Roster;
