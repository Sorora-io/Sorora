import { requestToJoinGroup } from './groups';
import { supabase } from './supabase';
jest.mock('./supabase', () => ({ supabase: { auth: { getUser: jest.fn() }, from: jest.fn() } }));
const read = jest.fn(); const insert = jest.fn();
const membership = { id:'m', group_id:'chapter', user_id:'user', status:'approved', role:'admin', is_admin:true };
beforeEach(() => {
  jest.resetAllMocks();
  (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id:'user' } }, error:null });
  (supabase.from as jest.Mock).mockImplementation(() => ({select: () => ({eq: () => ({eq: () => ({maybeSingle:read})})}),insert}));
});
test.each(['pending','approved','rejected'])('reuses %s membership without changing status, role or privileges', async status => {
  const saved={...membership,status};read.mockResolvedValue({data:saved,error:null});
  expect(await requestToJoinGroup('chapter','little')).toEqual({membership:saved,error:null});
  expect(insert).not.toHaveBeenCalled();
});
test('creates a pending participant once when there is no membership', async () => {
  const saved={...membership,role:'big',status:'pending',is_admin:false};
  read.mockResolvedValueOnce({data:null,error:null}).mockResolvedValue({data:saved,error:null});
  insert.mockResolvedValue({error:null});
  expect(await requestToJoinGroup('chapter','big')).toEqual({membership:saved,error:null});
  expect(insert).toHaveBeenCalledWith({group_id:'chapter',user_id:'user',role:'big',status:'pending'});
});
test('a competing insert is recovered by reading the existing membership', async () => {
  read.mockResolvedValueOnce({data:null,error:null}).mockResolvedValue({data:membership,error:null});
  insert.mockResolvedValue({error:{code:'23505',message:'duplicate key violates unique constraint memberships_group_id_user_id_key'}});
  expect(await requestToJoinGroup('chapter','little')).toEqual({membership,error:null});
});
test('concurrent callers share the same insert', async () => {
  read.mockResolvedValueOnce({data:null,error:null}).mockResolvedValue({data:membership,error:null});
  insert.mockResolvedValue({error:null});
  const results=await Promise.all([requestToJoinGroup('chapter','big'),requestToJoinGroup('chapter','little')]);
  expect(results[0]).toEqual(results[1]);expect(insert).toHaveBeenCalledTimes(1);
});
test.each(['read','insert','race','network'])('%s failure gives useful recovery text without raw database details', async failure => {
  read.mockResolvedValue({data:null,error:failure==='read'?{message:'private SQL details'}:null});
  insert.mockResolvedValue({error:{code:failure==='race'?'23505':'42501',message:'private SQL details'}});
  if(failure==='network') read.mockRejectedValue(new Error('network internals'));
  const result=await requestToJoinGroup('chapter','big');
  expect(result.membership).toBeNull();expect(result.error).toMatch(/Please try again/);expect(result.error).not.toMatch(/SQL|23505|network internals/);
});
test('rejects admin joins before database access', async () => {
  expect((await requestToJoinGroup('chapter','admin')).error).toMatch(/Big or Little/);
  expect(supabase.from).not.toHaveBeenCalled();
});
