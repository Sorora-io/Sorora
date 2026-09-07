import { supabase } from './supabase';
import { runDeferredAcceptance, PreferenceMap } from './matching';
import { MembershipRole, Profile } from './groups';

export interface RosterMember {
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
    .select('user_id, profile:profiles(email, name)')
    .eq('group_id', groupId)
    .eq('role', role)
    .eq('status', 'approved');

  if (error) return { roster: [], error: error.message };

  const roster = (data ?? []).map((row: any) => ({
    userId: row.user_id as string,
    name: (row.profile as Profile | null)?.name ?? null,
    email: (row.profile as Profile | null)?.email ?? '',
  }));
  return { roster, error: null };
}

export async function getMyRanking(
  groupId: string
): Promise<{ rankedIds: string[]; error: string | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { rankedIds: [], error: null };

  const { data, error } = await supabase
    .from('rankings')
    .select('ranked_ids')
    .eq('group_id', groupId)
    .eq('ranker_id', user.id)
    .maybeSingle();

  if (error) return { rankedIds: [], error: error.message };
  return { rankedIds: (data?.ranked_ids as string[] | undefined) ?? [], error: null };
}

export async function submitRanking(
  groupId: string,
  rankedIds: string[]
): Promise<{ error: string | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not signed in.' };

  const { error } = await supabase
    .from('rankings')
    .upsert(
      { group_id: groupId, ranker_id: user.id, ranked_ids: rankedIds, updated_at: new Date().toISOString() },
      { onConflict: 'group_id,ranker_id' }
    );
  return { error: error ? error.message : null };
}

export interface RosterEntry extends RosterMember {
  role: MembershipRole;
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
    .select('user_id, role, profile:profiles(email, name, avatar_url, major, college, year, hometown)')
    .eq('group_id', groupId)
    .eq('status', 'approved');

  if (error) return { roster: [], error: error.message };

  const roster = (data ?? []).map((row: any) => {
    const profile = row.profile as RosterProfile | null;
    return {
      userId: row.user_id as string,
      role: row.role as MembershipRole,
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
  groupId: string
): Promise<{ rows: SubmissionStatusRow[]; error: string | null }> {
  const [membersRes, rankingsRes] = await Promise.all([
    supabase
      .from('memberships')
      .select('user_id, role, profile:profiles(email, name)')
      .eq('group_id', groupId)
      .eq('status', 'approved')
      .in('role', ['big', 'little']),
    supabase.from('rankings').select('ranker_id').eq('group_id', groupId),
  ]);

  if (membersRes.error) return { rows: [], error: membersRes.error.message };
  if (rankingsRes.error) return { rows: [], error: rankingsRes.error.message };

  const submitted = new Set((rankingsRes.data ?? []).map(r => r.ranker_id as string));

  const rows: SubmissionStatusRow[] = (membersRes.data ?? []).map((row: any) => ({
    userId: row.user_id as string,
    role: row.role as MembershipRole,
    name: (row.profile as Profile | null)?.name ?? null,
    email: (row.profile as Profile | null)?.email ?? '',
    submitted: submitted.has(row.user_id as string),
  }));

  return { rows, error: null };
}

export async function runMatching(groupId: string): Promise<{ error: string | null }> {
  const [bigsRes, littlesRes, rankingsRes] = await Promise.all([
    supabase
      .from('memberships')
      .select('user_id, willing_to_take_twins')
      .eq('group_id', groupId)
      .eq('role', 'big')
      .eq('status', 'approved'),
    supabase.from('memberships').select('user_id').eq('group_id', groupId).eq('role', 'little').eq('status', 'approved'),
    supabase.from('rankings').select('ranker_id, ranked_ids').eq('group_id', groupId),
  ]);

  if (bigsRes.error) return { error: bigsRes.error.message };
  if (littlesRes.error) return { error: littlesRes.error.message };
  if (rankingsRes.error) return { error: rankingsRes.error.message };

  const bigIds = (bigsRes.data ?? []).map(b => b.user_id as string);
  const littleIds = (littlesRes.data ?? []).map(l => l.user_id as string);
  const twinsWilling = new Set(
    (bigsRes.data ?? []).filter(b => b.willing_to_take_twins).map(b => b.user_id as string)
  );

  const bigRankings: PreferenceMap = {};
  const littleRankings: PreferenceMap = {};
  const bigIdSet = new Set(bigIds);
  const littleIdSet = new Set(littleIds);
  for (const row of rankingsRes.data ?? []) {
    const rankerId = row.ranker_id as string;
    const rankedIds = (row.ranked_ids as string[]) ?? [];
    if (bigIdSet.has(rankerId)) bigRankings[rankerId] = rankedIds;
    else if (littleIdSet.has(rankerId)) littleRankings[rankerId] = rankedIds;
  }

  const result = runDeferredAcceptance(bigIds, littleIds, bigRankings, littleRankings, twinsWilling);

  const { error: deleteError } = await supabase.from('pairings').delete().eq('group_id', groupId);
  if (deleteError) return { error: deleteError.message };

  const rows = result.flatMap(({ big, littles }) =>
    littles.map(littleId => ({ group_id: groupId, big_id: big, little_id: littleId }))
  );
  if (rows.length > 0) {
    const { error: insertError } = await supabase.from('pairings').insert(rows);
    if (insertError) return { error: insertError.message };
  }

  return { error: null };
}

export async function getPairings(groupId: string): Promise<{ pairings: PairingRow[]; error: string | null }> {
  const { data, error } = await supabase
    .from('pairings')
    .select(
      'big_id, little_id, big:profiles!pairings_big_id_fkey(name), little:profiles!pairings_little_id_fkey(name)'
    )
    .eq('group_id', groupId);

  if (error) return { pairings: [], error: error.message };

  const pairings = (data ?? []).map((row: any) => ({
    bigId: row.big_id as string,
    bigName: (row.big as { name: string | null } | null)?.name ?? null,
    littleId: row.little_id as string,
    littleName: (row.little as { name: string | null } | null)?.name ?? null,
  }));
  return { pairings, error: null };
}
