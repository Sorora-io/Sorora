import { useNavigate } from 'react-router-dom';
import Progressbar from '../../components/Progressbar';


const Step2 = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-8">
            <header className="mb-12">
                <h1 className="text-4xl font-bold text-center">
                    Sorora: <i>How It Works</i>
                </h1>
            </header>

            <Progressbar currentStep={2} totalSteps={3} stepLabel="Deferred Acceptance" className="max-w-4xl" />

            <div className="max-w-4xl w-full bg-white rounded-lg shadow-lg p-8">
          <h3 className="text-2xl font-semibold mb-6">Step 2: Deferred Acceptance (the NRMP Algorithm)</h3>
          <p className="text-lg leading-relaxed">
            For everyone else, we run deferred acceptance — the same stable-matching algorithm the National Resident Matching Program (NRMP) uses to place medical residents. Littles propose to their top-ranked remaining Big; each Big holds onto their best offer(s) so far and only lets go of a held Little if a better-ranked one proposes later. This repeats until every Little is matched, guaranteeing a stable result: no unmatched Big/Little pair would both rather be with each other than who they ended up with.
          </p>
        </div>                                                                                        
                                                                                                        
        <div className="mt-8 flex gap-4">                                                               
          <button                                                                                       
            onClick={() => navigate('/how-it-works/step-1')}                                                        
            className="px-8 py-3 bg-gray-300 text-black rounded-md hover:bg-gray-400 transition-colors  
  text-xl"                                                                                              
          >                                                                                             
            ⟵                                                                                           
          </button>                                                                                     
          <button                                                                                       
            onClick={() => navigate('/how-it-works/twins')}                                            
            className="px-8 py-3 bg-black text-white rounded-md hover:bg-gray-800 transition-colors     
  text-xl"                                                                                              
          >                                                                                             
            ⟶                                                                                           
          </button>                                                                                     
        </div>                                                                                          
      </div>                                                                                            
    );                                                                                                  
  };                                                                                                    

export default Step2;
