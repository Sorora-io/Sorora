import { pairingExportCsv, downloadPairingExport } from './pairingExport';
import { getPairings } from './rankings';
jest.mock('./rankings', () => ({ getPairings: jest.fn() }));
const pairs = [
  {bigId:'b',bigName:'A, "Big"',littleId:'l1',littleName:'Zoë'},
  {bigId:'b',bigName:'A, "Big"',littleId:'l2',littleName:'=FORMULA()'},
];
test('exports twins as separate rows with cycle context, escaping, Unicode and formula protection',()=>{
  expect(pairingExportCsv('Chapter','Fall',pairs)).toBe('\uFEFF"Chapter","Cycle","Big","Little"\r\n"Chapter","Fall","A, ""Big""","Zoë"\r\n"Chapter","Fall","A, ""Big""","\'=FORMULA()"\r\n');
});
test('downloads fresh saved pairings from the selected cycle without rankings or reveal',async()=>{
  (getPairings as jest.Mock).mockResolvedValue({pairings:pairs,error:null});
  URL.createObjectURL=jest.fn(()=> 'blob:pairs'); URL.revokeObjectURL=jest.fn();
  const click=jest.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(function(this:HTMLAnchorElement){expect(this.download).toBe('sorora-pairings.csv');});
  try {await downloadPairingExport('Chapter','Past cycle','past-cycle');} finally {click.mockRestore();}
  expect(getPairings).toHaveBeenCalledWith('past-cycle');
});
test.each([{pairings:[],error:'Access denied'},{pairings:[],error:null}])('denied or empty reads do not download a misleading file',async response=>{
  (getPairings as jest.Mock).mockResolvedValue(response);
  const click=jest.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{});
  try {await expect(downloadPairingExport('Chapter','Fall','c')).rejects.toThrow();expect(click).not.toHaveBeenCalled();} finally {click.mockRestore();}
});
