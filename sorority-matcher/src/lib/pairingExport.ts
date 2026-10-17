import { getRankingExport, RankingExport } from './rankingExport';
import { reviewPairings } from './pairingReview';
import { getPairings, PairingRow } from './rankings';

const cell = (value: string) => {
  // Treat member names as text when opened in a spreadsheet.
  // eslint-disable-next-line no-control-regex
  const safe = /^[\s\u0000-\u001f]*[=+@-]/.test(value) || /^[\t\r\n]/.test(value) ? "'" + value : value;
  return '"' + safe.replace(/"/g, '""') + '"';
};

export function pairingExportCsv(cycle: string, pairings: PairingRow[], rankings?: RankingExport): string {
  const reviewed = rankings ? reviewPairings(pairings, rankings).sort((a,b) => Number(b.mutualFirst) - Number(a.mutualFirst)) : null;
  const rankLabel = (rank: number | string) => typeof rank === 'number' ? `#${rank}` : rank;
  const rows = reviewed ? [
    ['Cycle', 'Big', 'Little', 'Match type', 'Big’s rank of Little (#1 = first choice)', 'Little’s rank of Big (#1 = first choice)'],
    ...reviewed.map(pair => [cycle, pair.bigName || 'Unknown Big', pair.littleName || 'Unknown Little', pair.matchType, rankLabel(pair.bigRank), rankLabel(pair.littleRank)]),
  ] : [
    ['Cycle', 'Big', 'Little'],
    ...pairings.map(pair => [cycle, pair.bigName || 'Unknown Big', pair.littleName || 'Unknown Little']),
  ];
  return '\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n') + '\r\n';
}

export async function downloadPairingExport(cycle: string, cycleId: string, rankingGroupId?: string): Promise<void> {
  // Fetch again so a download reflects saved edits and current access, rather
  // than an earlier page snapshot. Existing pairing RLS applies to this read.
  const { pairings, error } = await getPairings(cycleId);
  if (error) throw new Error(error);
  if (!pairings.length) throw new Error('No pairings to export for this cycle.');
  const rankings = rankingGroupId ? await getRankingExport(rankingGroupId, cycleId, true) : undefined;
  const url = URL.createObjectURL(new Blob([pairingExportCsv(cycle, pairings, rankings)], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'sorora-pairings.csv';
  document.body.appendChild(link);
  try { link.click(); } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
