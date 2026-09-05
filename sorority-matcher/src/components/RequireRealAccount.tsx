import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// Guests use the old localStorage-backed /admin/* sandbox, not the
// group/database-backed flow — so guests get redirected away from here
// rather than falling through to onboarding.
const RequireRealAccount = ({ children }: { children: React.ReactElement }) => {
  const { user, loading, isGuest } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (isGuest) return <Navigate to="/admin/enter-bigs" replace />;

  return children;
};

export default RequireRealAccount;
