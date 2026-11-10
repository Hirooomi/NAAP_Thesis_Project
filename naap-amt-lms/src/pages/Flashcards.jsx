import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { API_BASE_URL } from '../apiConfig';
import GlobalSocketOverlay from '../components/shared/GlobalSocketOverlay';

export default function Flashcards() {
  const navigate = useNavigate();
  const location = useLocation();

  const targetTopic = location.state?.topic || "Aircraft General Principles";
  
  const [flashcards, setFlashcards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchFlashcards = async () => {
    setIsLoading(true);
    try {
      const token = sessionStorage.getItem('token');
      // THE FIX: Corrected backend endpoint to match FastAPI main.py
      const res = await fetch(`${API_BASE_URL}api/modules/flashcards`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ topic: targetTopic, count: 5 })
      });

      if (res.ok) {
        const data = await res.json();
        setFlashcards(data.flashcards || []);
      }
    } catch (err) {
      console.error("Failed to load AI Flashcards", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFlashcards();
  }, [targetTopic]);

  const handleNext = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % flashcards.length);
    }, 150);
  };

  const handlePrev = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev - 1 + flashcards.length) % flashcards.length);
    }, 150);
  };

  return (
    <GlobalSocketOverlay>
      <div className="min-h-screen bg-slate-950 text-slate-300 font-sans p-4 md:p-10 flex flex-col animate-fade-in">
        
        <header className="max-w-4xl mx-auto w-full mb-8 flex justify-between items-end border-b border-slate-800 pb-6">
          <div>
            <button onClick={() => navigate(-1)} className="text-slate-500 hover:text-white text-[10px] font-black uppercase tracking-[0.2em] mb-4 flex items-center gap-2 transition-colors">
              <span>←</span> Return to Dashboard
            </button>
            <h1 className="text-3xl font-black text-white tracking-[0.2em] uppercase">
              AI 3D <span className="text-purple-500">Flashcard Engine</span>
            </h1>
            <p className="text-slate-500 font-mono mt-2 text-xs uppercase tracking-widest">
              Target Concept: <span className="text-emerald-400 font-bold">{targetTopic}</span>
            </p>
          </div>
        </header>

        <main className="max-w-3xl mx-auto w-full flex-grow flex flex-col items-center justify-center relative">
          {isLoading ? (
            <div className="text-center space-y-4">
              <span className="text-5xl animate-pulse block">🧠</span>
              <p className="text-slate-500 font-mono text-xs uppercase tracking-widest">Synthesizing Neural Flashcard Deck...</p>
            </div>
          ) : flashcards.length === 0 ? (
            <div className="text-center space-y-4">
              <p className="text-slate-500 font-mono text-xs uppercase tracking-widest">No flashcards generated for this topic.</p>
            </div>
          ) : (
            <div className="w-full flex flex-col items-center space-y-8">
              
              <div className="text-xs font-mono text-slate-500 tracking-widest uppercase">
                Card <span className="text-purple-400 font-bold">{currentIndex + 1}</span> of {flashcards.length}
              </div>

              <div 
                onClick={() => setIsFlipped(!isFlipped)}
                className="w-full h-96 cursor-pointer perspective-1000 group"
              >
                <div className={`relative w-full h-full duration-500 transform-style-3d shadow-2xl rounded-3xl ${isFlipped ? 'rotate-y-180' : ''}`}>
                  
                  <div className="absolute inset-0 w-full h-full bg-slate-900 border-2 border-slate-800 group-hover:border-purple-500/50 rounded-3xl p-8 flex flex-col justify-between backface-hidden shadow-inner transition-colors">
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-purple-400 font-mono">Question / Concept</span>
                    <div className="flex-grow flex items-center justify-center text-center">
                      <p className="text-xl md:text-2xl text-white font-bold leading-relaxed">{flashcards[currentIndex].question}</p>
                    </div>
                    <p className="text-center text-[10px] text-slate-600 font-mono uppercase tracking-widest">Click anywhere to flip card</p>
                  </div>

                  <div className="absolute inset-0 w-full h-full bg-purple-950/40 border-2 border-purple-500/50 rounded-3xl p-8 flex flex-col justify-between backface-hidden rotate-y-180 shadow-[0_0_50px_rgba(168,85,247,0.15)]">
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-400 font-mono">Verified Answer / Explanation</span>
                    <div className="flex-grow flex items-center justify-center text-center">
                      <p className="text-lg md:text-xl text-slate-200 font-medium leading-relaxed">{flashcards[currentIndex].answer}</p>
                    </div>
                    <p className="text-center text-[10px] text-purple-400/60 font-mono uppercase tracking-widest">Click to flip back</p>
                  </div>

                </div>
              </div>

              <div className="flex gap-4 w-full max-w-md">
                <button 
                  onClick={handlePrev}
                  className="flex-1 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 shadow-lg"
                >
                  ← Previous
                </button>
                <button 
                  onClick={handleNext}
                  className="flex-1 bg-purple-600 hover:bg-purple-500 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-purple-900/30"
                >
                  Next Card →
                </button>
              </div>

            </div>
          )}
        </main>
      </div>
    </GlobalSocketOverlay>
  );
}