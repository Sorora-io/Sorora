import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { getMyProfile } from '../lib/profile';
import { queryKeys } from '../lib/queryKeys';

export const useMyProfile = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.myProfile(user?.id ?? ''),
    enabled: !!user,
    queryFn: async () => {
      const { profile, error } = await getMyProfile();
      if (error || !profile) throw new Error(error || 'Profile not found');
      return profile;
    },
  });
};
