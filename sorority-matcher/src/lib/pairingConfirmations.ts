import { supabase } from './supabase';
export interface PairingDecision {
  bigId:string; littleId:string; confirmed:boolean; reviewedBy:string; reviewedAt:string;
}
export interface PairingConfirmations {
  version:string; lockReason:string|null; decisions:PairingDecision[];
}
export async function getPairingConfirmations(groupId:string,cycleId:string):Promise<PairingConfirmations> {
  const {data,error}=await supabase.rpc('get_pairing_confirmations',{p_group_id:groupId,p_cycle_id:cycleId});
  if(error)throw new Error(error.message);
  if(!data)throw new Error('Could not load pairing confirmations.');
  return data as PairingConfirmations;
}
export async function setPairingConfirmation(groupId:string,cycleId:string,bigId:string,littleId:string,version:string,confirmed:boolean):Promise<void> {
  const {error}=await supabase.rpc('set_pairing_confirmation',{p_group_id:groupId,p_cycle_id:cycleId,p_big_id:bigId,p_little_id:littleId,p_expected_version:version,p_confirmed:confirmed});
  if(error)throw new Error(error.message);
}
