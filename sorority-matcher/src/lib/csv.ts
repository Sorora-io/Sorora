const HEADER_WORDS = new Set([
  'name', 'names', 'full name', 'first name', 'last name', 'first', 'last',
  'big', 'bigs', 'little', 'littles',
]);

const splitLine = (line: string): string[] =>
  (line.includes(',') ? line.split(',') : line.split('\t'))
    .map(cell => cell.trim())
    .filter(cell => cell !== '');

export function parseNamesFromCsvText(text: string): string[] {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line !== '');
  if (lines.length === 0) return [];

  const firstCells = splitLine(lines[0]);
  const isHeader = firstCells.length > 0 && firstCells.every(cell => HEADER_WORDS.has(cell.toLowerCase()));
  const dataLines = isHeader ? lines.slice(1) : lines;

  return dataLines
    .map(line => splitLine(line).join(' ').trim())
    .filter(name => name !== '');
}
