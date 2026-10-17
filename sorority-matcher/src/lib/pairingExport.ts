import { getPairings, PairingRow } from './rankings';

const cell = (value: string) => {
  // Treat member/chapter names as text when opened in a spreadsheet.
  // eslint-disable-next-line no-control-regex
  const safe = /^[\s\u0000-\u001f]*[=+@-]/.test(value) || /^[\t\r\n]/.test(value) ? "'" + value : value;
  return '"' + safe.replace(/"/g, '""') + '"';
};

export function pairingExportCsv(chapter: string, cycle: string, pairings: PairingRow[]): string {
  const rows = [
    ['Chapter', 'Cycle', 'Big', 'Little'],
    ...pairings.map(pair => [chapter, cycle, pair.bigName || 'Unknown Big', pair.littleName || 'Unknown Little']),
  ];
  return '\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n') + '\r\n';
}

export async function downloadPairingExport(chapter: string, cycle: string, cycleId: string): Promise<void> {
  // Fetch again so a download reflects saved edits and current access, rather
  // than an earlier page snapshot. Existing pairing RLS applies to this read.
  const { pairings, error } = await getPairings(cycleId);
  if (error) throw new Error(error);
  if (!pairings.length) throw new Error('No pairings to export for this cycle.');
  const url = URL.createObjectURL(new Blob([pairingExportCsv(chapter, cycle, pairings)], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'sorora-pairings.csv';
  document.body.appendChild(link);
  try { link.click(); } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
