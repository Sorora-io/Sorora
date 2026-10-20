import DuplicateNameWarnings from '../../components/DuplicateNameWarnings';
import CycleParticipationControls from '../../components/CycleParticipationControls';
import Button from '../../components/Button';
import Avatar from '../../components/Avatar';
import PageHeader from '../../components/PageHeader';
import { useAuth } from '../../contexts/AuthContext';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { LayoutGrid, List, ArrowLeft, ChevronDown } from 'lucide-react';
import { useGroup } from '../../contexts/GroupContext';
import { getFullRoster, RosterEntry } from '../../lib/rankings';
import { groupLabel, MembershipRole, MembershipWithGroup, isEffectiveAdmin } from '../../lib/groups';
import { queryKeys, STALE } from '../../lib/queryKeys';
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

const roleWord: Record<MembershipRole, string> = { admin: 'Admin', big: 'Big', little: 'Little' };

export const RosterContent = ({ membership, onNavigate: navigate, embedded = false }: {
  membership: MembershipWithGroup | null;
  onNavigate: (path: string) => void;
  embedded?: boolean;
}) => {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const group = membership?.group;

  const [view, setView] = useState<View>(() => {
    try {
      return localStorage.getItem(VIEW_KEY) === 'card' ? 'card' : 'list';
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
      const saved = localStorage.getItem(SORT_KEY);
      return saved === 'az' || saved === 'za' ? saved : 'role';
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
    refetch,
  } = useQuery({
    queryKey: queryKeys.fullRoster(user?.id ?? '', group?.id ?? ''),
    queryFn: () =>
      getFullRoster(group!.id).then(({ roster: r, error: loadError }) => {
        if (loadError) throw new Error(loadError);
        return r;
      }),
    enabled: !!group,
    staleTime: STALE.medium,
  });
  const error = queryError ? (queryError as Error).message : '';

  if (!group) return null;

  const matchingRoster = roster.filter(r => {
    const matchesRole = roleFilter === 'all' || (roleFilter === 'admin' ? r.role === 'admin' || r.isAdmin : r.role === roleFilter);
    const term = search.trim().toLocaleLowerCase();
    return matchesRole && [r.name, r.email, r.major, r.college, r.year, r.hometown].filter(Boolean).join(' ').toLocaleLowerCase().includes(term);
  });
  const admins = matchingRoster.filter(r => r.role === 'admin');
  const bigs = matchingRoster.filter(r => r.role === 'big');
  const littles = matchingRoster.filter(r => r.role === 'little');

  const sortedRoster = [...matchingRoster].sort((a, b) =>
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
    <Avatar src={r.avatarUrl} name={r.name} email={r.email} size={size === 'md' ? 'lg' : 'md'} />
  );

  const renderRow = (r: RosterEntry) => {
    const details = [r.major, r.college, r.year && `Class of ${r.year}`, r.hometown]
      .filter(Boolean)
      .join(' · ');
    return (
      <div key={r.userId} className="ss-roster-row">
        <div className="ss-roster-member">
          {avatar(r)}
          <div className="min-w-0">
            <Button variant="ghost" size="sm" className="!justify-start !px-2 -ml-2 max-w-full" title={displayName(r)} onClick={() => navigate(`/group/roster/${encodeURIComponent(r.userId)}${embedded ? '?from=dashboard' : ''}`)}><span className="truncate">{displayName(r)}</span></Button>
            {r.email !== displayName(r) && <p className="ss-caption truncate">{r.email}</p>}
          </div>
        </div>
        <div className="ss-roster-details">{details || 'No details added yet'}</div>
        <div className="ss-roster-role">{rolePill(r)}</div>
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
            <Button variant="ghost" size="sm" className="!justify-start !px-2 -ml-2 max-w-full" title={displayName(r)} onClick={() => navigate(`/group/roster/${encodeURIComponent(r.userId)}${embedded ? '?from=dashboard' : ''}`)}><span className="truncate">{displayName(r)}</span></Button>
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
        <span className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-badge border border-[color:var(--ss-surface-border)] bg-[color:var(--ss-pill-bg)] px-1 text-xs font-semibold tracking-normal tabular-nums">{list.length}</span>
      </div>
      {list.length === 0 ? (
        <p className="ss-caption">No one here yet.</p>
      ) : view === 'card' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{list.map(renderCard)}</div>
      ) : (
        <div className="ss-roster-list">
          <div className="ss-roster-columns" aria-hidden="true"><span>Member</span><span>Details</span><span>Role</span></div>
          {list.map(renderRow)}
        </div>
      )}
    </div>
  );

  return (
    <div className={embedded ? 'w-full' : 'min-h-screen w-full flex flex-col items-center px-5 md:px-8 py-8'}>
      <section className={embedded ? 'w-full' : 'ss-frost w-full max-w-4xl rounded-panel bg-white/25 shadow-[0_20px_60px_-40px_rgba(15,45,32,0.35)] px-6 md:px-12 pt-8 pb-10 md:pt-10 md:pb-14 flex flex-col'}>
        {!embedded && <PageHeader className="flex flex-wrap items-center justify-between gap-3 mb-8">
          <Link to="/" className="font-display italic text-2xl font-medium text-[color:var(--ss-ink-1)]">
            sorora
          </Link>
          <Button variant="quiet" size="sm" onClick={() => navigate('/dashboard')}>
            <ArrowLeft size={14} aria-hidden="true" /> Back to dashboard
          </Button>
        </PageHeader>}

        <h1 className={embedded ? 'font-sans text-[26px] leading-tight font-medium tracking-[-0.02em] text-[color:var(--ss-ink-1)]' : 'font-display text-[34px] md:text-[46px] leading-[1.1] font-medium text-[color:var(--ss-ink-1)]'}>
          Chapter roster
        </h1>
        <p className="mt-2 ss-caption">{groupLabel(group)}</p>

        <DuplicateNameWarnings groupId={group.id} isAdmin={!!membership && isEffectiveAdmin(membership)} accounts={roster.map(member=>({
          userId:member.userId,groupId:group.id,name:member.name,email:member.email,status:'approved',
        }))} />

        {membership && isEffectiveAdmin(membership) && group.active_cycle_id && <CycleParticipationControls userId={user?.id ?? ''} groupId={group.id} cycleId={group.active_cycle_id} roster={roster} />}
        <div className="mt-6 flex items-center justify-end gap-2 flex-wrap">
          <label className="flex-1 min-w-[160px]">
            <span className="sr-only">Search roster</span>
            <input type="search" className="ss-input" placeholder="Search members…" value={search} onChange={event => setSearch(event.target.value)} />
          </label>
          <label className="relative inline-flex items-center"><span className="sr-only">Filter roster by role</span><select aria-label="Filter roster by role" className="ss-input appearance-none block !pr-10" value={roleFilter} onChange={event => setRoleFilter(event.target.value)}>
            <option value="all">All members</option><option value="big">Bigs</option><option value="little">Littles</option><option value="admin">Admins</option>
          </select><span className="pointer-events-none absolute inset-y-0 right-3 flex items-center"><ChevronDown size={16} aria-hidden="true" /></span></label>
          <div className="relative inline-flex items-center">
          <select
            aria-label="Sort roster"
            value={sortMode}
            onChange={e => changeSort(e.target.value as SortMode)}
            className="appearance-none text-sm bg-white/60 border border-[color:var(--ss-input-border)] rounded-control pl-4 pr-10 py-2 text-[color:var(--ss-ink-3)] focus:outline-none focus:border-[color:var(--ss-jade)]"
          >
            <option value="role">By member type</option>
            <option value="az">Name (A–Z)</option>
            <option value="za">Name (Z–A)</option>
          </select>
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[color:var(--ss-ink-3)]"><ChevronDown size={16} aria-hidden="true" /></span>
          </div>
          <div className="inline-flex items-center gap-1 bg-white/60 border border-[color:var(--ss-input-border)] rounded-control p-1">
            <Button variant="ghost" size="sm"
              onClick={() => changeView('list')}
              aria-label="List view"
              aria-pressed={view === 'list'}
              className={`!p-2 min-w-[36px] rounded-control transition-colors ${
                view === 'list'
                  ? '!bg-[color:var(--ss-selection-bg)] !text-[color:var(--ss-selection-text)]'
                  : 'text-[color:var(--ss-ink-5)] hover:text-[color:var(--ss-ink-2)]'
              }`}
            >
              <List size={16} />
            </Button>
            <Button variant="ghost" size="sm"
              onClick={() => changeView('card')}
              aria-label="Card view"
              aria-pressed={view === 'card'}
              className={`!p-2 min-w-[36px] rounded-control transition-colors ${
                view === 'card'
                  ? '!bg-[color:var(--ss-selection-bg)] !text-[color:var(--ss-selection-text)]'
                  : 'text-[color:var(--ss-ink-5)] hover:text-[color:var(--ss-ink-2)]'
              }`}
            >
              <LayoutGrid size={16} />
            </Button>
          </div>
        </div>

        {error && <div role="alert" className="mt-4 text-[color:var(--ss-error)] text-sm">
          <p>Could not load your chapter roster. Try again.</p>
          <Button variant="quiet" size="sm" className="mt-2" onClick={() => void refetch()}>Try again</Button>
        </div>}

        {!loading && !error && <p className="ss-caption mt-4" role="status">{matchingRoster.length === roster.length ? `${roster.length} members` : `${matchingRoster.length} of ${roster.length} members`}</p>}
        <div className="mt-6">
          {loading ? (
            <div className="flex items-center gap-2 text-[color:var(--ss-ink-5)]">
              <LoadingLogo size={20} /> Loading…
            </div>
          ) : error ? null : matchingRoster.length === 0 ? (
            <p className="ss-caption">{roster.length === 0 ? 'No members yet.' : 'No members match your search or filter.'}</p>
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
            <div className="ss-roster-list">
              <div className="ss-roster-columns" aria-hidden="true"><span>Member</span><span>Details</span><span>Role</span></div>
              {sortedRoster.map(renderRow)}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

const Roster = () => {
  const { membership } = useGroup();
  const navigate = useNavigate();
  return <RosterContent membership={membership} onNavigate={navigate} />;
};
export default Roster;
