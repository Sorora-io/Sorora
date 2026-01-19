import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';


const Step2 = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-8">
            <header className="mb-12">
                <h1 className="text-4xl font-bold text-center">
                    Sorora: <i>How It Works</i>
                </h1>
            </header>
        
            <div className="max-w-4xl w-full bg-white rounded-lg shadow-lg p-8">                            
          <h3 className="text-2xl font-semibold mb-6">Step 2: Greedy Algorithm</h3>                         
          <p className="text-lg leading-relaxed">                                                       
            We calculate the distance between all rankings as BigRanking - LittleRanking, and then we use a greedy algorithm to minimize the distances for all matches. If a big or a little does not rank another big, the distance is "infinite."                                                                        
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
