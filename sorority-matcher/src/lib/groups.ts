import { supabase } from './supabase';
import { generateJoinCode } from './joinCode';

export type MembershipRole = 'admin' | 'big' | 'little';
export type MembershipStatus = 'pending' | 'approved' | 'rejected';

export interface Group {
  id: string;
  name: string;
  join_code: string;
  min_big_rankings: number;
  min_little_rankings: number;
  created_by: string;
  created_at: string;
}

export interface Membership {
  id: string;
  group_id: string;
  user_id: string;
  role: MembershipRole;
  status: MembershipStatus;
  willing_to_take_twins: boolean;
  requested_role: MembershipRole | null;
  created_at: string;
}

export interface MembershipWithGroup extends Membership {
  group: Group;
}

export interface Profile {
  email: string;
  name: string | null;
}

export interface PendingMembership extends Membership {
  profile: Profile | null;
}

const MAX_JOIN_CODE_ATTEMPTS = 5;

export async function createGroup(name: string): Promise<{ group: Group | null; error: string | null }> {
  for (let attempt = 0; attempt < MAX_JOIN_CODE_ATTEMPTS; attempt++) {
    const joinCode = generateJoinCode();
    const { data, error } = await supabase.rpc('create_group', { p_name: name, p_join_code: joinCode });
    if (!error) {
      return { group: data as Group, error: null };
    }
    if (error.code === '23505') continue; // join_code collision, retry with a fresh one
    return { group: null, error: error.message };
  }
  return { group: null, error: 'Could not generate a unique join code. Please try again.' };
}

export async function findGroupByJoinCode(
  code: string
): Promise<{ group: { id: string; name: string } | null; error: string | null }> {
  const { data, error } = await supabase.rpc('find_group_by_code', { p_code: code.trim().toUpperCase() });
  if (error) return { group: null, error: error.message };
  const match = Array.isArray(data) ? data[0] : null;
  if (!match) return { group: null, error: 'No group found with that code.' };
  return { group: match, error: null };
}

export async function requestToJoinGroup(
  groupId: string,
  role: MembershipRole
): Promise<{ error: string | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not signed in.' };

  const { error } = await supabase.from('memberships').insert({
    group_id: groupId,
    user_id: user.id,
    role,
    status: 'pending',
  });
  return { error: error ? error.message : null };
}

export async function getMyMembership(): Promise<{
  membership: MembershipWithGroup | null;
  error: string | null;
}> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { membership: null, error: null };

  const { data, error } = await supabase
    .from('memberships')
    .select('*, group:groups(*)')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  if (error) return { membership: null, error: error.message };
  return { membership: data as unknown as MembershipWithGroup | null, error: null };
}

export async function getPendingMemberships(
  groupId: string
): Promise<{ memberships: PendingMembership[]; error: string | null }> {
  const { data, error } = await supabase
    .from('memberships')
    .select('*, profile:profiles(email, name)')
    .eq('group_id', groupId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) return { memberships: [], error: error.message };
  return { memberships: (data ?? []) as unknown as PendingMembership[], error: null };
}

export async function updateMembershipStatus(
  membershipId: string,
  status: 'approved' | 'rejected'
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('memberships').update({ status }).eq('id', membershipId);
  return { error: error ? error.message : null };
}

export async function updateGroupSettings(
  groupId: string,
  minBigRankings: number,
  minLittleRankings: number
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('groups')
    .update({ min_big_rankings: minBigRankings, min_little_rankings: minLittleRankings })
    .eq('id', groupId);
  return { error: error ? error.message : null };
}

export async function setMyTwinWillingness(groupId: string, willing: boolean): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('set_my_twin_willingness', { p_group_id: groupId, p_willing: willing });
  return { error: error ? error.message : null };
}

export async function requestRoleChange(
  groupId: string,
  requestedRole: MembershipRole
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('request_role_change', {
    p_group_id: groupId,
    p_requested_role: requestedRole,
  });
  return { error: error ? error.message : null };
}

export interface RoleChangeRequest extends Membership {
  profile: Profile | null;
}

export async function getPendingRoleChanges(
  groupId: string
): Promise<{ requests: RoleChangeRequest[]; error: string | null }> {
  const { data, error } = await supabase
    .from('memberships')
    .select('*, profile:profiles(email, name)')
    .eq('group_id', groupId)
    .eq('status', 'approved')
    .not('requested_role', 'is', null);

  if (error) return { requests: [], error: error.message };
  return { requests: (data ?? []) as unknown as RoleChangeRequest[], error: null };
}

export async function resolveRoleChange(
  membershipId: string,
  approve: boolean,
  requestedRole: MembershipRole
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('memberships')
    .update(approve ? { role: requestedRole, requested_role: null } : { requested_role: null })
    .eq('id', membershipId);
  return { error: error ? error.message : null };
}
