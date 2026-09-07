import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useGroup } from '../contexts/GroupContext';
import { MembershipRole, isEffectiveAdmin } from '../lib/groups';

interface Props {
  allow: MembershipRole[];
  children: React.ReactElement;
}

interface RoleLike {
  role: MembershipRole;
  is_admin: boolean;
}

// Admin access no longer implies a big/little can't also hold it — a member
// "has" a given allowed role if it's their literal role, or if 'admin' is
// being asked for and they carry the is_admin flag (whatever their role).
const hasAnyRole = (membership: RoleLike, allow: MembershipRole[]) =>
  allow.includes(membership.role) || (allow.includes('admin') && isEffectiveAdmin(membership));

export const homeForRole = (membership: RoleLike) =>
  isEffectiveAdmin(membership) ? '/group/approvals' : '/group/submit-ranking';

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
  if (!hasAnyRole(membership, allow)) return <Navigate to={homeForRole(membership)} replace />;

  return children;
};

export default RequireGroupRole;
