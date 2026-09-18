import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useGroup } from '../contexts/GroupContext';
import LoadingScreen from './LoadingScreen';

// Historical name — kept the same as the route wiring so the App shell
// diff stays readable. Same job as ProtectedRoute now that guest mode is
// gone: block unsigned-in visitors.
const RequireRealAccount = ({ children }: { children: React.ReactElement }) => {
  const { user, loading } = useAuth();
  const { initialized } = useGroup();

  if (loading || (user && !initialized)) {
    return <LoadingScreen />;
  }

  if (!user) return <Navigate to="/login" replace />;

  return children;
};

export default RequireRealAccount;
