import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useGroup } from '../contexts/GroupContext';
import Button from '../components/Button';
import { homeForRole } from '../components/RequireGroupRole';
import { isEffectiveAdmin, MembershipWithGroup, groupLabel } from '../lib/groups';
import { getSubmissionStatus, getMyRanking } from '../lib/rankings';
import { getMyProfile } from '../lib/profile';
import { hasTourSeen, markTourSeen } from '../lib/tour';
import { queryKeys } from '../lib/queryKeys';

// Dashboard = the sorora-story canvas's five-tab member view (Dashboard /
// Profile / Rankings / Roster / FAQ). One centered scene per tab, sitting
// on the same soft mint background as the rest of the app; no sidebar.
// The multi-chapter switcher hides in a small link above the tab row,
// since the design assumes one active chapter at a time.

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
    m.role === 'admin'
      ? 'Admin'
      : m.role === 'big'
      ? 'Big'
      : m.role === 'little'
      ? 'Little'
      : m.role;
  return m.is_admin && m.role !== 'admin' ? `${base} + Admin` : base;
};

const opposite = (role: string) => (role === 'big' ? 'little' : 'big');

const percent = (a: number, b: number) => (b === 0 ? 0 : Math.round((a / b) * 100));

const Heading = ({
  text,
  italic = false,
}: {
  text: string;
  italic?: boolean;
}) => (
  <h1
    className={`font-display text-[34px] md:text-[46px] leading-[1.1] font-medium text-[color:var(--ss-ink-1)] whitespace-pre-line ${
      italic ? 'italic' : ''
    }`}
  >
    {text}
  </h1>
);

const Sub = ({ text }: { text: string }) => (
  <p className="mt-3 text-[color:var(--ss-ink-5)] text-base leading-relaxed max-w-2xl">
    {text}
  </p>
);

// ---------------------------------------------------------------------------
// Per-tab content
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

  const { data: rankedIds } = useQuery({
    queryKey: queryKeys.myRanking(cycleId ?? ''),
    queryFn: () => getMyRanking(cycleId).then(({ rankedIds: ids }) => ids),
    enabled: isRanker && !!cycleId,
  });

  const { data: statusRows } = useQuery({
    queryKey: queryKeys.submissionStatus(cycleId ?? ''),
    queryFn: () => getSubmissionStatus(membership.group_id, cycleId).then(({ rows }) => rows),
    enabled: isAdmin && !!cycleId,
  });

  const submitted = (rankedIds?.length ?? 0) > 0;
  const target = opposite(membership.role);
  const targetPlural = `${target === 'big' ? 'Bigs' : 'littles'}`;

  const bigs = (statusRows ?? []).filter(r => r.role === 'big');
  const littles = (statusRows ?? []).filter(r => r.role === 'little');
  const bigsDone = bigs.filter(r => r.submitted).length;
  const littlesDone = littles.filter(r => r.submitted).length;

  return (
    <div>
      <Heading text="Your chapter, at your pace." italic />
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
            <h2 className="font-display text-[22px] font-medium text-[color:var(--ss-ink-1)]">
              My {targetPlural} rankings
            </h2>
            <p className="ss-caption">
              {submitted
                ? `You've submitted ${rankedIds!.length} ${
                    rankedIds!.length === 1 ? 'ranking' : 'rankings'
                  }.`
                : "You haven't started a list yet."}
            </p>
            <span className="ss-pill w-fit">
              {membership.group.ranking_deadline
                ? `Deadline: ${new Date(
                    membership.group.ranking_deadline + 'T00:00:00'
                  ).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}`
                : 'Deadline: TBD'}
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
            <div className="ss-kicker">01 · Needs attention</div>
            <h2 className="font-display text-[22px] font-medium text-[color:var(--ss-ink-1)]">
              Chapter progress
            </h2>
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
          <h2 className="font-display text-[22px] font-medium text-[color:var(--ss-ink-1)]">
            A little more about you
          </h2>
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
        <p className="ss-caption">
          Interactive preview · Membership approval and account verification are wired up.
        </p>
      </div>
    </div>
  );
};

