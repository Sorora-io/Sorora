import PageHeader from '../components/PageHeader';
import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useGroup } from '../contexts/GroupContext';
import Button from '../components/Button';
import Avatar from '../components/Avatar';
import WelcomeTour, { WELCOME_TOUR_KEY } from '../components/WelcomeTour';
import { ProfileContent } from './Profile';
import { isEffectiveAdmin, MembershipWithGroup, groupLabel, getPendingMemberships } from '../lib/groups';
import { getSubmissionStatus, getMyRanking, getFullRoster, RosterEntry } from '../lib/rankings';
import { getPairingRevealStatus } from '../lib/pairings';
import { useMyProfile } from '../hooks/useMyProfile';
import { hasTourSeen, markTourSeen } from '../lib/tour';
import { queryKeys, STALE } from '../lib/queryKeys';

// Dashboard = the sorora-story canvas's five-tab member view (Dashboard /
// Profile / Rankings / Roster / FAQ). Every tab lives on the same soft
// mint background under a shared top nav; no sidebar.

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

export const DashboardTab = ({
  membership,
  onNavigate,
  onReplayTour,
}: {
  membership: MembershipWithGroup;
  onNavigate: (path: string) => void;
  onReplayTour: () => void;
}) => {
  const { user } = useAuth();
  const isRanker = membership.role === 'big' || membership.role === 'little';
  const isAdmin = isEffectiveAdmin(membership);
  const cycleId = membership.group.active_cycle_id;
  const targetPlural = opposite(membership.role) === 'big' ? 'Bigs' : 'littles';

  const { data: rankedIds } = useQuery({
    queryKey: queryKeys.myRanking(user?.id ?? '', cycleId ?? ''),
    queryFn: () => getMyRanking(cycleId).then(({ rankedIds: ids }) => ids),
    enabled: isRanker && !!cycleId,
  });

  const { data: statusRows } = useQuery({
    queryKey: queryKeys.submissionStatus(user?.id ?? '', cycleId ?? ''),
    queryFn: () =>
      getSubmissionStatus(membership.group_id, cycleId).then(({ rows }) => rows),
    enabled: isAdmin && !!cycleId,
  });

  const { data: pendingCount = 0 } = useQuery({
    queryKey: queryKeys.pendingCount(user?.id ?? '', membership.group_id),
    queryFn: () => getPendingMemberships(membership.group_id).then(({ memberships: m }) => m.length),
    enabled: isAdmin,
    staleTime: STALE.short,
  });

  const { data: reveal } = useQuery({
    queryKey: queryKeys.revealStatus(user?.id ?? '', cycleId ?? ''),
    queryFn: () => getPairingRevealStatus(membership.group_id, cycleId!).then(({ status }) => status),
    enabled: isAdmin && !!cycleId,
    staleTime: STALE.short,
  });

  const submitted = (rankedIds?.length ?? 0) > 0;
  const bigs = (statusRows ?? []).filter(r => r.role === 'big');
  const littles = (statusRows ?? []).filter(r => r.role === 'little');
  const bigsDone = bigs.filter(r => r.submitted).length;
  const littlesDone = littles.filter(r => r.submitted).length;

  // "Needs attention" means exactly that: things blocked on the admin,
  // most-blocking first. Progress meters are ambient status and live
  // below, not here — a half-full bar isn't a task.
  const rosterSize = bigs.length + littles.length;
  const outstanding = rosterSize - (bigsDone + littlesDone);
  const pairingsRun = (reveal?.total ?? 0) > 0;
  const unrevealed = (reveal?.total ?? 0) - (reveal?.sent ?? 0);

  const attention: { tone: 'urgent' | 'waiting' | 'ready'; title: string; detail: string; action: string; to: string }[] = [];
  if (pendingCount > 0) {
    attention.push({
      tone: 'urgent',
      title: `${pendingCount} join request${pendingCount === 1 ? '' : 's'} waiting`,
      detail: `${pendingCount === 1 ? 'Someone' : 'They'} can't rank until you approve ${pendingCount === 1 ? 'them' : 'them'}.`,
      action: 'Review',
      to: '/group/approvals',
    });
  }
  if (rosterSize > 0 && outstanding > 0) {
    attention.push({
      tone: 'waiting',
      title: `${outstanding} of ${rosterSize} haven't submitted rankings`,
      detail: 'You can still run matching — they’ll count as having no preferences.',
      action: 'View submissions',
      to: '/group/status',
    });
  }
  if (rosterSize > 0 && outstanding === 0 && !pairingsRun) {
    attention.push({
      tone: 'ready',
      title: 'Everyone has submitted',
      detail: 'Your chapter is ready to match.',
      action: 'Run matching',
      to: '/group/status',
    });
  }
  if (pairingsRun && unrevealed > 0) {
    attention.push({
      tone: 'ready',
      title: `${unrevealed} Big${unrevealed === 1 ? '' : 's'} not notified yet`,
      detail: 'Pairings are ready to reveal by email.',
      action: 'Reveal',
      to: '/group/pairings',
    });
  }

  const toneDot: Record<'urgent' | 'waiting' | 'ready', string> = {
    urgent: 'bg-brick-500',
    waiting: 'bg-gold-400',
    ready: 'bg-[color:var(--ss-jade)]',
  };

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
        {(isRanker || isAdmin) && (
          <section className="ss-surface flex flex-col gap-3">
            <SectionHeading>
              {isRanker ? `My ${targetPlural} rankings` : 'My rankings'}
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
            <div className="flex items-center justify-between gap-3">
              <div className="ss-kicker" style={{ marginBottom: 0 }}>
                01 · Needs attention
              </div>
              {attention.length > 0 && (
                <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-brick-500 px-1.5 text-[11px] font-semibold text-white tabular-nums">
                  {attention.length}
                </span>
              )}
            </div>
            <SectionHeading>
              {rosterSize === 0
                ? 'Nothing here yet'
                : attention.length === 0
                  ? 'You’re all caught up'
                  : 'What needs you'}
            </SectionHeading>

            {rosterSize === 0 ? (
              <p className="ss-caption">
                No Bigs or Littles approved yet — once people join with your chapter code, their
                requests show up here.
              </p>
            ) : attention.length === 0 ? (
              <p className="ss-caption">
                {pairingsRun
                  ? 'Nothing is waiting on you right now. Pairings are matched and every Big has been notified.'
                  : 'Nothing is waiting on you right now.'}
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-[color:var(--ss-surface-border)]">
                {attention.map(item => (
                  // Stacked, not title-beside-button: this card sits in a
                  // half-width dashboard column (~390px), where a side-by-side
                  // action squeezes the copy to one word per line.
                  <li key={item.title} className="flex items-start gap-2.5 py-3 first:pt-1">
                    <span
                      aria-hidden="true"
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${toneDot[item.tone]}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[color:var(--ss-ink-2)]">{item.title}</p>
                      <p className="ss-caption mt-0.5">{item.detail}</p>
                      <Button
                        size="sm"
                        variant="quiet"
                        className="mt-2"
                        onClick={() => onNavigate(item.to)}
                      >
                        {item.action}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {rosterSize > 0 && (
              <div className="mt-1 pt-3 border-t border-[color:var(--ss-surface-border)] flex flex-col gap-2">
                <div className="ss-kicker" style={{ marginBottom: 0 }}>Chapter progress</div>
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

            <div className="mt-1 pt-3 border-t border-[color:var(--ss-surface-border)] flex flex-wrap gap-2">
              {[
                { label: 'Approvals', to: '/group/approvals' },
                { label: 'Submissions', to: '/group/status' },
                { label: 'Pairings', to: '/group/pairings' },
              ].map(({ label, to }) => (
                <Button key={to} size="sm" variant="quiet" onClick={() => onNavigate(to)}>
                  {label}
                </Button>
              ))}
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
        <Button variant="outline" size="sm" onClick={onReplayTour}>
          Replay the tour
        </Button>
      </div>
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
  const { user } = useAuth();
  const isRanker = membership.role === 'big' || membership.role === 'little';
  const target = opposite(membership.role);
  const targetPlural = target === 'big' ? 'Bigs' : 'littles';
  const cycleId = membership.group.active_cycle_id;

  const { data: rankedIds } = useQuery({
    queryKey: queryKeys.myRanking(user?.id ?? '', cycleId ?? ''),
    queryFn: () => getMyRanking(cycleId).then(({ rankedIds: ids }) => ids),
    enabled: isRanker && !!cycleId,
  });

  const { data: roster } = useQuery({
    queryKey: queryKeys.fullRoster(user?.id ?? '', membership.group_id),
    queryFn: () => getFullRoster(membership.group_id).then(({ roster: r }) => r),
    enabled: isRanker,
    staleTime: STALE.medium,
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
        <Sub text="Submit your own preferences while keeping your admin access." />
        <div className="mt-6">
          <Button onClick={() => onNavigate('/group/submit-ranking')}>Set up my rankings</Button>
        </div>
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

      <div className="mt-8 ss-surface">
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
                  <Avatar src={r.avatarUrl} name={r.name} email={r.email} size="sm" />
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

  const { user } = useAuth();
  const { data: roster, isLoading } = useQuery({
    queryKey: queryKeys.fullRoster(user?.id ?? '', membership.group_id),
    queryFn: () => getFullRoster(membership.group_id).then(({ roster: r }) => r),
    staleTime: STALE.medium,
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

      <div className="mt-8 ss-surface">
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
                    <Avatar src={m.avatarUrl} name={m.name} email={m.email} size="md" />
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
    <div className="mt-8 ss-surface">
      <SectionHeading>
        Frequently asked questions
      </SectionHeading>
      <div className="mt-3 flex flex-col divide-y divide-[color:var(--ss-surface-border)]">
        {[
          { question: 'Can I update my rankings?', answer: 'Yes. Open the Rankings tab and save your updated preferences while submissions are open. Your chapter admin controls the deadline and when submissions close.' },
          { question: 'Who can see my preferences?', answer: 'When Blind rankings is on, only you can view your preferences. When it is off, chapter admins can also access them. Your ranking page shows the current setting. Other members cannot see your preferences.' },
          { question: 'When will matches be announced?', answer: 'Your chapter admin runs matching and shares the results. Contact your admin for your chapter’s announcement date.' },
        ].map(({ question, answer }) => (
          <details key={question} className="group">
            <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-4 py-3 text-[color:var(--ss-ink-2)] [&::-webkit-details-marker]:hidden">
              {question}
              <span aria-hidden="true" className="shrink-0 text-xl group-open:rotate-45 transition-transform">+</span>
            </summary>
            <p className="ss-caption pb-4 pr-6">{answer}</p>
          </details>
        ))}
      </div>
    </div>
    <div className="mt-6 flex flex-wrap gap-3">
      <Link
        to="/faq"
        className="inline-flex items-center justify-center gap-2 px-7 py-3 text-[15px] font-medium min-h-[48px] rounded-pill bg-[color:var(--ss-jade-deep)] text-white hover:bg-[color:var(--ss-jade)] transition-colors"
      >
        Open the full FAQ
      </Link>
      <Link
        to="/contact"
        className="inline-flex items-center justify-center gap-2 px-7 py-3 text-[15px] font-medium min-h-[48px] rounded-pill border border-[color:var(--ss-jade-line)] text-[color:var(--ss-ink-2)] hover:bg-white/60 transition-colors"
      >
        Contact us
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
  const { memberships, membership, setActiveGroupId } = useGroup();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const tabFromUrl = (searchParams.get('tab') as TabId) || 'dashboard';
  const [tab, setTab] = useState<TabId>(tabFromUrl);
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

  const { data: profile } = useMyProfile();

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

  // Hover/focus on a tab pill prefetches that tab's data so the switch is
  // instant. Cheap when the user doesn't click (React Query dedupes and
  // respects the query's staleTime), noticeable when they do. We only
  // prefetch tabs that fetch their own data — Profile is already covered
  // by useMyProfile at the shell level, and FAQ is static.
  const prefetchTab = (id: TabId) => {
    if (!user || !membership) return;
    if (id === 'roster' || id === 'rankings') {
      queryClient.prefetchQuery({
        queryKey: queryKeys.fullRoster(user.id, membership.group_id),
        queryFn: () => getFullRoster(membership.group_id).then(({ roster: r }) => r),
        staleTime: STALE.medium,
      });
    }
  };

  if (membership && membership.status !== 'approved') {
    return <Navigate to="/group/pending" replace />;
  }

  // -----------------------------------------------------------------------
  // Empty state — signed in but not in any chapter
  // -----------------------------------------------------------------------
  if (memberships.length === 0 || !membership) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center px-5 md:px-8 py-8">
        <section className="ss-frost w-full max-w-2xl rounded-[28px] bg-white/25 shadow-[0_20px_60px_-40px_rgba(15,45,32,0.35)] px-6 md:px-14 pt-8 pb-10 md:pt-10 md:pb-14 text-center">
          <PageHeader className="flex items-center justify-between mb-10">
            <Link to="/" className="font-display italic text-2xl font-medium text-[color:var(--ss-ink-1)]">
              sorora
            </Link>
          </PageHeader>
          <Heading text="Your chapter starts here." />
          <Sub text="You're signed in but not part of a chapter yet. Join one with a code, or set yours up." />
          <div className="mt-8 flex flex-col items-center gap-3">
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
        return <ProfileContent />;
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
        <PageHeader className="flex items-center justify-between mb-6">
          <Link to="/" className="font-display italic text-2xl font-medium text-[color:var(--ss-ink-1)]">
            sorora
          </Link>
        </PageHeader>

        {tourActive ? (
          <WelcomeTour
            membership={membership}
            firstName={firstName}
            onFinish={finishTour}
          />
        ) : (
          <>
            <nav aria-label="Dashboard navigation" className="flex flex-wrap gap-1 justify-center mb-4">
              {TABS.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id)}
                  onMouseEnter={() => prefetchTab(t.id)}
                  onFocus={() => prefetchTab(t.id)}
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
