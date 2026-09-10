import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useGroup } from '../../contexts/GroupContext';
import { homeForRole } from '../../components/RequireGroupRole';
import { groupLabel } from '../../lib/groups';

const roleLabel: Record<string, string> = { admin: 'Admin', big: 'Big', little: 'Little' };

const Pending = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { membership, loading, refresh } = useGroup();

  useEffect(() => {
    if (loading) return;
    if (!membership) {
      navigate('/group/onboarding', { replace: true });
    } else if (membership.status === 'approved') {
      navigate(homeForRole(membership), { replace: true });
    }
  }, [loading, membership, navigate]);

  const rejected = membership?.status === 'rejected';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <header className="mb-12">
        <Link to="/">
          <h1 className="text-4xl font-display font-semibold text-center text-jade-800">Sorora</h1>
        </Link>
      </header>

      <div className="max-w-md w-full bg-white rounded-lg shadow-sm p-5 text-center">
        {rejected ? (
          <>
            <h2 className="text-2xl font-semibold mb-4">Request not approved</h2>
            <p className="text-gray-600 mb-6">
              Your request to join{' '}
              <span className="font-medium">
                {membership && groupLabel(membership.group)}
              </span>{' '}
              as{' '}
              {roleLabel[membership?.role ?? '']} was not approved. Contact your chapter's admin if you
              think this is a mistake.
            </p>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-semibold mb-4">Waiting on approval</h2>
            <p className="text-gray-600 mb-6">
              Your request to join{' '}
              <span className="font-medium">
                {membership && groupLabel(membership.group)}
              </span>{' '}
              as{' '}
              {roleLabel[membership?.role ?? '']} is waiting on your chapter admin to approve it. Check
              back soon.
            </p>
          </>
        )}
        <div className="flex flex-col gap-3">
          <button
            onClick={refresh}
            className="w-full py-2.5 border border-jade-300 rounded-md hover:bg-jade-50 transition-colors"
          >
            Check again
          </button>
          <button
            onClick={signOut}
            className="w-full py-2.5 bg-jade-600 text-white rounded-md hover:bg-jade-700 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
};

export default Pending;
