import { supabase } from './supabase';
import { MembershipRole, Profile } from './groups';

export interface RosterMember {
  avatarUrl?: string | null;
  userId: string;
  name: string | null;
  email: string;
}

export interface SubmissionStatusRow extends RosterMember {
  role: MembershipRole;
  submitted: boolean;
}

export interface PairingRow {
  bigId: string;
  bigName: string | null;
  littleId: string;
  littleName: string | null;
}

export async function getRoster(
  groupId: string,
  role: MembershipRole
): Promise<{ roster: RosterMember[]; error: string | null }> {
  const { data, error } = await supabase
    .from('memberships')
    .select('user_id, profile:profiles(email, name, avatar_url)')
    .eq('group_id', groupId)
    .eq('role', role)
    .eq('status', 'approved');

  if (error) return { roster: [], error: error.message };

  const roster = (data ?? []).map((row: any) => ({
    avatarUrl: (row.profile as Profile | null)?.avatar_url ?? null,
    userId: row.user_id as string,
    name: (row.profile as Profile | null)?.name ?? null,
    email: (row.profile as Profile | null)?.email ?? '',
  }));
  return { roster, error: null };
}

// A cycle-less group (shouldn't happen post-migration, but a defensive
// caller can hit this before the group's active_cycle_id has loaded) has
// nothing to rank yet.
export async function getMyRanking(
  cycleId: string | null
): Promise<{ rankedIds: string[]; error: string | null }> {
  if (!cycleId) return { rankedIds: [], error: null };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { rankedIds: [], error: null };

  const { data, error } = await supabase
    .from('rankings')
    .select('ranked_ids')
    .eq('cycle_id', cycleId)
    .eq('ranker_id', user.id)
    .maybeSingle();

  if (error) return { rankedIds: [], error: error.message };
  return { rankedIds: (data?.ranked_ids as string[] | undefined) ?? [], error: null };
}

export async function submitRanking(
  groupId: string,
  cycleId: string,
  rankedIds: string[]
): Promise<{ error: string | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not signed in.' };

  const { error } = await supabase
    .from('rankings')
    .upsert(
      {
        group_id: groupId,
        cycle_id: cycleId,
        ranker_id: user.id,
        ranked_ids: rankedIds,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'cycle_id,ranker_id' }
    );
  return { error: error ? error.message : null };
}

export interface RosterEntry extends RosterMember {
  role: MembershipRole;
  isAdmin: boolean;
  avatarUrl: string | null;
  major: string | null;
  college: string | null;
  year: string | null;
  hometown: string | null;
}

interface RosterProfile extends Profile {
  avatar_url: string | null;
  major: string | null;
  college: string | null;
  year: string | null;
  hometown: string | null;
}

// All approved members of a group, any role — used for the roster page any
// member can view, unlike getRoster() above which is scoped to one role for
// building someone's ranking list.
export async function getFullRoster(groupId: string): Promise<{ roster: RosterEntry[]; error: string | null }> {
  const { data, error } = await supabase
    .from('memberships')
    .select('user_id, role, is_admin, profile:profiles(email, name, avatar_url, major, college, year, hometown)')
    .eq('group_id', groupId)
    .eq('status', 'approved');

  if (error) return { roster: [], error: error.message };

  const roster = (data ?? []).map((row: any) => {
    const profile = row.profile as RosterProfile | null;
    return {
      userId: row.user_id as string,
      role: row.role as MembershipRole,
      isAdmin: row.is_admin as boolean,
      name: profile?.name ?? null,
      email: profile?.email ?? '',
      avatarUrl: profile?.avatar_url ?? null,
      major: profile?.major ?? null,
      college: profile?.college ?? null,
      year: profile?.year ?? null,
      hometown: profile?.hometown ?? null,
    };
  });
  return { roster, error: null };
}

export async function getSubmissionStatus(
  groupId: string,
  cycleId: string | null
): Promise<{ rows: SubmissionStatusRow[]; error: string | null }> {
  if (!cycleId) return { rows: [], error: null };
  const { data, error } = await supabase.rpc('get_blind_submission_status', {
    p_group_id: groupId,
    p_cycle_id: cycleId,
  });
  if (error) return { rows: [], error: error.message };
  return {
    rows: (data ?? []).map((row: any) => ({
      userId: row.user_id, role: row.role, name: row.name,
      email: row.email, submitted: row.submitted,
    })),
    error: null,
  };
}

// Only final pairings leave the database; the admin's browser never receives
// another member's ordered preferences, even while running matching.
export async function runMatching(groupId: string, cycleId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('run_blind_matching', {
    p_group_id: groupId,
    p_cycle_id: cycleId,
  });
  return { error: error?.message ?? null };
}

export async function getPairings(cycleId: string): Promise<{ pairings: PairingRow[]; error: string | null }> {
  const { data, error } = await supabase
    .from('pairings')
    .select(
      'big_id, little_id, big:profiles!pairings_big_id_fkey(name), little:profiles!pairings_little_id_fkey(name)'
    )
    .eq('cycle_id', cycleId);

  if (error) return { pairings: [], error: error.message };

  const pairings = (data ?? []).map((row: any) => ({
    bigId: row.big_id as string,
    bigName: (row.big as { name: string | null } | null)?.name ?? null,
    littleId: row.little_id as string,
    littleName: (row.little as { name: string | null } | null)?.name ?? null,
  }));
  return { pairings, error: null };
}
