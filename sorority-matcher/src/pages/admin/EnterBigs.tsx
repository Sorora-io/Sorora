import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMatching } from '../../contexts/MatchingContext';
import { Link } from 'react-router-dom';
import Progressbar from '../../components/Progressbar';
import CsvUploadButton from '../../components/CsvUploadButton';
import RowNameEntry from '../../components/RowNameEntry';

const EnterBigs = () => {
  const navigate = useNavigate();
  const { bigsInput, setBigsInput, setBigs } = useMatching();
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'rows' | 'bulk'>('rows');
  const [resetKey, setResetKey] = useState(0);

  const count = bigsInput
    .split('\n')
    .flatMap(line => line.split('\t'))
    .map(name => name.trim())
    .filter(name => name !== '').length;
  const previewNames = bigsInput
    .split('\n')
    .flatMap(line => line.split('\t'))
    .map(name => name.trim())
    .filter(name => name !== '');

  const handleCsvNames = (names: string[]) => {
    setBigsInput(names.join('\n'));
    setError('');
    setMode('rows');
    setResetKey(k => k + 1);
  };

  const switchToBulk = () => setMode('bulk');
  const switchToRows = () => {
    setMode('rows');
    setResetKey(k => k + 1);
  };

  const handleSubmit = () => {
    if (bigsInput.includes(',')) {
      setError('Please enter one person (first and last name) per line or tab-separated instead of using commas');
      return;
    }

    const bigsList = bigsInput
      .split('\n')
      .flatMap(line => line.split('\t'))
      .map(name => name.trim())
      .filter(name => name !== '');
    if (bigsList.length === 0) {
      setError('Please enter at least 1 big');
      return;
    }

    setError('');
    setBigs(bigsList);
    navigate('/admin/enter-littles');
  };

  return (
    <div className="min-h-screen flex flex-col items-center p-8 pt-16">
      <header className="mb-12">
        <Link to="/">
          <h1 className="text-4xl font-display font-semibold text-center text-jade-800">Sorora</h1>
        </Link>
      </header>

      <Progressbar currentStep={1} />

      <div className="max-w-2xl w-full bg-white rounded-lg shadow-sm p-5">
        <div className="flex items-start justify-between mb-2">
          <h2 className="text-2xl font-semibold">Who is eligible to be a Big?</h2>
          <CsvUploadButton entityLabel="big" onNames={handleCsvNames} onError={setError} />
        </div>
        <p className="text-gray-600 mb-4">
          Add everyone participating as a potential Big. You can also paste names from a spreadsheet or
          upload a CSV.
        </p>

        {mode === 'rows' ? (
          <>
            <RowNameEntry key={resetKey} entityLabel="Big" initialValue={bigsInput} onChange={setBigsInput} />
            <button
              type="button"
              onClick={switchToBulk}
              className="mt-3 text-sm underline text-gray-500 hover:text-black"
            >
              Switch to bulk paste instead
            </button>
          </>
        ) : (
          <>
            <textarea
              className="w-full h-48 p-4 border border-jade-300 rounded-md focus:border-jade-500 focus:outline-none focus:ring-2 focus:ring-jade-100"
              value={bigsInput}
              onChange={(e) => setBigsInput(e.target.value)}
              placeholder={'e.g.\nMaya Chen\nIsabella Davis\nSophia Martinez'}
            />
            {previewNames.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Preview</p>
                <div className="flex flex-wrap gap-1.5">
                  {previewNames.map((name, i) => (
                    <span key={i} className="text-xs bg-jade-50 text-jade-700 px-2 py-1 rounded-full">
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={switchToRows}
              className="mt-3 text-sm underline text-gray-500 hover:text-black"
            >
              Switch to row entry
            </button>
          </>
        )}

        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
          <p className="text-sm text-gray-500">{count} {count === 1 ? 'Big' : 'Bigs'} added</p>
        </div>
        {error && (
          <p className="text-brick mt-2">{error}</p>
        )}
      </div>

      <div className="mt-8">
        <button
          onClick={handleSubmit}
          className="px-8 py-2.5 bg-jade-600 text-white rounded-md hover:bg-jade-700 transition-colors font-medium"
        >
          Continue to Littles
        </button>
      </div>
    </div>
  );
};

export default EnterBigs;
