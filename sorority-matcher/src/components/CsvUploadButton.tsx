import { useRef, useState } from 'react';
import { parseNamesFromCsvText } from '../lib/csv';

interface CsvUploadButtonProps {
  entityLabel: string; // e.g. "big" or "little"
  onNames: (names: string[]) => void;
  onError: (message: string) => void;
}

const CsvUploadButton = ({ entityLabel, onNames, onError }: CsvUploadButtonProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [showGuide, setShowGuide] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const names = parseNamesFromCsvText(String(reader.result ?? ''));
      if (names.length === 0) {
        onError('No names found in that file — check it has one name per row.');
        return;
      }
      onNames(names);
    };
    reader.onerror = () => onError('Could not read that file.');
    reader.readAsText(file);
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setShowGuide(v => !v)}
          className="text-sm underline text-gray-600 hover:text-black"
        >
          How should I format this?
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={handleChange}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="text-sm underline text-gray-600 hover:text-black"
        >
          Upload CSV instead
        </button>
      </div>

      {showGuide && (
        <div className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-md p-3 max-w-sm text-left">
          <p className="font-medium mb-1">Formatting your file:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>One {entityLabel} name per row</li>
            <li>A header row (e.g. "Name") is fine — it's detected and skipped automatically</li>
            <li>First and last name in separate columns works too — they'll be combined</li>
            <li>
              Export as CSV first: in Google Sheets, File → Download → Comma Separated
              Values (.csv); in Excel, File → Save As → CSV
            </li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default CsvUploadButton;
