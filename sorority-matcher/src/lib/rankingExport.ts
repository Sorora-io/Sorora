import { littlePreferenceLabel } from './littlePreference';
import { supabase } from './supabase';

export interface RankingExport {
  chapter: string;
  cycle: string;
  cycleId: string;
  members: {
    userId: string; name: string | null; email: string; role: string;
    submitted: boolean; updatedAt: string | null;
    willingToTakeTwins?: boolean | null; wantedLittleCount?: number | null;
    preferences: { rank: number; userId: string; name: string | null; email: string | null }[] | null;
  }[];
}

// Quote every cell and neutralize spreadsheet formulas in user-provided text.
const cell = (value: unknown) => {
  let text = value == null ? '' : String(value);
  // Control characters can hide a formula prefix from spreadsheet importers.
  // eslint-disable-next-line no-control-regex
  if (/^[\s\u0000-\u001f]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
};

const choiceHeading = (rank: number) => {
  const lastTwo = rank % 100;
  const suffix = lastTwo >= 11 && lastTwo <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[rank % 10] || 'th');
  return `${rank}${suffix} choice`;
};

function readableRankings(data: RankingExport): unknown[][] {
  // Resolve labels consistently for rankers and choices. IDs stay internal;
  // emails distinguish real people only when names are missing or collide.
  const people = new Map<string, { name: string; email: string }>();
  for (const member of data.members) {
    people.set(member.userId, { name: member.name?.trim() || '', email: member.email?.trim() || '' });
  }
  for (const member of data.members) {
    for (const pref of member.preferences ?? []) {
      if (!people.has(pref.userId)) people.set(pref.userId, { name: pref.name?.trim() || '', email: pref.email?.trim() || '' });
    }
  }
  const nameCounts = new Map<string, number>();
  const normalized = (name: string) => name.normalize('NFC').toLowerCase();
  for (const person of people.values()) {
    if (person.name) nameCounts.set(normalized(person.name), (nameCounts.get(normalized(person.name)) || 0) + 1);
  }
  const labels = new Map<string, string>();
  const labelCounts = new Map<string, number>();
  for (const [id, person] of people) {
    const label = person.name
      ? (nameCounts.get(normalized(person.name))! > 1 && person.email ? `${person.name} (${person.email})` : person.name)
      : person.email || 'Unavailable member';
    labels.set(id, label);
    labelCounts.set(normalized(label), (labelCounts.get(normalized(label)) || 0) + 1);
  }
  // If even the available human details are identical, use a local numbered
  // label so different people never collapse into the same exported identity.
  const occurrences = new Map<string, number>();
  for (const [id, label] of labels) {
    const key = normalized(label);
    if (labelCounts.get(key)! > 1) {
      const number = (occurrences.get(key) || 0) + 1;
      occurrences.set(key, number);
      labels.set(id, `${label} (member ${number})`);
    }
  }
  const width = data.members.reduce((maximum, member) => Math.max(maximum, member.submitted ? member.preferences?.length || 0 : 0), 1);
  const rows: unknown[][] = [['Member', 'Role', 'Twins / triplets preference', ...Array.from({ length: width }, (_, i) => choiceHeading(i + 1))]];
  for (const member of data.members) {
    const choices = member.submitted
      ? [...(member.preferences ?? [])].sort((a, b) => a.rank - b.rank).map(pref => labels.get(pref.userId) || 'Unavailable member')
      : [];
    if (!choices.length) choices.push(member.submitted ? 'No ranked preferences' : 'Not submitted');
    rows.push([labels.get(member.userId), member.role === 'big' ? 'Big' : member.role === 'little' ? 'Little' : member.role, littlePreferenceLabel(member),
      ...choices, ...Array(width - choices.length).fill('')]);
  }
  return rows;
}

export function rankingExportCsv(data: RankingExport, preferences: boolean): string {
  // Keep submission details separate from the readable rankings matrix.
  const rows: unknown[][] = preferences ? readableRankings(data) : [
    ['Chapter', 'Cycle', 'Cycle ID', 'Member ID', 'Member name', 'Member email', 'Member type', 'Submission status', 'Last submitted (UTC)', 'Twins / triplets preference'],
    ...data.members.map(member => [data.chapter, data.cycle, data.cycleId, member.userId, member.name, member.email, member.role,
      member.submitted ? 'Submitted' : 'Waiting', member.updatedAt, littlePreferenceLabel(member)]),
  ];
  return '\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n') + '\r\n';
}

export async function getRankingExport(groupId: string, cycleId: string, preferences: boolean): Promise<RankingExport> {
  const { data, error } = await supabase.rpc('export_chapter_rankings', {
    p_group_id: groupId, p_cycle_id: cycleId, p_include_preferences: preferences,
  });
  if (error) throw new Error(error.message);
  if (!data || !Array.isArray(data.members)) throw new Error('Could not load the export. Please try again.');
  return data as RankingExport;
}

export async function downloadRankingExport(groupId: string, cycleId: string, preferences: boolean): Promise<void> {
  const data = await getRankingExport(groupId, cycleId, preferences);
  const csv = rankingExportCsv(data, preferences);
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = preferences ? 'sorora-rankings.csv' : `sorora-submissions-${cycleId}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
