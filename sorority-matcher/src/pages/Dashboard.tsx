import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useGroup } from '../contexts/GroupContext';
import AddOrganizationForm from '../components/AddOrganizationForm';
import { homeForRole } from '../components/RequireGroupRole';
import { isEffectiveAdmin, MembershipWithGroup } from '../lib/groups';
import { getSubmissionStatus, getMyRanking } from '../lib/rankings';
import { getMyProfile } from '../lib/profile';

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
  const [adminProgress, setAdminProgress] = useState<AdminProgress | null>(null);
  const [mySubmission, setMySubmission] = useState<boolean | null>(null);

  useEffect(() => {
    if (m.status !== 'approved') return;

    if (isEffectiveAdmin(m)) {
      getSubmissionStatus(m.group_id).then(({ rows }) => {
        const bigs = rows.filter(r => r.role === 'big');
        const littles = rows.filter(r => r.role === 'little');
        setAdminProgress({
          bigsSubmitted: bigs.filter(r => r.submitted).length,
          bigsTotal: bigs.length,
          littlesSubmitted: littles.filter(r => r.submitted).length,
          littlesTotal: littles.length,
        });
      });
    }

    if (m.role === 'big' || m.role === 'little') {
      getMyRanking(m.group_id).then(({ rankedIds }) => setMySubmission(rankedIds.length > 0));
    }
  }, [m]);

  return (
    <div
      className={`bg-white rounded-lg shadow-lg p-6 border-2 ${active ? 'border-jade-600' : 'border-transparent'}`}
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

      {m.status === 'approved' && adminProgress && (
        <div className="mb-4 -mt-2 flex flex-col gap-1">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Matching progress</p>
          {adminProgress.bigsTotal === 0 && adminProgress.littlesTotal === 0 ? (
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

      {m.status === 'approved' && mySubmission !== null && (m.role === 'big' || m.role === 'little') && (
        <p
          className={`text-sm mb-4 -mt-2 ${
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

      {m.status === 'approved' ? (
        <div className="flex flex-wrap gap-2">
          {(m.role === 'big' || m.role === 'little') && (
            <>
              <button
                onClick={() => goTo(m.group_id, '/group/submit-ranking')}
                className="px-3 py-2 text-sm border-2 border-jade-300 rounded-md hover:bg-jade-50 transition-colors"
              >
                {mySubmission ? 'Update Rankings' : `Start Ranking ${m.role === 'big' ? 'Littles' : 'Bigs'}`}
              </button>
              <button
                onClick={() => goTo(m.group_id, '/group/notes')}
                className="px-3 py-2 text-sm border-2 border-jade-300 rounded-md hover:bg-jade-50 transition-colors"
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
                className="px-3 py-2 text-sm border-2 border-jade-300 rounded-md hover:bg-jade-50 transition-colors"
              >
                {a.label}
              </button>
            ))}
          <button
            onClick={() => goTo(m.group_id, '/group/roster')}
            className="px-3 py-2 text-sm border-2 border-jade-300 rounded-md hover:bg-jade-50 transition-colors"
          >
            Roster
          </button>
        </div>
      ) : (
        <button
          onClick={() => goTo(m.group_id, '/group/pending')}
          className="px-3 py-2 text-sm border-2 border-jade-300 rounded-md hover:bg-jade-50 transition-colors"
        >
          {m.status === 'pending' ? 'View request status' : 'View details'}
        </button>
      )}
    </div>
  );
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { memberships, membership, setActiveGroupId } = useGroup();
  const [showAddOrg, setShowAddOrg] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    getMyProfile().then(({ profile }) => {
      if (profile) {
        setAvatarUrl(profile.avatar_url);
        setName(profile.name);
      }
    });
  }, []);

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
        <div className="flex items-center gap-3">
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

        {memberships.length === 0 && (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center text-gray-600">
            You're not part of any organization yet.{' '}
            <Link to="/group/onboarding" className="underline font-medium text-black">
              Get started
            </Link>
            .
          </div>
        )}

        {memberships.map(m => (
          <OrgCard key={m.id} m={m} active={m.group_id === membership?.group_id} goTo={goTo} />
        ))}

        <div className="bg-white rounded-lg shadow-lg p-6">
          {showAddOrg ? (
            <AddOrganizationForm
              onCreated={(groupId) => { setActiveGroupId(groupId); setShowAddOrg(false); }}
              onJoined={(groupId) => { setActiveGroupId(groupId); setShowAddOrg(false); }}
              onCancel={() => setShowAddOrg(false)}
            />
          ) : (
            <button
              onClick={() => setShowAddOrg(true)}
              className="w-full py-3 border-2 border-jade-300 rounded-md hover:bg-jade-50 transition-colors text-sm"
            >
              + Add Organization
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
