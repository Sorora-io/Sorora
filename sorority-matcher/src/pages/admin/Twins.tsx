import { useNavigate, Link } from 'react-router-dom';
import { useMatching } from '../../contexts/MatchingContext';
import Progressbar from '../../components/Progressbar';

const Twins = () => {
  const navigate = useNavigate();
  const { bigs, bigsWillingToTakeTwins, toggleTwinSelection } = useMatching();

  return (
    <div className="min-h-screen flex flex-col items-center p-8 pt-16">
      <header className="mb-12">
        <Link to="/">
        <h1 className="text-4xl font-display font-semibold text-center text-jade-800">Sorora</h1>
        </Link>
      </header>

      <Progressbar currentStep={3} />

      <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8">
        <h2 className="text-2xl font-semibold mb-2">Twin availability</h2>
        <p className="text-gray-600 mb-6">
          A Big willing to take twins can be matched with two Littles instead of one. Check anyone
          who's open to that this semester — it's fine to leave everyone unchecked.
        </p>

        {bigs.length === 0 ? (
          <p className="text-gray-500 text-sm">
            No Bigs added yet.{' '}
            <button onClick={() => navigate('/admin/enter-bigs')} className="underline hover:text-black">
              Start by adding everyone eligible to take a Little this semester.
            </button>
          </p>
        ) : (
          <div className="space-y-3">
            {bigs.map(big => (
              <div key={big} className="flex items-center">
                <input
                  type="checkbox"
                  id={big}
                  checked={bigsWillingToTakeTwins.has(big)}
                  onChange={() => toggleTwinSelection(big)}
                  className="w-5 h-5 mr-3 cursor-pointer accent-jade-600"
                />
                <label htmlFor={big} className="text-lg cursor-pointer">{big}</label>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-8 flex gap-4">
        <button
          onClick={() => navigate('/admin/enter-littles')}
          className="px-6 py-3 border-2 border-jade-300 rounded-md hover:bg-jade-50 transition-colors font-medium"
        >
          Back
        </button>
        <button
          onClick={() => navigate('/admin/ranking-requirements')}
          className="px-6 py-3 bg-jade-600 text-white rounded-md hover:bg-jade-700 transition-colors font-medium"
        >
          Continue to Ranking Rules
        </button>
      </div>
    </div>
  );
};

export default Twins;
