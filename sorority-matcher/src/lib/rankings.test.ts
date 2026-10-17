import { getMyRanking } from './rankings';
import { supabase } from './supabase';
jest.mock('./supabase', () => ({supabase:{auth:{getUser:jest.fn()},from:jest.fn()}}));
test('auth lookup failure is not cached as an empty ranking',async()=>{
 (supabase.auth.getUser as jest.Mock).mockResolvedValue({data:{user:null},error:{message:'Auth unavailable'}});
 expect(await getMyRanking('cycle')).toEqual({rankedIds:[],error:'Auth unavailable'});
 expect(supabase.from).not.toHaveBeenCalled();
});
test('expired session is not treated as a new empty ranking',async()=>{
 (supabase.auth.getUser as jest.Mock).mockResolvedValue({data:{user:null},error:null});
 expect((await getMyRanking('cycle')).error).toMatch(/sign in again/);
});
