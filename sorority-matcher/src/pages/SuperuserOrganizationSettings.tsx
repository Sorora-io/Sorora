import { useCallback } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { useGroup } from '../contexts/GroupContext';
import { useSuperuser } from '../hooks/useSuperuser';
import { getSuperuserOrganizationSettings } from '../lib/superusers';
import Button from '../components/Button';
import LoadingScreen from '../components/LoadingScreen';
import Settings from './group/Settings';

export default function SuperuserOrganizationSettings() {
  const { user, loading } = useAuth();
  const { refresh: refreshMemberships } = useGroup();
  const { groupId = '' } = useParams();
  const navigate = useNavigate();
  const access = useSuperuser();
  const client = useQueryClient();
  const settings = useQuery({
    queryKey: ['superuser-organization-settings', user?.id, groupId],
    queryFn: () => getSuperuserOrganizationSettings(groupId),
    enabled: !!user && access.data === true && !!groupId,
    retry: false, staleTime: 0,
  });
  const { refetch: refetchSettings } = settings;
  const refresh = useCallback(async () => {
    const result = await refetchSettings();
    if (result.error) throw result.error;
    await client.invalidateQueries({ queryKey: ['superuser-organizations'] });
    await refreshMemberships();
  }, [refetchSettings, client, refreshMemberships]);
  if (loading || (!!user && access.isPending)) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  const back = <Button variant="quiet" size="sm" onClick={() => navigate('/superuser?view=organizations')}>Back to organizations</Button>;
  if (access.error) return <div className="p-8" role="alert">Could not verify superuser access. <Button onClick={() => void access.refetch()}>Retry access</Button>{back}</div>;
  if (!access.data) return <div className="p-8"><h1>Superuser access required</h1>{back}</div>;
  if (settings.isPending) return <LoadingScreen />;
  if (settings.error || !settings.data) return <div className="p-8" role="alert"><p>Could not load organization settings: {settings.error?.message || 'Organization not found.'}</p><Button onClick={() => void settings.refetch()}>Retry settings</Button>{back}</div>;
  // The explicit URL target owns this editor; never replace the active membership.
  return <Settings key={`${user.id}:${groupId}`} superuserContext={{ ...settings.data, refresh }} />;
}
