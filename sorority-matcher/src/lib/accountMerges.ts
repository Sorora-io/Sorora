import { supabase } from './supabase';
export interface MergePreview {
  requestId: string; nonce: string; sourceEmail: string; targetEmail: string;
  sourceApproved: boolean; targetApproved: boolean; blockers: string[];
  counts: { memberships: number; rankings: number; rankingReferences: number; notes: number; pairings: number; ownedChapters: number };
  memberships: { groupId: string; name: string; sourceRole: string; targetRole: string; sourceStatus: string; targetStatus: string; sourceAdmin: boolean; targetAdmin: boolean; ownsChapter: boolean }[];
  rankings: { cycleId: string; name: string; sourceUpdated: string; targetUpdated: string }[];
}
export interface MergeChoices { profile: string; memberships: Record<string, string>; rankings: Record<string, string> }
export interface MergeApproval { sourceEmail: string; targetEmail: string; status: string; expired: boolean; isSource: boolean; approved: boolean }
async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.message);
  return data as T;
}
export const createAccountMerge = (source: string, targetEmail: string) => rpc<string>('create_account_merge', { p_source: source, p_target_email: targetEmail });
export const previewAccountMerge = (id: string) => rpc<MergePreview>('preview_account_merge', { p_request: id });
export const cancelAccountMerge = (id: string) => rpc<void>('cancel_account_merge', { p_request: id });
export const getMergeApproval = (id: string) => rpc<MergeApproval>('get_account_merge_approval', { p_request: id });
export const approveAccountMerge = (id: string, approve: boolean) => rpc<void>('approve_account_merge', { p_request: id, p_approve: approve });
export const completeAccountMerge = (id: string, nonce: string, choices: MergeChoices, confirmation: string) => rpc<{ targetEmail: string; auditId: string }>('complete_account_merge', {
  p_request: id, p_nonce: nonce, p_choices: choices, p_confirmation: confirmation,
});
