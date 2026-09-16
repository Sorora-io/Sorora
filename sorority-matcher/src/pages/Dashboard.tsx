import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useGroup } from '../contexts/GroupContext';
import AddOrganizationForm from '../components/AddOrganizationForm';
import OnboardingTour, { TourStep } from '../components/OnboardingTour';
import Button from '../components/Button';
import { homeForRole } from '../components/RequireGroupRole';
import { isEffectiveAdmin, MembershipWithGroup } from '../lib/groups';
import { getSubmissionStatus, getMyRanking } from '../lib/rankings';
import { getMyProfile } from '../lib/profile';
import { hasTourSeen, markTourSeen } from '../lib/tour';
import { queryKeys } from '../lib/queryKeys';

const DASHBOARD_TOUR_ID = 'dashboard';

const DASHBOARD_TOUR_STEPS: TourStep[] = [
  {
    target: 'dashboard-header',
    title: 'Welcome to your dashboard',
    body: "This is home base — every chapter you're part of shows up below, along with your ranking progress.",
  },
  {
    target: 'dashboard-orgcards',
    title: 'Your chapters',
    body: 'Each card is one chapter. Tap it to jump into rankings, notes, roster, or admin tools for that chapter.',
  },
  {
    target: 'sidepanel-chapter',
    title: 'Switch chapters',
    body: "In more than one chapter? Use this to switch between them and reach chapter-specific pages.",
  },
  {
    target: 'sidepanel-explore',
    title: 'Learn the matching algorithm',
    body: 'Curious how pairings are generated? Check How It Works, or the FAQ, any time.',
  },
  {
    target: 'dashboard-addorg',
    title: 'Add another chapter',
    body: 'Starting or joining a new chapter? You can do that here anytime.',
  },
  {
    target: 'sidepanel-account',
    title: "You're all set",
    body: 'Manage your profile, password, and account from here. Have fun!',
  },
];

const roleLabel: Record<string, string> = { admin: 'Admin', big: 'Big', little: 'Little' };

const todayISO = new Date().toISOString().slice(0, 10);

const formatDeadline = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
};

const ADMIN_ACTIONS = [
  { label: 'Approvals', path: '/group/approvals' },
  { label: 'Submissions', path: '/group/status' },
  { label: 'Settings', path: '/group/settings' },
  { label: 'Pairings', path: '/group/pairings' },
];

interface AdminProgress {
  bigsSubmitted: number;
  bigsTotal: number;
  littlesSubmitted: number;
  littlesTotal: number;
}

const percent = (a: number, b: number) => (b === 0 ? 0 : Math.round((a / b) * 100));

