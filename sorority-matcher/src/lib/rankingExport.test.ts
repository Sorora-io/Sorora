import { rankingExportCsv, RankingExport, downloadRankingExport } from './rankingExport';
import { supabase } from './supabase';
jest.mock('./supabase', () => ({ supabase: { rpc: jest.fn() } }));
const data: RankingExport = { chapter: 'A, "Chapter"', cycle: 'Fall', cycleId: '00000000-0000-0000-0000-000000000010', members: [
  { userId: '00000000-0000-0000-0000-000000000001', name: 'Avery', email: 'avery@example.com', role: 'big', submitted: true, updatedAt: '2026-09-30T00:00:00Z', wantedLittleCount:2,willingToTakeTwins:false, preferences: [
    { rank: 2, userId: '00000000-0000-0000-0000-000000000003', name: 'Jade', email: 'jade@example.com' },
    { rank: 1, userId: '00000000-0000-0000-0000-000000000002', name: 'Zoë', email: 'zoe@example.com' },
  ] },
  { userId: '00000000-0000-0000-0000-000000000002', name: 'Zoë', email: 'zoe@example.com', role: 'little', submitted: false, updatedAt: null, preferences: [] },
  { userId: '00000000-0000-0000-0000-000000000004', name: 'Beth', email: 'beth@example.com', role: 'big', submitted: true, updatedAt: null, wantedLittleCount:null,willingToTakeTwins:false,preferences: [] },
] };
test('rankings use one row per member with ordered choices and no internal metadata', () => {
  const csv = rankingExportCsv(data, true);
  expect(csv).toBe('\uFEFF"Member","Role","Twins / triplets preference","1st choice","2nd choice"\r\n"Avery","Big","Up to 2 Littles (twins)","Zoë","Jade"\r\n"Zoë","Little","Not applicable","Not submitted",""\r\n"Beth","Big","1 Little (saved/default)","No ranked preferences",""\r\n');
  expect(csv).not.toMatch(/00000000|example.com|2026-09-30|Chapter|Cycle|timestamp|Submitted|Waiting/);
  expect(data.members[0].preferences?.[0].rank).toBe(2);
});
test('duplicate names receive email disambiguation consistently as members and choices', () => {
  const clone: RankingExport=JSON.parse(JSON.stringify(data));
  clone.members.push({...clone.members[1],userId:'second-zoe',email:'other@example.com',name:' zoë '});
  const csv=rankingExportCsv(clone,true);
  expect(csv).toContain('"Avery","Big","Up to 2 Littles (twins)","Zoë (zoe@example.com)","Jade"');
  expect(csv).toContain('"Zoë (zoe@example.com)","Little"');
  expect(csv).toContain('"zoë (other@example.com)","Little"');
  expect(csv).not.toContain('avery@example.com');
});
test('missing identities use available emails or distinct readable labels without exposing IDs', () => {
  const clone: RankingExport=JSON.parse(JSON.stringify(data));
  clone.members[0].name=null;clone.members[0].preferences=[
    {rank:1,userId:'unknown-a',name:null,email:null},{rank:2,userId:'unknown-b',name:null,email:null},
  ];
  const csv=rankingExportCsv(clone,true);
  expect(csv).toContain('"avery@example.com","Big","Up to 2 Littles (twins)","Unavailable member (member 1)","Unavailable member (member 2)"');
  expect(csv).not.toContain('unknown-a');expect(csv).not.toContain('unknown-b');
});
test('all human fields retain CSV escaping, Unicode and spreadsheet formula protection', () => {
  const clone: RankingExport=JSON.parse(JSON.stringify(data));
  clone.members[0].name='=HYPERLINK("bad")';clone.members[0].preferences=[{rank:1,userId:'new',name:'\t=BAD()',email:null},{rank:2,userId:'other',name:'A, "Name"\nZoë',email:null}];
  const csv=rankingExportCsv(clone,true);
  expect(csv).toContain('"\'=HYPERLINK(""bad"")"');expect(csv).toContain('"\'=BAD()"');
  expect(csv).toContain('"A, ""Name""\nZoë"');
});
test('choice columns grow as needed, including ordinal suffixes, with rectangular rows', () => {
  const clone: RankingExport=JSON.parse(JSON.stringify(data));
  clone.members[0].preferences=Array.from({length:23},(_,i)=>({rank:i+1,userId:`target${i}`,name:`Choice ${i+1}`,email:null}));
  const lines=rankingExportCsv(clone,true).slice(1).trim().split('\r\n');
  expect(lines[0]).toContain('"11th choice","12th choice","13th choice"');expect(lines[0]).toContain('"21st choice","22nd choice","23rd choice"');
  for(const line of lines) expect(line.split(',')).toHaveLength(26);
  expect(rankingExportCsv({...data,members:[]},true)).toBe('\uFEFF"Member","Role","Twins / triplets preference","1st choice"\r\n');
});
test('submission CSV preserves details, adds recorded capacity, and never exports ordered choices', () => {
  const csv=rankingExportCsv(data,false);
  expect(csv).toContain('"Chapter","Cycle","Cycle ID","Member ID","Member name","Member email","Member type","Submission status","Last submitted (UTC)","Twins / triplets preference"');
  expect(csv).toContain('"Submitted","2026-09-30T00:00:00Z","Up to 2 Littles (twins)"');
  expect(csv).toContain('"Waiting","","Not applicable"');expect(csv).toContain('"1 Little (saved/default)"');
  expect(csv).toContain('"A, ""Chapter"""');expect(csv).not.toContain('Jade');
});
test('rankings download filename contains no UUID and still requests authorized preferences', async () => {
  (supabase.rpc as jest.Mock).mockResolvedValue({data,error:null});
  URL.createObjectURL=jest.fn(()=> 'blob:download');URL.revokeObjectURL=jest.fn();
  const click=jest.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(function(this:HTMLAnchorElement){expect(this.download).toBe('sorora-rankings.csv');});
  try {await downloadRankingExport('group-id',data.cycleId,true);} finally {click.mockRestore();}
  expect(supabase.rpc).toHaveBeenCalledWith('export_chapter_rankings',{p_group_id:'group-id',p_cycle_id:data.cycleId,p_include_preferences:true});
});
