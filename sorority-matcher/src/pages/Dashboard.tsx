import { Link, useNavigate } from 'react-router-dom';
import { useGroup } from '../contexts/GroupContext';

const roleLabel: Record<string, string> = { admin: 'Admin', big: 'Big', little: 'Little' };

const ADMIN_ACTIONS = [
  { label: 'Approvals', path: '/group/approvals' },
  { label: 'Submission Status', path: '/group/status' },
  { label: 'Group Settings', path: '/group/settings' },
  { label: 'Pairings', path: '/group/pairings' },
];

const Dashboard = () => {
  const navigate = useNavigate();
  const { memberships, membership, setActiveGroupId } = useGroup();

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
        <h2 className="text-2xl font-semibold">Your Organizations</h2>

        {memberships.length === 0 && (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center text-gray-600">
            You're not part of any organization yet.{' '}
            <Link to="/group/onboarding" className="underline font-medium text-black">
              Get started
            </Link>
            .
          </div>
        )}

        {memberships.map(m => {
          const active = m.group_id === membership?.group_id;
          return (
            <div
              key={m.id}
              className={`bg-white rounded-lg shadow-lg p-6 border-2 ${
                active ? 'border-jade-600' : 'border-transparent'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold">{m.group.name}</h3>
                  {m.group.school && <p className="text-sm text-gray-500">{m.group.school}</p>}
                </div>
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  {roleLabel[m.role]}
                  {m.status !== 'approved' && ` · ${m.status}`}
                </span>
              </div>

              {m.status === 'approved' ? (
                <div className="flex flex-wrap gap-2">
                  {m.role === 'admin' ? (
                    ADMIN_ACTIONS.map(a => (
                      <button
                        key={a.path}
                        onClick={() => goTo(m.group_id, a.path)}
                        className="px-3 py-2 text-sm border-2 border-jade-300 rounded-md hover:bg-jade-50 transition-colors"
                      >
                        {a.label}
                      </button>
                    ))
                  ) : (
                    <button
                      onClick={() => goTo(m.group_id, '/group/submit-ranking')}
                      className="px-3 py-2 text-sm border-2 border-jade-300 rounded-md hover:bg-jade-50 transition-colors"
                    >
                      Rank {m.role === 'big' ? 'Littles' : 'Bigs'}
                    </button>
                  )}
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
        })}
      </div>
    </div>
  );
};

export default Dashboard;
