import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useGroup } from '../contexts/GroupContext';
import Button from '../components/Button';
import WelcomeTour, { WELCOME_TOUR_KEY } from '../components/WelcomeTour';
import { homeForRole } from '../components/RequireGroupRole';
import { isEffectiveAdmin, MembershipWithGroup, groupLabel } from '../lib/groups';
import { getSubmissionStatus, getMyRanking, getFullRoster, RosterEntry } from '../lib/rankings';
import { getMyProfile, updateMyProfile, MyProfile } from '../lib/profile';
import { hasTourSeen, markTourSeen } from '../lib/tour';
import { queryKeys } from '../lib/queryKeys';

// Dashboard = the sorora-story canvas's five-tab member view (Dashboard /
// Profile / Rankings / Roster / FAQ). Every tab lives on the same soft
// mint background under a shared top nav; no sidebar. The multi-chapter
// switcher hides in a small link above the tab row.

type TabId = 'dashboard' | 'profile' | 'rankings' | 'roster' | 'faq';

const TABS: { id: TabId; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'profile', label: 'Profile' },
  { id: 'rankings', label: 'Rankings' },
  { id: 'roster', label: 'Roster' },
  { id: 'faq', label: 'FAQ' },
];

const roleLabel = (m: MembershipWithGroup) => {
  const base =
    m.role === 'admin' ? 'Admin' : m.role === 'big' ? 'Big' : m.role === 'little' ? 'Little' : m.role;
  return m.is_admin && m.role !== 'admin' ? `${base} + Admin` : base;
};

const opposite = (role: string) => (role === 'big' ? 'little' : 'big');
const percent = (a: number, b: number) => (b === 0 ? 0 : Math.round((a / b) * 100));

const formatDeadline = (iso: string | null) =>
  iso
    ? new Date(iso + 'T00:00:00').toLocaleDateString(undefined, {
        month: 'long',
        day: 'numeric',
      })
    : 'TBD';

const initial = (name: string | null | undefined, email?: string) =>
  (name || email || '?').charAt(0).toUpperCase();

// Design canvas deliberately drops the Georgia serif once the visitor is
// past onboarding — the dashboard headings are Arial-family sans, 30px,
// -0.9px tracking, 600 weight. Same content, quieter voice; the switch
// is what makes the intro scenes feel like a moment and the dashboard
// feel like work you're already doing.
const Heading = ({ text }: { text: string }) => (
  <h1
    className="font-sans text-[color:var(--ss-ink-1)] whitespace-pre-line"
    style={{
      fontSize: 30,
      fontWeight: 600,
      lineHeight: 1.2,
      letterSpacing: '-0.9px',
    }}
  >
    {text}
  </h1>
);

const Sub = ({ text }: { text: string }) => (
  <p className="mt-2 text-[color:var(--ss-ink-5)] text-[14px] leading-[1.6] max-w-2xl">
    {text}
  </p>
);

// Section headings inside dashboard cards ("My littles rankings",
// "Chapter progress"). Also sans, 17px, matching the canvas's
// .ss-dash h3 rule.
const SectionHeading = ({ children }: { children: React.ReactNode }) => (
  <h2
    className="font-sans text-[color:var(--ss-ink-1)]"
    style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.35, margin: 0 }}
  >
    {children}
  </h2>
);

// ---------------------------------------------------------------------------
// Dashboard tab (two-card layout from the design)
// ---------------------------------------------------------------------------

