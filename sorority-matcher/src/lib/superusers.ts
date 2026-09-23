import { supabase } from './supabase';

export interface SuperuserAccount {
  id: string;
  email: string | null;
  name: string | null;
  created_at: string;
  verified: boolean;
  is_superuser: boolean;
  memberships: {
    group_id: string;
    group_name: string;
    school: string | null;
    role: string;
    is_admin: boolean;
    is_owner: boolean;
    status: string;
    requested_role: string | null;
  }[];
}

export async function getSuperuserAccess(): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_superuser');
  if (error) throw new Error(error.message);
  return data === true;
}

export async function getSuperuserAccounts(search: string, offset: number): Promise<{ total: number; accounts: SuperuserAccount[] }> {
  const { data, error } = await supabase.rpc('superuser_accounts', { p_search: search, p_offset: offset });
  if (error) throw new Error(error.message);
  return data;
}

export async function grantSuperuser(userId: string): Promise<void> {
  const { error } = await supabase.rpc('grant_superuser', { p_user_id: userId });
  if (error) throw new Error(error.message);
}

export async function deleteSuperuserAccount({ userId, confirmation }: { userId: string; confirmation: string }): Promise<void> {
  const { error } = await supabase.rpc('superuser_delete_account', { p_user_id: userId, p_confirmation: confirmation });
  if (error) throw new Error(error.message);
}

export interface SuperuserOrganization {
  id: string;
  name: string;
  school: string | null;
  owner_email: string | null;
  join_code: string;
  member_count: number;
}

export async function getSuperuserOrganizations(search: string, offset: number): Promise<{ total: number; organizations: SuperuserOrganization[] }> {
  const { data, error } = await supabase.rpc('superuser_organizations', { p_search: search, p_offset: offset });
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteSuperuserOrganization({ groupId, confirmation }: { groupId: string; confirmation: string }): Promise<void> {
  const { error } = await supabase.rpc('superuser_delete_organization', { p_group_id: groupId, p_confirmation: confirmation });
  if (error) throw new Error(error.message);
}

export interface TransferResult {
  group_id: string;
  group_name: string;
  owner_id: string;
  owner_email: string | null;
  owner_name: string | null;
  previous_owner_email: string | null;
}

// Takes the new owner's email rather than an id — that's what a superuser
// has on hand, and the client can't read auth.users to resolve it itself.
// The RPC also grants the incoming owner approved admin access, since
// owner_id alone confers no actual capability.
export async function transferSuperuserOrganization(
  { groupId, email }: { groupId: string; email: string },
): Promise<TransferResult> {
  const { data, error } = await supabase.rpc('superuser_transfer_organization', {
    p_group_id: groupId,
    p_new_owner_email: email,
  });
  if (error) throw new Error(error.message);
  return data as TransferResult;
}
