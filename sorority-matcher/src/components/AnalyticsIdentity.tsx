import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useGroup } from '../contexts/GroupContext';
import { useMyProfile } from '../hooks/useMyProfile';
import { identifyUser, initializeAnalytics, isAnalyticsEnabled, resetAnalyticsSession, setUserProperties } from '../lib/analytics';

// Identity is wired here, outside AuthContext, so GroupContext and the profile
// query are available for the People properties (name/email/role/chapter).
export default function AnalyticsIdentity() {
  const { user, loading: authLoading } = useAuth();
  const { membership } = useGroup();
  const { data: profile } = useMyProfile();
  useEffect(() => {
    if (authLoading) return;
    if (!user) { resetAnalyticsSession(); return; }
    if (!isAnalyticsEnabled() || !initializeAnalytics()) return;
    identifyUser(user.id);
    const metadataName = typeof user.user_metadata?.name === 'string' ? user.user_metadata.name : undefined;
    setUserProperties({
      name: profile?.name ?? metadataName,
      email: user.email,
      role: membership?.role,
      is_admin: membership?.is_admin,
      chapter: membership?.group.name,
    });
  }, [authLoading, user, profile, membership]);
  return null;
}
