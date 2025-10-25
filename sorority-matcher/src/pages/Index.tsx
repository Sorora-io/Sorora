import { useNavigate } from 'react-router-dom';

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <header className="mb-12">
        <h1 className="text-4xl font-bold text-center">Sorora</h1>
      </header>

      <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <h2 className="text-3xl font-semibold mb-6">Welcome!</h2>
      </div>

      <div className="mt-8">
        <button
          onClick={() => navigate('/mission')}
          className="px-8 py-3 bg-black text-white rounded-md hover:bg-gray-800 transition-colors text-xl"
        >
          ⟶
        </button>
      </div>
    </div>
  );
};

export default Index;
