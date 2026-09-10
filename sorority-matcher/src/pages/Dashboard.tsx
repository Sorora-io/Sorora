import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useGroup } from '../contexts/GroupContext';
import AddOrganizationForm from '../components/AddOrganizationForm';
import OnboardingTour, { TourStep } from '../components/OnboardingTour';
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
  { label: 'Submission Status', path: '/group/status' },
  { label: 'Group Settings', path: '/group/settings' },
  { label: 'Pairings', path: '/group/pairings' },
];

interface AdminProgress {
  bigsSubmitted: number;
  bigsTotal: number;
  littlesSubmitted: number;
  littlesTotal: number;
}

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

  // Cached per group under react-query — so a card that was already shown
  // once (here, or on the Status/SubmitRanking pages that fetch the same
  // data) renders its real numbers immediately instead of a skeleton, and
  // a genuinely-stale beat is a quiet background refetch, not a blocking
  // loading state.
  const { data: statusRows, isLoading: progressLoading } = useQuery({
    queryKey: queryKeys.submissionStatus(m.group_id),
    queryFn: () => getSubmissionStatus(m.group_id).then(({ rows }) => rows),
    enabled: isAdmin,
  });

  const { data: rankedIds, isLoading: rankingLoading } = useQuery({
    queryKey: queryKeys.myRanking(m.group_id),
    queryFn: () => getMyRanking(m.group_id).then(({ rankedIds: ids }) => ids),
    enabled: isRanker,
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
    <span className={`inline-block h-3 ${width} bg-gray-100 rounded animate-pulse`} />
  );

  return (
    <div
      className={`bg-white rounded-lg shadow-sm p-5 border ${active ? 'border-jade-600' : 'border-transparent'}`}
    >
      <button
        type="button"
        onClick={() => goTo(m.group_id, m.status === 'approved' ? homeForRole(m) : '/group/pending')}
        className="w-full flex items-start justify-between mb-4 text-left hover:opacity-70 transition-opacity"
      >
        <div>
          <h3 className="text-lg font-semibold">{m.group.name}</h3>
          {m.group.school && <p className="text-sm text-gray-500">{m.group.school}</p>}
        </div>
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
          {roleLabel[m.role]}
          {m.is_admin && m.role !== 'admin' && ' + Admin'}
          {m.status !== 'approved' && ` · ${m.status}`}
        </span>
      </button>

      {m.group.description && (
        <p className="text-sm text-gray-600 mb-4 -mt-2">{m.group.description}</p>
      )}

      {m.status === 'approved' && isEffectiveAdmin(m) && (
        <div className="mb-4 -mt-2 flex flex-col gap-1">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Matching progress</p>
          {progressLoading || !adminProgress ? (
            <>{skeletonLine('w-40')}{skeletonLine('w-36')}</>
          ) : adminProgress.bigsTotal === 0 && adminProgress.littlesTotal === 0 ? (
            <p className="text-sm text-gray-500">No Bigs or Littles approved yet.</p>
          ) : (
            <>
              <p className="text-sm text-gray-700">
                {adminProgress.bigsSubmitted} of {adminProgress.bigsTotal} Bigs submitted
              </p>
              <p className="text-sm text-gray-700">
                {adminProgress.littlesSubmitted} of {adminProgress.littlesTotal} Littles submitted
              </p>
            </>
          )}
        </div>
      )}

      {m.status === 'approved' && (m.role === 'big' || m.role === 'little') && (
        <div className="mb-4 -mt-2">
          {rankingLoading || mySubmission === null ? (
            skeletonLine('w-56')
          ) : (
            <p
              className={`text-sm ${
                !mySubmission && m.group.ranking_deadline && m.group.ranking_deadline < todayISO
                  ? 'text-brick'
                  : mySubmission
                  ? 'text-jade-700'
                  : 'text-gold-700'
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
              <button
                onClick={() => goTo(m.group_id, '/group/submit-ranking')}
                className="px-3 py-2 text-sm border border-jade-300 rounded-md hover:bg-jade-50 transition-colors"
              >
                {rankingLoading || mySubmission === null
                  ? 'Rankings'
                  : mySubmission
                  ? 'Update Rankings'
                  : `Start Ranking ${m.role === 'big' ? 'Littles' : 'Bigs'}`}
              </button>
              <button
                onClick={() => goTo(m.group_id, '/group/notes')}
                className="px-3 py-2 text-sm border border-jade-300 rounded-md hover:bg-jade-50 transition-colors"
              >
                Notes
              </button>
            </>
          )}
          {isEffectiveAdmin(m) &&
            ADMIN_ACTIONS.map(a => (
              <button
                key={a.path}
                onClick={() => goTo(m.group_id, a.path)}
                className="px-3 py-2 text-sm border border-jade-300 rounded-md hover:bg-jade-50 transition-colors"
              >
                {a.label}
              </button>
            ))}
          <button
            onClick={() => goTo(m.group_id, '/group/roster')}
            className="px-3 py-2 text-sm border border-jade-300 rounded-md hover:bg-jade-50 transition-colors"
          >
            Roster
          </button>
        </div>
      ) : (
        <button
          onClick={() => goTo(m.group_id, '/group/pending')}
          className="px-3 py-2 text-sm border border-jade-300 rounded-md hover:bg-jade-50 transition-colors"
        >
          {m.status === 'pending' ? 'View request status' : 'View details'}
        </button>
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

  // First time a member with at least one org lands here, walk them
  // through the dashboard automatically; "Take a tour" (here, and in the
  // sidebar's Explore section via ?tour=1) lets anyone replay it later.
  useEffect(() => {
    if (memberships.length > 0 && !hasTourSeen(DASHBOARD_TOUR_ID)) {
      setTourActive(true);
    }
  }, [memberships.length]);

  useEffect(() => {
    if (searchParams.get('tour') === '1' && memberships.length > 0) {
      setTourActive(true);
      // Strip the param so refreshing the page doesn't re-trigger the tour.
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
    <div className="min-h-screen flex flex-col items-center p-8">
      <header className="mb-8">
        <Link to="/">
          <h1 className="text-4xl font-display font-semibold text-center text-jade-800">Sorora</h1>
        </Link>
      </header>

      <div className="max-w-2xl w-full flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3" data-tour="dashboard-header">
            <div className="w-10 h-10 flex-shrink-0 rounded-full overflow-hidden bg-jade-100 flex items-center justify-center">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-sm font-display font-semibold text-jade-700">
                  {(name || user?.email || '?').charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div>
              <h2 className="text-2xl font-semibold leading-tight">Your Organizations</h2>
              {name && <p className="text-sm text-gray-500">{name}</p>}
            </div>
          </div>
          {memberships.length > 0 && (
            <button
              type="button"
              onClick={() => setTourActive(true)}
              className="flex-shrink-0 text-xs text-gray-400 hover:text-gray-600 underline"
            >
              Take a tour
            </button>
          )}
        </div>

        {memberships.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm p-5 text-center text-gray-600">
            You're not part of any organization yet.{' '}
            <Link to="/group/onboarding" className="underline font-medium text-black">
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

        <div className="bg-white rounded-lg shadow-sm p-5" data-tour="dashboard-addorg">
          {showAddOrg ? (
            <AddOrganizationForm
              onCreated={(groupId) => { setActiveGroupId(groupId); setShowAddOrg(false); }}
              onJoined={(groupId) => { setActiveGroupId(groupId); setShowAddOrg(false); }}
              onCancel={() => setShowAddOrg(false)}
            />
          ) : (
            <button
              onClick={() => setShowAddOrg(true)}
              className="w-full py-2.5 border border-jade-300 rounded-md hover:bg-jade-50 transition-colors text-sm"
            >
              + Add Organization
            </button>
          )}
        </div>
      </div>

      <OnboardingTour steps={DASHBOARD_TOUR_STEPS} active={tourActive} onFinish={finishTour} />
    </div>
  );
};

export default Dashboard;
