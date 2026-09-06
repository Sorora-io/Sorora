import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useGroup } from '../contexts/GroupContext';
import { MembershipRole } from '../lib/groups';

interface Props {
  allow: MembershipRole[];
  children: React.ReactElement;
}

export const homeForRole = (role: MembershipRole) =>
  role === 'admin' ? '/group/approvals' : '/group/submit-ranking';

// Gates a /group/* page behind: signed in with a real account (not guest),
// has an approved membership, and their role is one of `allow`. Anything
// short of that redirects to wherever they actually belong.
const RequireGroupRole = ({ allow, children }: Props) => {
  const { user, loading: authLoading, isGuest } = useAuth();
  const { membership, initialized } = useGroup();

  if (authLoading || !initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (isGuest) return <Navigate to="/admin/enter-bigs" replace />;
  if (!membership) return <Navigate to="/group/onboarding" replace />;
  if (membership.status !== 'approved') return <Navigate to="/group/pending" replace />;
  if (!allow.includes(membership.role)) return <Navigate to={homeForRole(membership.role)} replace />;

  return children;
};

export default RequireGroupRole;