const ProfileTab = ({ profile, membership }: { profile: any; membership: MembershipWithGroup }) => {
  return (
    <div>
      <Heading text="Make your profile yours." />
      <Sub text="Add a photo and a few details so your chapter can find you and put a face to your name." />

      <div className="mt-8 ss-surface max-w-2xl">
        <h3 className="font-display text-[22px] font-medium text-[color:var(--ss-ink-1)]">
          {profile?.name || 'Your name'}
        </h3>
        <span className="ss-pill mt-1">{roleLabel(membership)}</span>
        <p className="ss-caption mt-3">
          Photo, major, year, a short bio. Add these whenever you're ready.
        </p>
      </div>

      <div className="mt-6">
        <Link
          to="/profile"
          className="inline-flex items-center justify-center gap-2 px-7 py-3 text-[15px] font-medium min-h-[48px] rounded-pill bg-[color:var(--ss-jade-deep)] text-white hover:bg-[color:var(--ss-jade)] transition-colors"
        >
          Open my profile
        </Link>
      </div>
    </div>
  );
};

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

  const { data: rankedIds } = useQuery({
    queryKey: queryKeys.myRanking(membership.group.active_cycle_id ?? ''),
    queryFn: () =>
      getMyRanking(membership.group.active_cycle_id).then(({ rankedIds: ids }) => ids),
    enabled: isRanker && !!membership.group.active_cycle_id,
  });

  return (
    <div>
      <Heading text={`My ${targetPlural} rankings`} />
      <Sub
        text={
          isRanker
            ? `Your list starts here. Rank the ${targetPlural.toLowerCase()} you've met when you're ready.`
            : 'Rankings are visible to members with a Big or Little role.'
        }
      />

      <div className="mt-8 ss-surface">
        {(!rankedIds || rankedIds.length === 0) ? (
          <>
            <h3 className="font-display text-[22px] font-medium text-[color:var(--ss-ink-1)]">
              No rankings yet.
            </h3>
            <p className="ss-caption mt-2">
              Member eligibility, minimum rankings, and deadline are set by your chapter admin.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              {isRanker && (
                <Button onClick={() => onNavigate('/group/submit-ranking')}>
                  Start ranking
                </Button>
              )}
              <Button variant="outline" onClick={() => onNavigate('/group/roster')}>
                See the chapter roster
              </Button>
            </div>
          </>
        ) : (
          <>
            <h3 className="font-display text-[22px] font-medium text-[color:var(--ss-ink-1)]">
              You've ranked {rankedIds.length}
              {' '}
              {rankedIds.length === 1 ? 'person' : 'people'}.
            </h3>
            <p className="ss-caption mt-2">
              You can reopen your list any time before the deadline.
            </p>
            <div className="mt-4">
              <Button onClick={() => onNavigate('/group/submit-ranking')}>
                Update my rankings
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const RosterTab = ({
  membership,
  onNavigate,
}: {
  membership: MembershipWithGroup;
  onNavigate: (p: string) => void;
}) => (
  <div>
    <Heading text="Your chapter roster" />
    <Sub text={groupLabel(membership.group)} />
    <div className="mt-8">
      <Button onClick={() => onNavigate('/group/roster')}>Open full roster</Button>
    </div>
    <p className="ss-caption mt-4">
      The roster is where you can see everyone in your chapter. Open a profile to learn who's who.
    </p>
  </div>
);

const FaqTab = () => (
  <div>
    <Heading text="A little help, whenever you need it." />
    <Sub text="Visit the FAQ whenever you need help with rankings, submissions, or what happens next." />
    <div className="mt-8">
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

  const onNavigate = (path: string) => {
    if (membership) setActiveGroupId(membership.group_id);
    navigate(path);
  };

  // First-time member: replay-tour hint fires the standalone tour flow.
  const onReplayTour = () => {
    markTourSeen('dashboard');
    navigate('/dashboard?tab=dashboard');
  };
  useEffect(() => {
    if (memberships.length > 0 && !hasTourSeen('dashboard')) {
      // No-op for now — the tour lives in the sign-up flow. Marking it as
      // seen prevents the old modal from resurfacing.
      markTourSeen('dashboard');
    }
  }, [memberships.length]);

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
          <Heading text="Your chapter starts here." italic />
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
      </section>
    </div>
  );
};

export default Dashboard;
