import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMatching } from '../../contexts/MatchingContext';
import { Link } from 'react-router-dom';
import Progressbar from '../../components/Progressbar';

const EnterBigs = () => {
  const navigate = useNavigate();
  const { bigsInput, setBigsInput, setBigs } = useMatching();
  const [error, setError] = useState('');

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
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <header className="mb-12">
        <Link to="/">
          <h1 className="text-4xl font-bold text-center">Sorora</h1>
        </Link>
      </header>

      <Progressbar currentStep={1} />

      <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8">
        <h2 className="text-2xl font-semibold mb-6">Enter all Bigs</h2>
        <textarea
          className="w-full h-64 p-4 border-2 border-gray-300 rounded-md focus:border-black focus:outline-none"
          value={bigsInput}
          onChange={(e) => setBigsInput(e.target.value)}
          placeholder="Enter big names, one per line or tab-separated"
        />
        {error && (
          <p className="text-red-600 mt-4">{error}</p>
        )}
      </div>

      <div className="mt-8 flex gap-4">
        <button
          onClick={() => navigate('/why-it-works')}
          className="px-8 py-3 bg-gray-300 text-black rounded-md hover:bg-gray-400 transition-colors text-xl"
        >
          ⟵
        </button>
        <button
          onClick={handleSubmit}
          className="px-8 py-3 bg-black text-white rounded-md hover:bg-gray-800 transition-colors text-xl"
        >
          ⟶
        </button>
      </div>
    </div>
  );
};

export default EnterBigs;
