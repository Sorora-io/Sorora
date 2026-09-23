import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { getSuperuserAccess } from '../lib/superusers';

export function useSuperuser() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['superuser', user?.id],
    queryFn: getSuperuserAccess,
    enabled: !!user,
    staleTime: 0,
    refetchOnWindowFocus: true,
    retry: false,
  });
}
