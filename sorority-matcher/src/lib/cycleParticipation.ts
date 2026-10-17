import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
export interface CycleParticipation {
  excludedIds: string[];
  locked: boolean;
  version: string;
  history: { userId: string; excluded: boolean; actor: string; at: string }[];
  pairings: { bigId: string; littleId: string }[];
}
export function useCycleParticipation(userId: string, groupId?: string, cycleId?: string | null) {
  return useQuery<CycleParticipation>({
    queryKey: ['user', userId, 'cycle-participation', groupId, cycleId],
    enabled: !!groupId && !!cycleId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_cycle_participation', { p_group_id: groupId, p_cycle_id: cycleId });
      if (error) throw new Error(error.message);
      return data as CycleParticipation;
    },
    staleTime: 0,
  });
}
export async function setCycleParticipation(groupId: string, cycleId: string, userId: string, excluded: boolean, removePairings: boolean, version?: string) {
  const { error } = await supabase.rpc('set_cycle_participation', {
    p_group_id: groupId, p_cycle_id: cycleId, p_user_id: userId,
    p_excluded: excluded, p_remove_pairings: removePairings, p_expected_version: version ?? null,
  });
  if (error) throw new Error(error.message);
}
