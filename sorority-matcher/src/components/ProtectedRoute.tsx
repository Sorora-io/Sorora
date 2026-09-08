import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoadingScreen from './LoadingScreen';

const ProtectedRoute = ({ children }: { children: React.ReactElement }) => {
  const { user, loading, isGuest } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user && !isGuest) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;
