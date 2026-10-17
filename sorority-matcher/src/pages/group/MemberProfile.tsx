import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Button from '../../components/Button';
import Avatar from '../../components/Avatar';
import { useAuth } from '../../contexts/AuthContext';
import { useGroup } from '../../contexts/GroupContext';
import { getRosterProfile } from '../../lib/profile';

export default function MemberProfile() {
  const { user } = useAuth();
  const { membership } = useGroup();
  const { memberId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const groupId = membership?.group_id;
  const allowed = !!user && membership?.status === 'approved' && !!groupId && !!memberId;
  const query = useQuery({
    queryKey: ['roster-profile', user?.id, groupId, memberId],
    queryFn: () => getRosterProfile(groupId!, memberId!),
    enabled: allowed, staleTime: 0, gcTime: 0, retry: false,
  });
  const profile = allowed && !query.isFetching && !query.isError && !query.data?.error ? query.data?.profile : null;
  return <div className="w-full max-w-2xl mx-auto px-5 py-8">
    <Button variant="outline" size="sm" onClick={() => navigate(params.get('from') === 'dashboard' ? '/dashboard?tab=roster' : '/group/roster')}>Back to roster</Button>
    {allowed && query.isFetching ? <p role="status" className="mt-6">Loading profile…</p>
      : allowed && (query.isError || query.data?.error) ? <div role="alert" className="ss-surface mt-6"><p>Could not load this profile. Please try again.</p><Button variant="quiet" className="mt-4" onClick={() => void query.refetch()}>Try again</Button></div>
      : !profile ? <div className="ss-surface mt-6"><h1 className="text-2xl">Profile unavailable</h1><p className="mt-3">This member’s profile is not available in your current chapter.</p></div>
      : <article className="ss-surface mt-6">
        <div className="flex items-center gap-4 min-w-0"><Avatar src={profile.avatar_url} name={profile.name} email={profile.email} size="xl" /><h1 className="text-2xl break-words min-w-0">{profile.name || profile.email}</h1></div>
        <p className="mt-4 text-sm break-words">{[profile.major, profile.college, profile.year && `Class of ${profile.year}`, profile.hometown].filter(Boolean).join(' · ')}</p>
        <h2 className="text-lg mt-6">Bio</h2>
        <p className="mt-2 whitespace-pre-wrap break-words">{profile.bio?.trim() ? profile.bio : 'No bio added yet.'}</p>
      </article>}
  </div>;
}
