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
  ranking_deadline: string | null;
  created_by: string;
  owner_id: string;
  active_cycle_id: string | null;
  created_at: string;
}

export interface Cycle {
  id: string;
  group_id: string;
  label: string;
  started_at: string;
  ended_at: string | null;
  created_by: string | null;
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
  // Routed through a SECURITY DEFINER function (not a raw .update()) so
  // approving a request for role='admin' also sets is_admin — otherwise
  // the approved member gets admin nav links that silently fail, since
  // is_group_admin() checks is_admin, not role.
  const { error } = await supabase.rpc('approve_membership', {
    p_membership_id: membershipId,
    p_approve: status === 'approved',
  });
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

export async function updateGroupDeadline(groupId: string, deadline: string | null): Promise<{ error: string | null }> {
  const { error } = await supabase.from('groups').update({ ranking_deadline: deadline }).eq('id', groupId);
  return { error: error ? error.message : null };
}

// Every past and present cycle for a group, newest first — any member can
// see the list (RLS), though only rankings/pairings tied to a cycle carry
// the actual data.
export async function getGroupCycles(groupId: string): Promise<{ cycles: Cycle[]; error: string | null }> {
  const { data, error } = await supabase
    .from('cycles')
    .select('*')
    .eq('group_id', groupId)
    .order('started_at', { ascending: false });
  if (error) return { cycles: [], error: error.message };
  return { cycles: (data ?? []) as Cycle[], error: null };
}

// Closes whatever cycle is currently active (if any) and starts a new
// one, atomically — see start_cycle() in supabase/migrations for why this
// is a security-definer RPC rather than a couple of raw .update() calls.
export async function startCycle(groupId: string, label: string): Promise<{ cycle: Cycle | null; error: string | null }> {
  const { data, error } = await supabase.rpc('start_cycle', { p_group_id: groupId, p_label: label });
  if (error) return { cycle: null, error: error.message };
  return { cycle: data as Cycle, error: null };
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
  // Same reasoning as approve_membership — approving a change to
  // role='admin' must also grant is_admin, or the member ends up with
  // admin nav links but no actual admin access.
  const { error } = await supabase.rpc('resolve_role_change', {
    p_membership_id: membershipId,
    p_approve: approve,
    p_requested_role: requestedRole,
  });
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

// Removes an approved member from the chapter (they graduated, left, etc.)
// without touching their Sorora account — only this chapter's data about
// them. Blocked server-side if they're the owner (transfer first).
export async function removeMember(membershipId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('remove_member', { p_membership_id: membershipId });
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
