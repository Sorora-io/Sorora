import { useState } from 'react';

interface Row {
  id: string;
  first: string;
  last: string;
}

let rowIdCounter = 0;
const newRow = (first = '', last = ''): Row => ({ id: `row-${++rowIdCounter}`, first, last });

function parseRows(value: string): Row[] {
  const names = value
    .split('\n')
    .flatMap(line => line.split('\t'))
    .map(n => n.trim())
    .filter(Boolean);
  if (names.length === 0) return [newRow()];
  return names.map(name => {
    const spaceIndex = name.indexOf(' ');
    if (spaceIndex === -1) return newRow(name, '');
    return newRow(name.slice(0, spaceIndex), name.slice(spaceIndex + 1));
  });
}

function fullName(row: Row): string {
  return [row.first.trim(), row.last.trim()].filter(Boolean).join(' ');
}

interface RowNameEntryProps {
  entityLabel: string; // "Big" or "Little"
  initialValue: string; // newline-joined names to seed rows from
  onChange: (value: string) => void; // called with the current newline-joined names
}

// A remount-driven, uncontrolled-ish row editor: the parent re-seeds this
// via the `key` prop (see EnterBigs/EnterLittles) whenever names change
// externally (CSV upload, switching back from bulk-paste) — typing within
// a row never remounts it, so there's no fighting over cursor position.
const RowNameEntry = ({ entityLabel, initialValue, onChange }: RowNameEntryProps) => {
  const [rows, setRows] = useState<Row[]>(() => parseRows(initialValue));

  const commit = (next: Row[]) => {
    setRows(next);
    onChange(next.map(fullName).filter(Boolean).join('\n'));
  };

  const updateRow = (id: string, field: 'first' | 'last', text: string) => {
    commit(rows.map(r => (r.id === id ? { ...r, [field]: text } : r)));
  };

  const addRow = () => commit([...rows, newRow()]);
  const removeRow = (id: string) => commit(rows.length > 1 ? rows.filter(r => r.id !== id) : [newRow()]);

  const nameCounts = rows.reduce<Record<string, number>>((acc, row) => {
    const name = fullName(row);
    if (!name) return acc;
    const key = name.toLowerCase();
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  const hasDuplicates = Object.values(nameCounts).some(c => c > 1);

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row, i) => {
        const name = fullName(row);
        const isDuplicate = name !== '' && nameCounts[name.toLowerCase()] > 1;
        return (
          <div key={row.id} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 flex-shrink-0 rounded-full flex items-center justify-center text-xs font-semibold ${
                isDuplicate ? 'bg-brick-100 text-brick' : 'bg-jade-100 text-jade-700'
              }`}
            >
              {row.first.trim().charAt(0).toUpperCase() || i + 1}
            </div>
            <input
              type="text"
              value={row.first}
              onChange={(e) => updateRow(row.id, 'first', e.target.value)}
              placeholder="First name"
              className={`flex-1 min-w-0 p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-jade-100 ${
                isDuplicate ? 'border-brick-300 focus:border-brick' : 'border-jade-300 focus:border-jade-500'
              }`}
            />
            <input
              type="text"
              value={row.last}
              onChange={(e) => updateRow(row.id, 'last', e.target.value)}
              placeholder="Last name"
              className={`flex-1 min-w-0 p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-jade-100 ${
                isDuplicate ? 'border-brick-300 focus:border-brick' : 'border-jade-300 focus:border-jade-500'
              }`}
            />
            <button
              type="button"
              onClick={() => removeRow(row.id)}
              aria-label={`Remove ${name || 'this row'}`}
              className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-brick rounded-md hover:bg-brick-50 transition-colors"
            >
              ×
            </button>
          </div>
        );
      })}

      {hasDuplicates && (
        <p className="text-brick text-sm">
          A couple of names match exactly — check the highlighted rows aren't the same person twice.
        </p>
      )}

      <button
        type="button"
        onClick={addRow}
        className="self-start px-3 py-2 text-sm border border-jade-300 rounded-md hover:bg-jade-50 transition-colors"
      >
        + Add another {entityLabel}
      </button>
    </div>
  );
};

export default RowNameEntry;
