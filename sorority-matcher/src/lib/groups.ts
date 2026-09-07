import { supabase } from './supabase';
import { generateJoinCode } from './joinCode';

export type MembershipRole = 'admin' | 'big' | 'little';
export type MembershipStatus = 'pending' | 'approved' | 'rejected';

export interface Group {
  id: string;
  name: string;
  school: string;
  description: string;
  join_code: string;
  min_big_rankings: number;
  min_little_rankings: number;
  created_by: string;
  owner_id: string;
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
  is_admin: boolean;
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

// Admin access is a flag independent of role now — role='admin' (legacy,
// admin-only membership) always carries it, but a big/little can be granted
// it too without giving up their big/little role.
export function isEffectiveAdmin(membership: { role: MembershipRole; is_admin: boolean }): boolean {
  return membership.role === 'admin' || membership.is_admin;
}

// Groups created before the school column existed default to an empty
// string there, so blindly interpolating "(school)" everywhere would show
// empty parens for them.
export function groupLabel(group: { name: string; school: string }): string {
  return group.school ? `${group.name} (${group.school})` : group.name;
}

const MAX_JOIN_CODE_ATTEMPTS = 5;

export async function createGroup(
  name: string,
  school: string
): Promise<{ group: Group | null; error: string | null }> {
  for (let attempt = 0; attempt < MAX_JOIN_CODE_ATTEMPTS; attempt++) {
    const joinCode = generateJoinCode();
    const { data, error } = await supabase.rpc('create_group', {
      p_name: name,
      p_school: school,
      p_join_code: joinCode,
    });
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
): Promise<{ group: { id: string; name: string; school: string } | null; error: string | null }> {
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

export async function getMyMemberships(): Promise<{
  memberships: MembershipWithGroup[];
  error: string | null;
}> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { memberships: [], error: null };

  const { data, error } = await supabase
    .from('memberships')
    .select('*, group:groups(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  if (error) return { memberships: [], error: error.message };
  return { memberships: (data ?? []) as unknown as MembershipWithGroup[], error: null };
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

export async function updateGroupProfile(
  groupId: string,
  name: string,
  school: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('groups').update({ name, school }).eq('id', groupId);
  return { error: error ? error.message : null };
}

export async function updateGroupDescription(groupId: string, description: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('groups').update({ description }).eq('id', groupId);
  return { error: error ? error.message : null };
}

export async function getApprovedRoleCounts(
  groupId: string
): Promise<{ bigs: number; littles: number; error: string | null }> {
  const { data, error } = await supabase
    .from('memberships')
    .select('role')
    .eq('group_id', groupId)
    .eq('status', 'approved')
    .in('role', ['big', 'little']);

  if (error) return { bigs: 0, littles: 0, error: error.message };
  const bigs = (data ?? []).filter(r => r.role === 'big').length;
  const littles = (data ?? []).filter(r => r.role === 'little').length;
  return { bigs, littles, error: null };
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

export interface GroupAdmin {
  user_id: string;
  role: MembershipRole;
  profile: Profile | null;
}

export async function getGroupAdmins(groupId: string): Promise<{ admins: GroupAdmin[]; error: string | null }> {
  const { data, error } = await supabase
    .from('memberships')
    .select('user_id, role, profile:profiles(email, name)')
    .eq('group_id', groupId)
    .eq('is_admin', true)
    .eq('status', 'approved');

  if (error) return { admins: [], error: error.message };
  return { admins: (data ?? []) as unknown as GroupAdmin[], error: null };
}

export interface GroupMember extends Membership {
  profile: Profile | null;
}

// Every approved member of a group, any role — used to grant/revoke admin
// access on someone without touching their big/little role.
export async function getGroupMembers(groupId: string): Promise<{ members: GroupMember[]; error: string | null }> {
  const { data, error } = await supabase
    .from('memberships')
    .select('*, profile:profiles(email, name)')
    .eq('group_id', groupId)
    .eq('status', 'approved');

  if (error) return { members: [], error: error.message };
  return { members: (data ?? []) as unknown as GroupMember[], error: null };
}

export async function setMemberAdmin(membershipId: string, isAdmin: boolean): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('set_member_admin', {
    p_membership_id: membershipId,
    p_is_admin: isAdmin,
  });
  return { error: error ? error.message : null };
}

export async function transferGroupOwnership(
  groupId: string,
  newOwnerId: string
): Promise<{ group: Group | null; error: string | null }> {
  const { data, error } = await supabase.rpc('transfer_group_ownership', {
    p_group_id: groupId,
    p_new_owner_id: newOwnerId,
  });
  if (error) return { group: null, error: error.message };
  return { group: data as Group, error: null };
}