const OrgCard = ({
  m,
  active,
  goTo,
}: {
  m: MembershipWithGroup;
  active: boolean;
  goTo: (groupId: string, path: string) => void;
}) => {
  const isApproved = m.status === 'approved';
  const isAdmin = isApproved && isEffectiveAdmin(m);
  const isRanker = isApproved && (m.role === 'big' || m.role === 'little');
  const cycleId = m.group.active_cycle_id;

  const { data: statusRows, isLoading: progressLoading } = useQuery({
    queryKey: queryKeys.submissionStatus(cycleId ?? ''),
    queryFn: () => getSubmissionStatus(m.group_id, cycleId).then(({ rows }) => rows),
    enabled: isAdmin && !!cycleId,
  });

  const { data: rankedIds, isLoading: rankingLoading } = useQuery({
    queryKey: queryKeys.myRanking(cycleId ?? ''),
    queryFn: () => getMyRanking(cycleId).then(({ rankedIds: ids }) => ids),
    enabled: isRanker && !!cycleId,
  });

  const adminProgress: AdminProgress | null = statusRows
    ? {
        bigsSubmitted: statusRows.filter(r => r.role === 'big' && r.submitted).length,
        bigsTotal: statusRows.filter(r => r.role === 'big').length,
        littlesSubmitted: statusRows.filter(r => r.role === 'little' && r.submitted).length,
        littlesTotal: statusRows.filter(r => r.role === 'little').length,
      }
    : null;
  const mySubmission = rankedIds ? rankedIds.length > 0 : null;

  const skeletonLine = (width: string) => (
    <span className={`inline-block h-3 ${width} bg-[color:var(--ss-meter-track)] rounded animate-pulse`} />
  );

  return (
    <div
      className={`ss-surface transition-shadow ${active ? 'ring-2 ring-[color:var(--ss-jade-deep)]/60' : ''}`}
    >
      <button
        type="button"
        onClick={() => goTo(m.group_id, m.status === 'approved' ? homeForRole(m) : '/group/pending')}
        className="w-full flex items-start justify-between mb-4 text-left hover:opacity-80 transition-opacity"
      >
        <div className="min-w-0">
          <div className="ss-kicker">{roleLabel[m.role]}{m.is_admin && m.role !== 'admin' && ' · Admin'}{m.status !== 'approved' && ` · ${m.status}`}</div>
          <h3 className="font-display text-xl font-semibold text-[color:var(--ss-ink-1)] leading-snug truncate">
            {m.group.name}
          </h3>
          {m.group.school && <p className="text-sm text-[color:var(--ss-ink-5)] truncate">{m.group.school}</p>}
        </div>
        <span className="flex-shrink-0 text-[color:var(--ss-ink-5)] ml-3">→</span>
      </button>

      {m.group.description && (
        <p className="text-sm text-[color:var(--ss-ink-4)] mb-4">{m.group.description}</p>
      )}

      {m.status === 'approved' && isEffectiveAdmin(m) && (
        <div className="mb-4">
          <div className="ss-kicker">02 · Preference collection</div>
          {progressLoading || !adminProgress ? (
            <div className="flex flex-col gap-1">
              {skeletonLine('w-40')}
              {skeletonLine('w-36')}
            </div>
          ) : adminProgress.bigsTotal === 0 && adminProgress.littlesTotal === 0 ? (
            <p className="text-sm text-[color:var(--ss-ink-5)]">No Bigs or Littles approved yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-sm text-[color:var(--ss-ink-3)]">
                <span>Bigs</span>
                <span className="tabular-nums">
                  {adminProgress.bigsSubmitted} / {adminProgress.bigsTotal} submitted
                </span>
              </div>
              <div className="ss-meter">
                <span style={{ width: `${percent(adminProgress.bigsSubmitted, adminProgress.bigsTotal)}%` }} />
              </div>
              <div className="flex items-center justify-between text-sm text-[color:var(--ss-ink-3)]">
                <span>Littles</span>
                <span className="tabular-nums">
                  {adminProgress.littlesSubmitted} / {adminProgress.littlesTotal} submitted
                </span>
              </div>
              <div className="ss-meter">
                <span style={{ width: `${percent(adminProgress.littlesSubmitted, adminProgress.littlesTotal)}%` }} />
              </div>
            </div>
          )}
        </div>
      )}

      {m.status === 'approved' && (m.role === 'big' || m.role === 'little') && (
        <div className="mb-4">
          {rankingLoading || mySubmission === null ? (
            skeletonLine('w-56')
          ) : (
            <p
              className={`text-sm ${
                !mySubmission && m.group.ranking_deadline && m.group.ranking_deadline < todayISO
                  ? 'text-[color:var(--ss-error)]'
                  : mySubmission
                  ? 'text-[color:var(--ss-jade)]'
                  : 'text-[color:var(--ss-ink-4)]'
              }`}
            >
              {mySubmission
                ? `You've submitted your ${m.role === 'big' ? 'Little' : 'Big'} rankings.`
                : m.group.ranking_deadline
                ? `Your ${m.role === 'big' ? 'Little' : 'Big'} rankings ${
                    m.group.ranking_deadline < todayISO ? 'were due' : 'are due'
                  } ${formatDeadline(m.group.ranking_deadline)}.`
                : `You haven't submitted your ${m.role === 'big' ? 'Little' : 'Big'} rankings yet.`}
            </p>
          )}
        </div>
      )}

      {m.status === 'approved' ? (
        <div className="flex flex-wrap gap-2">
          {(m.role === 'big' || m.role === 'little') && (
            <>
              <Button variant="quiet" size="sm" onClick={() => goTo(m.group_id, '/group/submit-ranking')}>
                {rankingLoading || mySubmission === null
                  ? 'Rankings'
                  : mySubmission
                  ? 'Update rankings'
                  : `Start ranking ${m.role === 'big' ? 'Littles' : 'Bigs'}`}
              </Button>
              <Button variant="quiet" size="sm" onClick={() => goTo(m.group_id, '/group/notes')}>
                Notes
              </Button>
            </>
          )}
          {isEffectiveAdmin(m) &&
            ADMIN_ACTIONS.map(a => (
              <Button key={a.path} variant="quiet" size="sm" onClick={() => goTo(m.group_id, a.path)}>
                {a.label}
              </Button>
            ))}
          <Button variant="quiet" size="sm" onClick={() => goTo(m.group_id, '/group/roster')}>
            Roster
          </Button>
        </div>
      ) : (
        <Button variant="quiet" size="sm" onClick={() => goTo(m.group_id, '/group/pending')}>
          {m.status === 'pending' ? 'View request status' : 'View details'}
        </Button>
      )}
    </div>
  );
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { memberships, membership, setActiveGroupId } = useGroup();
  const [showAddOrg, setShowAddOrg] = useState(false);
  const [tourActive, setTourActive] = useState(false);

  const { data: profile } = useQuery({
    queryKey: queryKeys.myProfile(),
    queryFn: () => getMyProfile().then(({ profile: p }) => p),
  });
  const avatarUrl = profile?.avatar_url ?? null;
  const name = profile?.name ?? null;

  useEffect(() => {
    if (memberships.length > 0 && !hasTourSeen(DASHBOARD_TOUR_ID)) {
      setTourActive(true);
    }
  }, [memberships.length]);

  useEffect(() => {
    if (searchParams.get('tour') === '1' && memberships.length > 0) {
      setTourActive(true);
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        next.delete('tour');
        return next;
      }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, memberships.length]);

  const finishTour = () => {
    setTourActive(false);
    markTourSeen(DASHBOARD_TOUR_ID);
  };

  const goTo = (groupId: string, path: string) => {
    setActiveGroupId(groupId);
    navigate(path);
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center px-6 py-10">
      <header className="w-full max-w-3xl mb-6 flex items-center justify-between">
        <Link
          to="/"
          className="font-display text-xl font-semibold text-[color:var(--ss-ink-1)] tracking-wide"
        >
          sorora
        </Link>
        {memberships.length > 0 && (
          <button
            type="button"
            onClick={() => setTourActive(true)}
            className="text-sm text-[color:var(--ss-ink-5)] hover:text-[color:var(--ss-ink-2)] underline underline-offset-4"
          >
            Take the tour
          </button>
        )}
      </header>

      <section className="ss-frost w-full max-w-3xl rounded-[24px] px-6 py-10 md:px-12 md:py-12 shadow-card">
        <div className="flex items-center gap-4 mb-8" data-tour="dashboard-header">
          <div className="w-14 h-14 flex-shrink-0 rounded-full overflow-hidden bg-[color:var(--ss-pill-bg)] flex items-center justify-center border border-[color:var(--ss-surface-border)]">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xl font-display font-semibold text-[color:var(--ss-jade-deep)]">
                {(name || user?.email || '?').charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <div className="ss-kicker">Your chapters</div>
            <h1 className="font-display text-[32px] md:text-[40px] leading-[1.05] font-semibold text-[color:var(--ss-ink-1)]">
              {name ? `Hi, ${name.split(' ')[0]}.` : 'Your chapters, at a glance.'}
            </h1>
          </div>
        </div>

        {memberships.length === 0 && (
          <div className="ss-surface text-center text-[color:var(--ss-ink-4)] mb-6">
            You're not part of any chapter yet.{' '}
            <Link to="/group/onboarding" className="underline underline-offset-4 font-medium text-[color:var(--ss-ink-2)]">
              Get started
            </Link>
            .
          </div>
        )}

        <div className="flex flex-col gap-4" data-tour="dashboard-orgcards">
          {memberships.map(m => (
            <OrgCard key={m.id} m={m} active={m.group_id === membership?.group_id} goTo={goTo} />
          ))}
        </div>

        <div className="mt-6" data-tour="dashboard-addorg">
          {showAddOrg ? (
            <div className="ss-surface">
              <AddOrganizationForm
                onCreated={(groupId) => { setActiveGroupId(groupId); setShowAddOrg(false); }}
                onJoined={(groupId) => { setActiveGroupId(groupId); setShowAddOrg(false); }}
                onCancel={() => setShowAddOrg(false)}
              />
            </div>
          ) : (
            <Button variant="quiet" size="sm" fullWidth onClick={() => setShowAddOrg(true)}>
              + Add another chapter
            </Button>
          )}
        </div>
      </section>

      <OnboardingTour steps={DASHBOARD_TOUR_STEPS} active={tourActive} onFinish={finishTour} />
    </div>
  );
};

export default Dashboard;
