import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function QuizRoom() {
  const navigate = useNavigate();
  const location = useLocation();
  const studentId = localStorage.getItem('userId');
  
  const { itemName = 'Unknown', difficulty = 'Lvl 1: Pre-Test', category = 'General Aviation' } = location.state || {};
  
  const isCAAP = difficulty.includes('CAAP');
  const isOverall = itemName.includes('Overall');

  // --- LIVE DATA STATES ---
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [isLoadingQuiz, setIsLoadingQuiz] = useState(true);
  const [totalItems, setTotalItems] = useState(10); 

  // --- THE FIX: FETCH FROM DB VAULT INSTEAD OF LIVE AI GENERATION ---
  useEffect(() => {
    const fetchVaultQuiz = async () => {
        try {
            const token = localStorage.getItem('token'); // Grab the token
            const res = await fetch('https://ztp98nvz-8000.asse.devtunnels.ms/api/vault/assets', {
                // INJECT THE HEADER HERE
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (res.ok) {
                const data = await res.json();
                
                // Find the professor-approved quiz from the database
                const targetQuiz = data.quizzes?.find(q => 
                    q.category === category && 
                    q.status === 'ACTIVE' && 
                    q.title.includes(itemName.replace(' Overall', ''))
                );

                if (targetQuiz && targetQuiz.content_payload) {
                    const payload = typeof targetQuiz.content_payload === 'string' 
                        ? JSON.parse(targetQuiz.content_payload) 
                        : targetQuiz.content_payload;
                    
                    const questionsArray = payload.questions || payload;
                    setQuizQuestions(questionsArray);
                    setTotalItems(questionsArray.length);
                } else {
                    alert("[SYSTEM FAULT] No active quiz found for this subject in the Vault. A faculty member must publish one.");
                }
            }
        } catch(e) {
            console.error("Database Retrieval Error", e);
        } finally {
            setIsLoadingQuiz(false);
        }
    };
    fetchVaultQuiz();
  }, [itemName, category]);

  // --- FAULT TOLERANCE WITH ABSOLUTE TIME TRACKING ---
  const savedSession = JSON.parse(localStorage.getItem('activeQuizSession'));
  const isResuming = savedSession && savedSession.itemName === itemName && savedSession.difficulty === difficulty;

  let calculatedTime = isOverall ? 1200 : 600; // 20 mins for overall, 10 mins for standard
  if (isResuming) {
    const lastSaved = savedSession.timestamp || Date.now();
    const elapsedSeconds = Math.floor((Date.now() - lastSaved) / 1000);
    calculatedTime = Math.max(0, savedSession.timeLeft - elapsedSeconds);
  }

  const [currentItem, setCurrentItem] = useState(isResuming ? savedSession.currentItem : 1);
  const [correctAnswers, setCorrectAnswers] = useState(isResuming ? savedSession.correctAnswers : 0);
  const [timeLeft, setTimeLeft] = useState(calculatedTime);
  
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showAbortModal, setShowAbortModal] = useState(false);
  const [isFinished, setIsFinished] = useState(calculatedTime === 0);

  // --- THE AUTO-SAVER ENGINE ---
  useEffect(() => {
    if (!isFinished && !showAbortModal && !isLoadingQuiz && quizQuestions.length > 0) {
      localStorage.setItem('activeQuizSession', JSON.stringify({
        itemName, difficulty, category, currentItem, correctAnswers, timeLeft, timestamp: Date.now()
      }));
    }
  }, [currentItem, correctAnswers, timeLeft, itemName, difficulty, category, isFinished, showAbortModal, isLoadingQuiz, quizQuestions]);

  // Timer Engine
  useEffect(() => {
    let timer;
    if (timeLeft > 0 && !isSubmitted && !showAbortModal && !isFinished && !isLoadingQuiz && quizQuestions.length > 0) {
      timer = setInterval(() => {
        setTimeLeft(t => {
          if (t <= 1) {
            clearInterval(timer);
            setIsFinished(true); 
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    } else if (timeLeft === 0 && !isFinished && !isLoadingQuiz && quizQuestions.length > 0) {
      setIsFinished(true);
    }
    return () => clearInterval(timer);
  }, [timeLeft, isSubmitted, showAbortModal, isFinished, isLoadingQuiz, quizQuestions]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const currentQuestionData = quizQuestions[currentItem - 1];

  const handleLockAnswer = () => {
    setIsSubmitted(true);
    if (currentQuestionData && selectedAnswer === currentQuestionData.correct_index) {
        setCorrectAnswers(prev => prev + 1);
    }
  };

  const handleNextItem = () => {
    if (currentItem < totalItems) {
      setCurrentItem(prev => prev + 1); setSelectedAnswer(null); setIsSubmitted(false);
    } else {
      setIsFinished(true); 
    }
  };

  const processFinalScore = async (route) => {
    try {
        const token = localStorage.getItem('token'); // Grab the token
        await fetch('https://ztp98nvz-8000.asse.devtunnels.ms/api/analytics/submit-quiz', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` // INJECT THE HEADER HERE
            },
            body: JSON.stringify({
                student_id: studentId,
                quiz_id: itemName,
                category: category,
                difficulty: difficulty,
                score: correctAnswers,
                total_items: totalItems
            })
        });
    } catch(e) {
        console.error("Failed to sync score to DB");
    }

    localStorage.removeItem('activeQuizSession');
    navigate(route);
  };

  if (isLoadingQuiz) {
      return <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
          <span className="text-4xl animate-spin mb-4">⚙️</span>
          <p className="font-mono text-sm uppercase tracking-widest text-blue-500 animate-pulse">Retrieving Encrypted Assessment...</p>
      </div>;
  }

  if (isFinished) {
    const finalScorePercent = totalItems > 0 ? Math.round((correctAnswers / totalItems) * 100) : 0;
    return (
      <div className="p-4 md:p-10 max-w-2xl mx-auto w-full text-center">
        <h1 className="text-4xl font-bold text-white uppercase mb-2 mt-10">Assessment Complete</h1>
        {timeLeft === 0 && <p className="text-red-500 font-bold uppercase tracking-widest animate-pulse mb-2">Time Expired</p>}
        <p className="text-slate-400 font-mono mb-8">{itemName} | {difficulty}</p>
        
        <div className="bg-slate-800 border border-slate-700 p-8 rounded-xl shadow-2xl mb-8">
           <div className={`text-7xl font-bold mb-2 ${finalScorePercent >= 75 ? 'text-emerald-400' : 'text-red-400'}`}>
             {finalScorePercent}%
           </div>
           <p className="text-slate-300 uppercase tracking-widest text-sm">Final Score ({correctAnswers}/{totalItems})</p>
        </div>

        {finalScorePercent < 100 && (
          <div className="bg-slate-900 border border-amber-500/30 p-6 rounded-xl text-left mb-8 shadow-inner">
             <h3 className="text-amber-400 font-bold uppercase tracking-wider mb-2 flex items-center gap-2"><span>📚</span> Study Recommendations</h3>
             <p className="text-slate-300 text-sm mb-4">Based on your incorrect answers, review the CAAP fundamentals for <span className="font-bold text-white">{category}</span>.</p>
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-4 justify-center">
           <button onClick={() => processFinalScore('/quizzes')} className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-4 px-8 rounded uppercase tracking-wider transition-colors flex-1">Back to Database</button>
           <button onClick={() => processFinalScore('/analytics')} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 px-8 rounded uppercase tracking-wider transition-colors shadow-lg flex-1">Save & View Analytics</button>
        </div>
      </div>
    );
  }

  if (!currentQuestionData) return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
          <p className="text-red-500 font-mono uppercase">Error: Quiz format corrupted.</p>
          <button onClick={() => navigate(-1)} className="mt-4 bg-slate-800 px-4 py-2 rounded text-xs">Return</button>
      </div>
  );

  return (
    <div className="p-4 md:p-10 max-w-4xl mx-auto w-full">
      <header className="flex flex-col md:flex-row justify-between md:items-end mb-6 border-b border-slate-700 pb-4 gap-4 pt-4 md:pt-0">
        <div>
          <span className="text-xs text-amber-500 font-mono uppercase tracking-widest block mb-1">{category} | {difficulty}</span>
          <h1 className="text-2xl md:text-3xl font-bold text-white uppercase tracking-wider leading-tight">{itemName}</h1>
        </div>
        <div className="flex items-center justify-between md:justify-end gap-4 w-full md:w-auto">
          <div className={`font-mono text-xl font-bold px-4 py-2 rounded border flex-1 md:flex-none text-center ${timeLeft < 300 ? 'bg-red-900/50 border-red-500 text-red-400 animate-pulse' : 'bg-slate-800 border-slate-700 text-amber-400'}`}>
            {formatTime(timeLeft)}
          </div>
          <button onClick={() => setShowAbortModal(true)} className="text-xs text-slate-500 hover:text-white uppercase font-bold bg-slate-800 hover:bg-red-600 px-4 py-3 md:py-2 rounded transition-colors flex-1 md:flex-none text-center">Abort</button>
        </div>
      </header>

      {showAbortModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-red-500/50 p-6 md:p-8 rounded-xl shadow-2xl max-w-md w-full">
            <h3 className="text-2xl font-bold text-red-500 uppercase tracking-wider mb-2">Confirm Abort</h3>
            <p className="text-slate-300 mb-6">WARNING: You have answered <span className="text-emerald-400 font-bold">{correctAnswers}</span> correctly. If you cancel, your score will be <span className="text-red-400 font-bold font-mono">{Math.round((correctAnswers / totalItems) * 100)}%</span>.</p>
            <div className="flex gap-4">
              <button onClick={() => setShowAbortModal(false)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded uppercase tracking-wider transition-colors">Resume</button>
              <button onClick={() => processFinalScore('/analytics')} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded uppercase tracking-wider transition-colors">Confirm Score</button>
            </div>
          </div>
        </div>
      )}
      
      <div className="bg-slate-800 p-4 md:p-10 rounded border border-slate-700 shadow-2xl relative">
        <div className="mb-6 md:mb-8 flex justify-between items-center">
          <span className="bg-slate-900 text-slate-400 text-xs font-mono px-3 py-1 rounded border border-slate-700 inline-block">Item {currentItem} of {totalItems}</span>
          <span className="text-xs font-mono text-emerald-400">Current Score: {correctAnswers}</span>
        </div>
        
        <div className="mb-8"><p className="text-lg md:text-2xl text-white leading-relaxed font-medium">{currentQuestionData.text}</p></div>
        
        <div className="space-y-3 md:space-y-4 mb-8">
          {currentQuestionData.options.map((option, idx) => {
            let btnClass = 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'; 
            if (isSubmitted) {
              if (idx === currentQuestionData.correct_index) btnClass = 'bg-emerald-900/40 border-emerald-500 text-emerald-400'; 
              else if (selectedAnswer === idx) btnClass = 'bg-red-900/40 border-red-500 text-red-400'; 
              else btnClass = 'bg-slate-900 border-slate-800 text-slate-600 opacity-50'; 
            } else if (selectedAnswer === idx) btnClass = 'bg-blue-900/40 border-blue-500 text-white shadow-[0_0_15px_rgba(37,99,235,0.2)]'; 
            return (
              <button key={idx} disabled={isSubmitted} onClick={() => setSelectedAnswer(idx)} className={`w-full text-left p-3 md:p-4 rounded border-2 transition-all ${btnClass}`}>
                <span className="font-mono font-bold mr-2 md:mr-3">{['A','B','C','D'][idx]}.</span>{option}
              </button>
            );
          })}
        </div>
        
        {!isSubmitted ? (
          <div className="flex justify-end pt-4 border-t border-slate-700">
            <button onClick={handleLockAnswer} disabled={selectedAnswer === null} className={`w-full md:w-auto py-3 px-10 rounded font-bold uppercase tracking-widest transition-colors ${selectedAnswer !== null ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`}>Lock Answer</button>
          </div>
        ) : (
          <div className={`mt-6 p-4 md:p-6 rounded-lg border-2 ${selectedAnswer === currentQuestionData.correct_index ? 'bg-emerald-900/20 border-emerald-500/50' : 'bg-red-900/20 border-red-500/50'}`}>
             <h3 className={`text-lg md:text-xl font-bold uppercase tracking-wider mb-2 ${selectedAnswer === currentQuestionData.correct_index ? 'text-emerald-400' : 'text-red-400'}`}>{selectedAnswer === currentQuestionData.correct_index ? 'Concept Mastered' : 'RAG Intervention Required'}</h3>
             <p className="text-white mb-4 leading-relaxed text-sm md:text-base">{currentQuestionData.explanation}</p>
             <div className="flex justify-end border-t border-slate-700/50 pt-4 mt-4">
                <button onClick={handleNextItem} className="w-full md:w-auto bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold py-3 px-10 rounded uppercase tracking-widest transition-colors shadow-lg">
                  {currentItem < totalItems ? 'Next Question →' : 'Complete Assessment'}
                </button>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}