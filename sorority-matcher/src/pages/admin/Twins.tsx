import { useNavigate } from 'react-router-dom';
import { useMatching } from '../../contexts/MatchingContext';
import { Link } from 'react-router-dom';

const Twins = () => {
  const navigate = useNavigate();
  const { bigs, bigsWillingToTakeTwins, toggleTwinSelection } = useMatching();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <header className="mb-12">
        <Link to="/">
        <h1 className="text-4xl font-bold text-center">Sorora</h1>
        </Link>
      </header>

      <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8">
        <h2 className="text-2xl font-semibold mb-4">Select Bigs Willing to Take Twins</h2>
        <p className="text-gray-700 mb-6">Check all bigs who are willing to take 2 littles:</p>

        <div className="space-y-3">
          {bigs.map(big => (
            <div key={big} className="flex items-center">
              <input
                type="checkbox"
                id={big}
                checked={bigsWillingToTakeTwins.has(big)}
                onChange={() => toggleTwinSelection(big)}
                className="w-5 h-5 mr-3 cursor-pointer"
              />
              <label htmlFor={big} className="text-lg cursor-pointer">{big}</label>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 flex gap-4">
        <button
          onClick={() => navigate('/admin/enter-littles')}
          className="px-8 py-3 bg-gray-300 text-black rounded-md hover:bg-gray-400 transition-colors text-xl"
        >
          ⟵
        </button>
        <button
          onClick={() => navigate('/admin/ranking-requirements')}
          className="px-8 py-3 bg-black text-white rounded-md hover:bg-gray-800 transition-colors text-xl"
        >
          ⟶
        </button>
      </div>
    </div>
  );
};

export default Twins;
