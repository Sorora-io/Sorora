import { supabase } from './supabase';
import { PairingRow } from './rankings';
export interface PairingChange {
  littleId: string; littleName: string;
  fromBigId: string; fromBigName: string; toBigId: string; toBigName: string;
}
export interface PairingHistoryEntry {
  id: string; actor_name: string; created_at: string; reason: string; changes: PairingChange[];
}
export interface PairingEditorData {
  version: string; lockReason: string | null;
  pairings: PairingRow[];
  bigs: { id: string; name: string; capacity: number }[];
  history: PairingHistoryEntry[];
}
export async function getPairingEditor(groupId: string, cycleId: string): Promise<PairingEditorData> {
  const { data, error } = await supabase.rpc('get_pairing_editor', { p_group_id: groupId, p_cycle_id: cycleId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Could not load pairing changes.');
  return data as PairingEditorData;
}
export async function changePairing(groupId: string, cycleId: string, littleId: string, toBigId: string,
  swapLittleId: string | null, version: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc('change_pairing', {
    p_group_id: groupId, p_cycle_id: cycleId, p_little_id: littleId, p_to_big_id: toBigId,
    p_swap_little_id: swapLittleId, p_expected_version: version, p_reason: reason,
  });
  if (error) throw new Error(error.message);
}

export interface PairingOperation { littleId: string; toBigId: string; swapLittleId: string | null; }
export async function changePairings(groupId: string, cycleId: string, operations: PairingOperation[], version: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc('change_pairings_batch', {
    p_group_id: groupId, p_cycle_id: cycleId, p_operations: operations,
    p_expected_version: version, p_reason: reason,
  });
  if (error) throw new Error(error.message);
}
