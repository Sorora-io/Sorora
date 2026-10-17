import {getPairingConfirmations} from './pairingConfirmations';
import { pairingExportCsv, downloadPairingExport } from './pairingExport';
import { getRankingExport } from './rankingExport';
import { getPairings } from './rankings';
jest.mock('./pairingConfirmations',()=>({getPairingConfirmations:jest.fn()}));
jest.mock('./rankingExport', () => ({getRankingExport:jest.fn()}));
jest.mock('./rankings', () => ({ getPairings: jest.fn() }));
const pairs = [
  {bigId:'b',bigName:'A, "Big"',littleId:'l1',littleName:'Zoë'},
  {bigId:'b',bigName:'A, "Big"',littleId:'l2',littleName:'=FORMULA()'},
];
test('exports twins as separate rows with cycle context, escaping, Unicode and formula protection',()=>{
  expect(pairingExportCsv('Fall',pairs)).toBe('\uFEFF"Review status","Cycle","Big","Little"\r\n"Needs review","Fall","A, ""Big""","Zoë"\r\n"Needs review","Fall","A, ""Big""","\'=FORMULA()"\r\n');
});
test('downloads fresh saved pairings from the selected cycle without rankings or reveal',async()=>{
  (getPairings as jest.Mock).mockResolvedValue({pairings:pairs,error:null});
  URL.createObjectURL=jest.fn(()=> 'blob:pairs'); URL.revokeObjectURL=jest.fn();
  const click=jest.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(function(this:HTMLAnchorElement){expect(this.download).toBe('sorora-pairings.csv');});
  try {await downloadPairingExport('Past cycle','past-cycle');} finally {click.mockRestore();}
  expect(getPairings).toHaveBeenCalledWith('past-cycle');
});
test.each([{pairings:[],error:'Access denied'},{pairings:[],error:null}])('denied or empty reads do not download a misleading file',async response=>{
  (getPairings as jest.Mock).mockResolvedValue(response);
  const click=jest.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{});
  try {await expect(downloadPairingExport('Fall','c')).rejects.toThrow();expect(click).not.toHaveBeenCalled();} finally {click.mockRestore();}
});

test('rank-aware export groups mutual first choices first and clearly labels one-sided ranks without chapter metadata',()=>{
  const data:any={members:[
    {userId:'b',submitted:true,preferences:[{userId:'l2',rank:1},{userId:'l1',rank:2}]},
    {userId:'l1',submitted:true,preferences:[]},
    {userId:'l2',submitted:true,preferences:[{userId:'b',rank:1}]},
  ]};
  const csv=pairingExportCsv('Fall',pairs,data);
  expect(csv).not.toContain('Chapter');
  expect(csv).toContain('Big’s rank of Little (#1 = first choice)');
  expect(csv).toContain('"Confirmed","Fall"');
  expect(csv).toContain('"Mutual first choice","#1","#1"');
  expect(csv).toContain('"Needs review","Fall"');
  expect(csv).toContain('"One-sided ranking","#2","Not ranked"');
  expect(csv.indexOf('"Mutual first choice","#1"')).toBeLessThan(csv.indexOf('"One-sided ranking","#2"'));
});
test('rank-aware download requests authorized rankings for the selected cycle, while basic export never requests rankings',async()=>{
  (getPairings as jest.Mock).mockResolvedValue({pairings:pairs,error:null});
  (getRankingExport as jest.Mock).mockResolvedValue({members:[]});
  URL.createObjectURL=jest.fn(()=> 'blob:pairs');
  const click=jest.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{});
  try {
    (getRankingExport as jest.Mock).mockClear();
    await downloadPairingExport('Fall','cycle');expect(getRankingExport).not.toHaveBeenCalled();
    await downloadPairingExport('Fall','cycle','group');expect(getRankingExport).toHaveBeenCalledWith('group','cycle',true);
  } finally {click.mockRestore();}
});

test('saved admin decisions override automatic first-choice defaults in exported review status',()=>{
 const data:any={members:[{userId:'b',submitted:true,preferences:[{userId:'l2',rank:1},{userId:'l1',rank:2}]},{userId:'l1',submitted:true,preferences:[]},{userId:'l2',submitted:true,preferences:[{userId:'b',rank:1}]}]};
 const decisions=[{bigId:'b',littleId:'l1',confirmed:true,reviewedBy:'Admin',reviewedAt:'2026-10-17'},{bigId:'b',littleId:'l2',confirmed:false,reviewedBy:'Admin',reviewedAt:'2026-10-17'}];
 const csv=pairingExportCsv('Fall',pairs,data,decisions);
 expect(csv).toContain('"One-sided ranking","#2","Not ranked"');
 expect(csv).toContain('"Mutual first choice","#1","#1"');
 expect(csv.indexOf('"Confirmed","Fall"')).toBeLessThan(csv.indexOf('"Needs review","Fall"'));
});
test('download reads saved confirmations even when ranking positions stay private',async()=>{
 (getPairings as jest.Mock).mockResolvedValue({pairings:pairs,error:null});
 (getPairingConfirmations as jest.Mock).mockResolvedValue({decisions:[]});
 URL.createObjectURL=jest.fn(()=> 'blob:pairs');
 const click=jest.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{});
 try {await downloadPairingExport('Fall','cycle',undefined,'group');} finally {click.mockRestore();}
 expect(getPairingConfirmations).toHaveBeenCalledWith('group','cycle');
});
