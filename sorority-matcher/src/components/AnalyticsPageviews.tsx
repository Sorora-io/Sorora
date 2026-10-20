import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { initializeAnalytics, trackPage } from '../lib/analytics';

export default function AnalyticsPageviews() {
  const { loading } = useAuth();
  const { pathname } = useLocation();
  useEffect(() => {
    if (!loading && initializeAnalytics()) trackPage(pathname);
  }, [loading, pathname]);
  return null;
}