const DashboardTab = ({
  membership,
  onNavigate,
  onReplayTour,
}: {
  membership: MembershipWithGroup;
  onNavigate: (path: string) => void;
  onReplayTour: () => void;
}) => {
  const isRanker = membership.role === 'big' || membership.role === 'little';
  const isAdmin = isEffectiveAdmin(membership);
  const cycleId = membership.group.active_cycle_id;
  const targetPlural = opposite(membership.role) === 'big' ? 'Bigs' : 'littles';

  const { data: rankedIds } = useQuery({
    queryKey: queryKeys.myRanking(cycleId ?? ''),
    queryFn: () => getMyRanking(cycleId).then(({ rankedIds: ids }) => ids),
    enabled: isRanker && !!cycleId,
  });

  const { data: statusRows } = useQuery({
    queryKey: queryKeys.submissionStatus(cycleId ?? ''),
    queryFn: () =>
      getSubmissionStatus(membership.group_id, cycleId).then(({ rows }) => rows),
    enabled: isAdmin && !!cycleId,
  });

  const submitted = (rankedIds?.length ?? 0) > 0;
  const bigs = (statusRows ?? []).filter(r => r.role === 'big');
  const littles = (statusRows ?? []).filter(r => r.role === 'little');
  const bigsDone = bigs.filter(r => r.submitted).length;
  const littlesDone = littles.filter(r => r.submitted).length;

  return (
    <div>
      <Heading text="Your chapter, at your pace." />
      <Sub
        text={
          isRanker
            ? "Come back when you're ready to rank. Everything you need is right here."
            : "Here's what needs you. Approvals first, then follow preference collection."
        }
      />

      <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-4">
        {isRanker && (
          <section className="ss-surface flex flex-col gap-3">
            <SectionHeading>
              My {targetPlural} rankings
            </SectionHeading>
            <p className="ss-caption">
              {submitted
                ? `You've submitted ${rankedIds!.length} ${
                    rankedIds!.length === 1 ? 'ranking' : 'rankings'
                  }.`
                : "You haven't started a list yet."}
            </p>
            <span className="ss-pill w-fit">
              Deadline: {formatDeadline(membership.group.ranking_deadline)}
            </span>
            <div className="mt-2">
              <Button onClick={() => onNavigate('/group/submit-ranking')}>
                {submitted ? 'Update rankings' : 'Start ranking'}
              </Button>
            </div>
          </section>
        )}

        {isAdmin && (
          <section className="ss-surface flex flex-col gap-3">
            <div className="ss-kicker" style={{ marginBottom: 0 }}>
              01 · Needs attention
            </div>
            <SectionHeading>
              Chapter progress
            </SectionHeading>
            {bigs.length + littles.length === 0 ? (
              <p className="ss-caption">No Bigs or Littles approved yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-sm text-[color:var(--ss-ink-3)]">
                  <span>Bigs</span>
                  <span className="tabular-nums">
                    {bigsDone} / {bigs.length} submitted
                  </span>
                </div>
                <div className="ss-meter">
                  <span style={{ width: `${percent(bigsDone, bigs.length)}%` }} />
                </div>
                <div className="flex items-center justify-between text-sm text-[color:var(--ss-ink-3)]">
                  <span>Littles</span>
                  <span className="tabular-nums">
                    {littlesDone} / {littles.length} submitted
                  </span>
                </div>
                <div className="ss-meter">
                  <span style={{ width: `${percent(littlesDone, littles.length)}%` }} />
                </div>
              </div>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="quiet" onClick={() => onNavigate('/group/approvals')}>
                Approvals
              </Button>
              <Button size="sm" variant="quiet" onClick={() => onNavigate('/group/status')}>
                Submissions
              </Button>
              <Button size="sm" variant="quiet" onClick={() => onNavigate('/group/pairings')}>
                Pairings
              </Button>
            </div>
          </section>
        )}

        <section className="ss-surface flex flex-col gap-3">
          <SectionHeading>
            A little more about you
          </SectionHeading>
          <p className="ss-caption">
            Add a photo and a few details so your chapter can find you.
          </p>
          <div className="mt-1">
            <Button variant="outline" onClick={() => onNavigate('/profile')}>
              Edit my profile
            </Button>
          </div>
        </section>
      </div>

      <div className="mt-8 flex flex-col items-start gap-3">
        <button type="button" onClick={onReplayTour} className="ss-link">
          Replay the tour
        </button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Profile tab — inline form matching design (Major / Year / Bio + Save)
// ---------------------------------------------------------------------------

const ProfileTab = ({
  profile,
  membership,
}: {
  profile: MyProfile | null | undefined;
  membership: MembershipWithGroup;
}) => {
  const qc = useQueryClient();
  const [major, setMajor] = useState(profile?.major ?? '');
  const [year, setYear] = useState(profile?.year ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (profile) {
      setMajor(profile.major ?? '');
      setYear(profile.year ?? '');
      setBio(profile.bio ?? '');
    }
    // We watch the fields we actually seed from, not the whole profile
    // object, so an unrelated refetch that returns a new reference with
    // the same values doesn't wipe the user's in-progress edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, profile?.major, profile?.year, profile?.bio]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setStatus('saving');
    setErrorMsg('');
    const { error } = await updateMyProfile(
      profile.name ?? '',
      bio,
      profile.avatar_url ?? null,
      major,
      profile.college ?? '',
      year,
      profile.hometown ?? ''
    );
    if (error) {
      setErrorMsg(error);
      setStatus('error');
      return;
    }
    setStatus('saved');
    qc.invalidateQueries({ queryKey: queryKeys.myProfile() });
    setTimeout(() => setStatus('idle'), 1800);
  };

  return (
    <div>
      <Heading text="Make your profile yours." />
      <Sub text="Add a photo and a few details so your chapter can find you and put a face to your name." />

      <div className="mt-8 ss-surface max-w-xl flex items-start gap-4">
        <div className="w-14 h-14 rounded-full bg-[color:var(--ss-pill-bg)] text-[color:var(--ss-jade)] flex items-center justify-center text-lg font-medium">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="w-full h-full object-cover rounded-full" />
          ) : (
            initial(profile?.name, profile?.email)
          )}
        </div>
        <div className="min-w-0">
          <SectionHeading>
            {profile?.name || 'Your name'}
          </SectionHeading>
          <span className="ss-pill mt-1">{roleLabel(membership)}</span>
        </div>
      </div>

      <form onSubmit={save} className="mt-6 max-w-xl flex flex-col gap-4">
        <div>
          <label className="ss-label" htmlFor="major">Major</label>
          <input
            id="major"
            className="ss-input"
            type="text"
            value={major}
            onChange={e => setMajor(e.target.value)}
            placeholder="e.g. Computer Science"
          />
        </div>
        <div>
          <label className="ss-label" htmlFor="year">Year</label>
          <input
            id="year"
            className="ss-input"
            type="text"
            value={year}
            onChange={e => setYear(e.target.value)}
            placeholder="e.g. Junior"
          />
        </div>
        <div>
          <label className="ss-label" htmlFor="bio">A little about me</label>
          <textarea
            id="bio"
            className="ss-input"
            rows={5}
            value={bio}
            onChange={e => setBio(e.target.value)}
            placeholder="Something you'd like your chapter to know…"
            style={{ resize: 'vertical', minHeight: 120 }}
          />
        </div>
        {status === 'error' && errorMsg && (
          <p className="text-[color:var(--ss-error)] text-sm">{errorMsg}</p>
        )}
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={status === 'saving'}>
            {status === 'saving' ? 'Saving…' : 'Save profile'}
          </Button>
          {status === 'saved' && (
            <span className="text-sm text-[color:var(--ss-jade)]">Saved.</span>
          )}
          <Link to="/profile" className="ss-link">
            More profile settings
          </Link>
        </div>
      </form>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Rankings tab — real numbered list, matching the design's tour preview
// ---------------------------------------------------------------------------

const RankingsTab = ({
  membership,
  onNavigate,
}: {
  membership: MembershipWithGroup;
  onNavigate: (p: string) => void;
}) => {
  const isRanker = membership.role === 'big' || membership.role === 'little';
  const target = opposite(membership.role);
  const targetPlural = target === 'big' ? 'Bigs' : 'littles';
  const cycleId = membership.group.active_cycle_id;

  const { data: rankedIds } = useQuery({
    queryKey: queryKeys.myRanking(cycleId ?? ''),
    queryFn: () => getMyRanking(cycleId).then(({ rankedIds: ids }) => ids),
    enabled: isRanker && !!cycleId,
  });

  const { data: roster } = useQuery({
    queryKey: queryKeys.fullRoster(membership.group_id),
    queryFn: () => getFullRoster(membership.group_id).then(({ roster: r }) => r),
    enabled: isRanker,
  });

  // Join ranked ids against roster so we can show real names in the list —
  // the design's preview shows names, not opaque user ids.
  const rankedList = useMemo(() => {
    if (!rankedIds || !roster) return [];
    const byId = new Map(roster.map(r => [r.userId, r] as const));
    return rankedIds
      .map(id => byId.get(id))
      .filter((r): r is RosterEntry => !!r);
  }, [rankedIds, roster]);

  if (!isRanker) {
    return (
      <div>
        <Heading text="Rankings" />
        <Sub text="Rankings are visible to members with a Big or Little role." />
      </div>
    );
  }

  const empty = rankedList.length === 0;

  return (
    <div>
      <Heading text={`My ${targetPlural.toLowerCase()} rankings`} />
      <Sub
        text={
          empty
            ? `Your list starts here. Rank the ${targetPlural.toLowerCase()} you've met when you're ready.`
            : 'You can reopen your list any time before the deadline.'
        }
      />

      <div className="mt-8 ss-surface max-w-xl">
        {empty ? (
          <>
            <SectionHeading>
              No rankings yet.
            </SectionHeading>
            <p className="ss-caption mt-2">
              Member eligibility, minimum rankings, and deadline are set by your chapter admin.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button onClick={() => onNavigate('/group/submit-ranking')}>Start ranking</Button>
              <Button variant="outline" onClick={() => onNavigate('/group/roster')}>
                See the chapter roster
              </Button>
            </div>
          </>
        ) : (
          <>
            <SectionHeading>
              My {targetPlural.toLowerCase()} rankings
            </SectionHeading>
            <div className="mt-3 flex flex-col divide-y divide-[color:var(--ss-surface-border)]">
              {rankedList.map((r, i) => (
                <div
                  key={r.userId}
                  className="flex items-center gap-3 py-3 text-[color:var(--ss-ink-2)]"
                >
                  <span className="w-6 text-right text-[color:var(--ss-ink-5)] tabular-nums">
                    {i + 1}
                  </span>
                  <span className="w-8 h-8 rounded-full bg-[color:var(--ss-pill-bg)] text-[color:var(--ss-jade)] flex items-center justify-center text-sm font-medium">
                    {r.avatarUrl ? (
                      <img src={r.avatarUrl} alt="" className="w-full h-full object-cover rounded-full" />
                    ) : (
                      initial(r.name, r.email)
                    )}
                  </span>
                  <span className="min-w-0 truncate">{r.name ?? r.email}</span>
                </div>
              ))}
            </div>
            <p className="ss-caption mt-4">
              Ranking deadline: {formatDeadline(membership.group.ranking_deadline)}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button onClick={() => onNavigate('/group/submit-ranking')}>Update rankings</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Roster tab — real member list with role pills
// ---------------------------------------------------------------------------

type RosterFilter = 'all' | 'big' | 'little' | 'admin';
type RosterSort = 'az' | 'za';

// A roster entry counts as an "admin" for filtering when they have the
// dedicated admin role OR when they hold the isAdmin flag alongside a
// big/little role — matches how the row's role pill labels them.
const isRosterAdmin = (m: RosterEntry) => m.role === 'admin' || m.isAdmin;

const RosterTab = ({
  membership,
  onNavigate,
}: {
  membership: MembershipWithGroup;
  onNavigate: (p: string) => void;
}) => {
  const [filter, setFilter] = useState<RosterFilter>('all');
  const [sort, setSort] = useState<RosterSort>('az');

  const { data: roster, isLoading } = useQuery({
    queryKey: queryKeys.fullRoster(membership.group_id),
    queryFn: () => getFullRoster(membership.group_id).then(({ roster: r }) => r),
  });

  const filtered = useMemo(() => {
    const list = roster ?? [];
    const matched = list.filter(m => {
      if (filter === 'all') return true;
      if (filter === 'admin') return isRosterAdmin(m);
      return m.role === filter;
    });
    const cmp = (a: RosterEntry, b: RosterEntry) =>
      (a.name ?? a.email).localeCompare(b.name ?? b.email);
    return [...matched].sort((a, b) => (sort === 'az' ? cmp(a, b) : -cmp(a, b)));
  }, [roster, filter, sort]);

  const counts = useMemo(() => {
    const list = roster ?? [];
    return {
      all: list.length,
      big: list.filter(m => m.role === 'big').length,
      little: list.filter(m => m.role === 'little').length,
      admin: list.filter(isRosterAdmin).length,
    };
  }, [roster]);

  const filterOptions: { id: RosterFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'big', label: 'Bigs' },
    { id: 'little', label: 'Littles' },
    { id: 'admin', label: 'Admins' },
  ];

  return (
    <div>
      <Heading text="Your chapter roster" />
      <Sub text={groupLabel(membership.group)} />

      <div className="mt-8 ss-surface max-w-xl">
        {isLoading ? (
          <p className="ss-caption">Loading your chapter…</p>
        ) : (roster?.length ?? 0) === 0 ? (
          <>
            <SectionHeading>
              No members yet.
            </SectionHeading>
            <p className="ss-caption mt-2">
              Share your chapter code so members can request to join.
            </p>
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3 mb-4">
              <div
                className="flex flex-wrap gap-1"
                role="group"
                aria-label="Filter roster by role"
              >
                {filterOptions.map(opt => {
                  const active = filter === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setFilter(opt.id)}
                      aria-pressed={active}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill text-[13px] font-medium transition-colors ${
                        active
                          ? 'bg-[color:var(--ss-jade-deep)] text-white'
                          : 'bg-transparent text-[color:var(--ss-ink-3)] hover:bg-white/60'
                      }`}
                    >
                      {opt.label}
                      <span
                        className={`tabular-nums text-[11px] ${
                          active ? 'text-white/70' : 'text-[color:var(--ss-ink-5)]'
                        }`}
                      >
                        {counts[opt.id]}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div
                className="flex gap-1 ml-auto"
                role="group"
                aria-label="Sort roster by name"
              >
                {(['az', 'za'] as RosterSort[]).map(id => {
                  const active = sort === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setSort(id)}
                      aria-pressed={active}
                      className={`inline-flex items-center px-2.5 py-1.5 rounded-pill text-[12px] font-medium tracking-wide transition-colors ${
                        active
                          ? 'bg-[color:var(--ss-jade-deep)] text-white'
                          : 'bg-transparent text-[color:var(--ss-ink-4)] hover:bg-white/60'
                      }`}
                    >
                      {id === 'az' ? 'A → Z' : 'Z → A'}
                    </button>
                  );
                })}
              </div>
            </div>

            {filtered.length === 0 ? (
              <p className="ss-caption">
                No {filter === 'admin' ? 'admins' : `${filter}s`} in your chapter yet.
              </p>
            ) : (
              <div className="flex flex-col divide-y divide-[color:var(--ss-surface-border)]">
                {filtered.map(m => (
                  <div key={m.userId} className="flex items-center gap-3 py-3">
                    <span className="w-9 h-9 rounded-full bg-[color:var(--ss-pill-bg)] text-[color:var(--ss-jade)] flex items-center justify-center text-sm font-medium">
                      {m.avatarUrl ? (
                        <img src={m.avatarUrl} alt="" className="w-full h-full object-cover rounded-full" />
                      ) : (
                        initial(m.name, m.email)
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[color:var(--ss-ink-2)] truncate">
                        {m.name ?? m.email}
                      </div>
                      {m.major && (
                        <div className="text-xs text-[color:var(--ss-ink-5)] truncate">{m.major}</div>
                      )}
                    </div>
                    <span className="ss-pill">
                      {m.role === 'admin'
                        ? 'Admin'
                        : m.role === 'big'
                        ? 'Big'
                        : 'Little'}
                      {m.isAdmin && m.role !== 'admin' && ' · Admin'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div className="mt-6">
        <Button variant="outline" onClick={() => onNavigate('/group/roster')}>
          Open full roster
        </Button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// FAQ tab — the design's summarized preview; full FAQ lives at /faq
// ---------------------------------------------------------------------------

const FaqTab = () => (
  <div>
    <Heading text="A little help, whenever you need it." />
    <Sub text="Visit the FAQ whenever you need help with rankings, submissions, or what happens next." />
    <div className="mt-8 ss-surface max-w-xl">
      <SectionHeading>
        Frequently asked questions
      </SectionHeading>
      <div className="mt-3 flex flex-col divide-y divide-[color:var(--ss-surface-border)]">
        {[
          'Can I update my rankings?',
          'Who can see my preferences?',
          'When will matches be announced?',
        ].map(q => (
          <p key={q} className="py-3 text-[color:var(--ss-ink-2)]">
            {q}
          </p>
        ))}
      </div>
    </div>
    <div className="mt-6">
      <Link
        to="/faq"
        className="inline-flex items-center justify-center gap-2 px-7 py-3 text-[15px] font-medium min-h-[48px] rounded-pill bg-[color:var(--ss-jade-deep)] text-white hover:bg-[color:var(--ss-jade)] transition-colors"
      >
        Open the full FAQ
      </Link>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Page shell
// ---------------------------------------------------------------------------

const Dashboard = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, signOut } = useAuth();
  const { memberships, membership, setActiveGroupId } = useGroup();

  const tabFromUrl = (searchParams.get('tab') as TabId) || 'dashboard';
  const [tab, setTab] = useState<TabId>(tabFromUrl);
  const [switchOpen, setSwitchOpen] = useState(false);
  const [signOutConfirming, setSignOutConfirming] = useState(false);
  const [tourActive, setTourActive] = useState(false);

  useEffect(() => {
    if (tab !== tabFromUrl) setTab(tabFromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabFromUrl]);

  const setActiveTab = (id: TabId) => {
    setTab(id);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('tab', id);
      return next;
    }, { replace: true });
  };

  const { data: profile } = useQuery({
    queryKey: queryKeys.myProfile(),
    queryFn: () => getMyProfile().then(({ profile: p }) => p),
    enabled: !!user,
  });

  const otherMemberships = useMemo(
    () => memberships.filter(m => !membership || m.group_id !== membership.group_id),
    [memberships, membership]
  );

  // First-time approved member sees the welcome + tour. Also flipped on
  // manually by "Replay the tour".
  useEffect(() => {
    if (
      membership?.status === 'approved' &&
      !hasTourSeen(WELCOME_TOUR_KEY) &&
      searchParams.get('tour') !== '1'
    ) {
      setTourActive(true);
    }
  }, [membership?.status, searchParams]);

  useEffect(() => {
    if (searchParams.get('tour') === '1' && membership) {
      setTourActive(true);
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        next.delete('tour');
        return next;
      }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, membership?.id]);

  const finishTour = () => {
    markTourSeen(WELCOME_TOUR_KEY);
    setTourActive(false);
  };

  const onNavigate = (path: string) => {
    if (membership) setActiveGroupId(membership.group_id);
    navigate(path);
  };

  const onReplayTour = () => setTourActive(true);

  // -----------------------------------------------------------------------
  // Empty state — signed in but not in any chapter
  // -----------------------------------------------------------------------
  if (memberships.length === 0 || !membership) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center px-5 md:px-8 py-8">
        <section className="ss-frost w-full max-w-2xl rounded-[28px] bg-white/25 shadow-[0_20px_60px_-40px_rgba(15,45,32,0.35)] px-6 md:px-14 pt-8 pb-10 md:pt-10 md:pb-14 text-center">
          <header className="flex items-center justify-between mb-10">
            <Link to="/" className="font-display italic text-2xl font-medium text-[color:var(--ss-ink-1)]">
              sorora
            </Link>
            <button
              type="button"
              onClick={() => signOut()}
              className="text-sm text-[color:var(--ss-ink-4)] hover:text-[color:var(--ss-ink-1)] underline underline-offset-4"
            >
              Sign out
            </button>
          </header>
          <Heading text="Your chapter starts here." />
          <Sub text="You're signed in but not part of a chapter yet. Join one with a code, or set yours up." />
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" variant="outline" onClick={() => navigate('/login?mode=signup&path=join')}>
              Join a chapter
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate('/login?mode=signup&path=create')}>
              Create a chapter
            </Button>
          </div>
          <p className="mt-6 ss-caption">
            Already requested to join?{' '}
            <Link to="/group/onboarding" className="underline underline-offset-4">
              Check your request status
            </Link>
            .
          </p>
        </section>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Signed-in member scene
  // -----------------------------------------------------------------------
  const kicker = `${membership.group.name.toUpperCase()} · ${roleLabel(membership).toUpperCase()}`;
  const firstName = (profile?.name ?? '').split(' ')[0] ?? '';

  const renderTab = () => {
    switch (tab) {
      case 'profile':
        return <ProfileTab profile={profile} membership={membership} />;
      case 'rankings':
        return <RankingsTab membership={membership} onNavigate={onNavigate} />;
      case 'roster':
        return <RosterTab membership={membership} onNavigate={onNavigate} />;
      case 'faq':
        return <FaqTab />;
      case 'dashboard':
      default:
        return (
          <DashboardTab
            membership={membership}
            onNavigate={onNavigate}
            onReplayTour={onReplayTour}
          />
        );
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center px-5 md:px-8 py-8">
      <section className="ss-frost w-full max-w-4xl rounded-[28px] bg-white/25 shadow-[0_20px_60px_-40px_rgba(15,45,32,0.35)] px-6 md:px-12 pt-8 pb-10 md:pt-10 md:pb-14 flex flex-col">
        <header className="flex items-center justify-between mb-6">
          <Link to="/" className="font-display italic text-2xl font-medium text-[color:var(--ss-ink-1)]">
            sorora
          </Link>
          <div className="flex items-center gap-4">
            {otherMemberships.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setSwitchOpen(o => !o)}
                  className="text-sm text-[color:var(--ss-ink-4)] hover:text-[color:var(--ss-ink-1)] underline underline-offset-4"
                >
                  Switch chapter
                </button>
                {switchOpen && (
                  <div className="absolute right-0 top-full mt-2 w-64 bg-white/95 border border-[color:var(--ss-surface-border)] rounded-2xl p-2 z-10 shadow-lg">
                    {otherMemberships.map(m => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => { setActiveGroupId(m.group_id); setSwitchOpen(false); }}
                        className="w-full text-left px-3 py-2 rounded-pill text-sm hover:bg-[color:var(--ss-surface)]"
                      >
                        <span className="block font-medium text-[color:var(--ss-ink-2)] truncate">
                          {m.group.name}
                        </span>
                        <span className="block text-xs text-[color:var(--ss-ink-5)] truncate">
                          {roleLabel(m)}
                        </span>
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => { setSwitchOpen(false); onNavigate(homeForRole(membership)); }}
                      className="w-full text-left px-3 py-2 rounded-pill text-sm hover:bg-[color:var(--ss-surface)] text-[color:var(--ss-ink-4)]"
                    >
                      + Add another chapter
                    </button>
                  </div>
                )}
              </div>
            )}
            {signOutConfirming ? (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-[color:var(--ss-ink-5)]">Sign out?</span>
                <button
                  onClick={() => signOut()}
                  className="font-medium text-brick hover:underline"
                >
                  Yes
                </button>
                <button
                  onClick={() => setSignOutConfirming(false)}
                  className="text-[color:var(--ss-ink-5)] hover:underline"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setSignOutConfirming(true)}
                className="text-sm text-[color:var(--ss-ink-4)] hover:text-[color:var(--ss-ink-1)] underline underline-offset-4"
              >
                Sign out
              </button>
            )}
          </div>
        </header>

        {tourActive ? (
          <WelcomeTour
            membership={membership}
            firstName={firstName}
            onFinish={finishTour}
          />
        ) : (
          <>
            <nav className="flex flex-wrap gap-1 justify-center mb-4">
              {TABS.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id)}
                  aria-current={tab === t.id ? 'page' : undefined}
                  className="ss-tab"
                >
                  {t.label}
                </button>
              ))}
            </nav>
            <div className="ss-tab-underline mb-8" />

            <div className="ss-kicker text-center md:text-left">{kicker}</div>

            <div className="text-left">{renderTab()}</div>
          </>
        )}
      </section>
    </div>
  );
};

export default Dashboard;
