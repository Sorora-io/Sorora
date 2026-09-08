import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMatching } from '../../contexts/MatchingContext';
import { Link } from 'react-router-dom';
import Progressbar from '../../components/Progressbar';
import CsvUploadButton from '../../components/CsvUploadButton';

const EnterLittles = () => {
  const navigate = useNavigate();
  const { littlesInput, setLittlesInput, setLittles } = useMatching();
  const [error, setError] = useState('');

  const count = littlesInput
    .split('\n')
    .flatMap(line => line.split('\t'))
    .map(name => name.trim())
    .filter(name => name !== '').length;

  const handleSubmit = () => {
    if (littlesInput.includes(',')) {
      setError('Please enter one person (first and last name) per line or tab-separated instead of using commas');
      return;
    }

    const littlesList = littlesInput
      .split('\n')
      .flatMap(line => line.split('\t'))
      .map(name => name.trim())
      .filter(name => name !== '');
    if (littlesList.length === 0) {
      setError('Please enter at least 1 little');
      return;
    }

    setError('');
    setLittles(littlesList);
    navigate('/admin/twins');
  };

  return (
    <div className="min-h-screen flex flex-col items-center p-8 pt-16">
      <header className="mb-12">
        <Link to="/">
        <h1 className="text-4xl font-display font-semibold text-center text-jade-800">Sorora</h1>
        </Link>
      </header>

      <Progressbar currentStep={2} />

      <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8">
        <div className="flex items-start justify-between mb-2">
          <h2 className="text-2xl font-semibold">Who is eligible to be a Little?</h2>
          <CsvUploadButton
            entityLabel="little"
            onNames={(names) => { setLittlesInput(names.join('\n')); setError(''); }}
            onError={setError}
          />
        </div>
        <p className="text-gray-600 mb-4">
          Add everyone participating as a potential Little — one name per line. You can also paste
          names from a spreadsheet or upload a CSV.
        </p>
        <textarea
          className="w-full h-64 p-4 border-2 border-jade-300 rounded-md focus:border-jade-500 focus:outline-none focus:ring-2 focus:ring-jade-100"
          value={littlesInput}
          onChange={(e) => setLittlesInput(e.target.value)}
          placeholder={'e.g.\nAva Thompson\nOlivia Rodriguez\nEmma Patel'}
        />
        <div className="flex items-center justify-between mt-2">
          <p className="text-sm text-gray-500">{count} {count === 1 ? 'Little' : 'Littles'} added</p>
        </div>
        {error && (
          <p className="text-brick mt-2">{error}</p>
        )}
      </div>

      <div className="mt-8 flex gap-4">
        <button
          onClick={() => navigate('/admin/enter-bigs')}
          className="px-6 py-3 border-2 border-jade-300 rounded-md hover:bg-jade-50 transition-colors font-medium"
        >
          Back
        </button>
        <button
          onClick={handleSubmit}
          className="px-6 py-3 bg-jade-600 text-white rounded-md hover:bg-jade-700 transition-colors font-medium"
        >
          Continue to Twin Availability
        </button>
      </div>
    </div>
  );
};

export default EnterLittles;
