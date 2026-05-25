import { useState, useEffect } from 'react';
import { questionBank } from '../data/mockData';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const navigate = useNavigate();
  const [globalSearch, setGlobalSearch] = useState('');
  const [activeSession, setActiveSession] = useState(null);
  const [displayTime, setDisplayTime] = useState(null);
  const [showAbortModal, setShowAbortModal] = useState(false);

  const [recentModules, setRecentModules] = useState([]);
  const [mostStudiedModules, setMostStudiedModules] = useState([]);
  const [attentionQuizzes, setAttentionQuizzes] = useState([]);

  // --- RAG SEARCH STATES ---
  const [isSearching, setIsSearching] = useState(false);
  const [ragSummary, setRagSummary] = useState(null);
  const [ragSources, setRagSources] = useState([]);

  const studentId = localStorage.getItem('userId') || '12324MN-000480';
  const studentName = localStorage.getItem('studentName') || 'GUEST USER';

useEffect(() => {

    // THE FIX 1: Fetch live analytics from the PostgreSQL DB instead of local storage
    const fetchLiveAnalytics = async () => {
        try {
            const token = localStorage.getItem('token'); // Grab the token
            const res = await fetch(`https://ztp98nvz-8000.asse.devtunnels.ms/api/analytics/student/${studentId}`, {
                // INJECT THE HEADER HERE
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (res.ok) {
                const data = await res.json();
                const logs = data.logs || [];

                // Map the latest scores to find which ones need attention (< 75)
                const topicsMap = new Map();
                [...logs].reverse().forEach(log => topicsMap.set(log.topic, log));

                const needsAttention = [];
                topicsMap.forEach((latestLog) => {
                    if (latestLog.score < 75) needsAttention.push(latestLog);
                });

                setAttentionQuizzes(needsAttention);
            }
        } catch (e) {
            console.error("Failed to fetch live analytics for dashboard", e);
        }
    };

    // THE FIX: Listen for Live Backend WebSocket Events
    const token = localStorage.getItem('token');
const ws = new WebSocket(`wss://ztp98nvz-8000.asse.devtunnels.ms/api/ws/connect?token=${token}`);

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (
            data.event === "NEW_TELEMETRY" ||
            data.event === "VAULT_UPDATE"
        ) {
            console.log("[WS] Live Update Detected, refreshing Student Data...");
            fetchLiveAnalytics();
        }
    };

    // Initial Fetch
    fetchLiveAnalytics();

    // Check for interrupted test sessions
    const interruptedSession = localStorage.getItem('activeQuizSession');

    let timer = null;

    if (interruptedSession) {
        const parsedSession = JSON.parse(interruptedSession);

        setActiveSession(parsedSession);

        const updateTimer = () => {
            const lastSaved = parsedSession.timestamp || Date.now();
            const elapsedSeconds = Math.floor((Date.now() - lastSaved) / 1000);

            setDisplayTime(
                Math.max(0, parsedSession.timeLeft - elapsedSeconds)
            );
        };

        updateTimer();

        timer = setInterval(updateTimer, 1000);
    }

    // Still using local storage for read logs until backend reading telemetry is built
    const moduleLogs = JSON.parse(localStorage.getItem('moduleLogs')) || [];

    const freq = {};

    moduleLogs.forEach(m => {
        freq[m.topic] = (freq[m.topic] || 0) + 1;
    });

    const sortedModules = Object.entries(freq)
        .map(([topic, count]) => ({ topic, count }))
        .sort((a, b) => b.count - a.count);

    setMostStudiedModules(sortedModules);
    setRecentModules(moduleLogs.slice(0, 10));

    // CLEANUP
    return () => {
        ws.close();

        if (timer) {
            clearInterval(timer);
        }
    };

}, [studentId]);
  
  const formatTime = (seconds) => {
    if (seconds === null) return '';
    if (seconds <= 0) return 'TIME EXPIRED';
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `⏳ ${m}:${s} REMAINING`;
  };

  // --- THE INTELLIGENT RAG SEARCH ENGINE (DEDUPLICATED) ---
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!globalSearch.trim()) return;

    setIsSearching(true);
    setRagSummary(null);
    setRagSources([]);

    try {
      const token = localStorage.getItem('token');
const res = await fetch('https://ztp98nvz-8000.asse.devtunnels.ms/api/vault/rag-search', {
    method: 'POST',
    headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` // INJECT THIS HERE
    },
    body: JSON.stringify({ query: searchQuery })
});

      if (res.ok) {
        const data = await res.json();
        if (data.status === 'success' && data.data) {
          setRagSummary(data.data.summary);
          
          // Automatically deduplicate sources by title
          const uniqueSources = [];
          const titles = new Set();
          (data.data.sources || []).forEach(src => {
             if (!titles.has(src.title)) {
                titles.add(src.title);
                uniqueSources.push(src);
             }
          });
          setRagSources(uniqueSources);
        }
      } else {
        alert("Search failed. Ensure AI engine is online.");
      }
    } catch (err) {
      alert("Network error.");
    } finally {
      setIsSearching(false);
    }
  };

  let totalItems = 10;
  let currentScorePercent = 0;
  if (activeSession) {
    const isCAAP = activeSession.difficulty.includes('CAAP');
    const isLvl2 = activeSession.difficulty.includes('Lvl 2');
    const isOverall = activeSession.itemName.includes('Overall');
    const dataKey = isCAAP ? 'CAAP Exam' : isLvl2 ? 'Lvl 2: Advanced' : 'Lvl 1: Easy';
    const quizData = questionBank[dataKey] || questionBank['Lvl 1: Easy'];
    totalItems = isOverall ? quizData.totalItems * 2 : quizData.totalItems;
    currentScorePercent = Math.round((activeSession.correctAnswers / totalItems) * 100) || 0;
  }

  // THE FIX 2: Send aborted score to backend Database instead of local storage
  const handleConfirmAbort = async () => {
    if (!activeSession) return;
    
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
                quiz_id: activeSession.itemName,
                category: activeSession.category || "General Aviation",
                difficulty: activeSession.difficulty,
                score: activeSession.correctAnswers,
                total_items: totalItems
            })
        });
    } catch(e) {
        console.error("Failed to sync aborted score to DB");
    }

    localStorage.removeItem('activeQuizSession');
    setActiveSession(null);
    setShowAbortModal(false);
    navigate('/analytics');
  };

  return (
    <div className="p-4 md:p-10 max-w-6xl mx-auto space-y-8 w-full animate-fade-in">
      
      {showAbortModal && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-red-500/50 p-6 md:p-8 rounded-xl shadow-2xl max-w-md w-full">
            <h3 className="text-2xl font-bold text-red-500 uppercase tracking-wider mb-2">Confirm Abort</h3>
            <p className="text-slate-300 mb-6">WARNING: You have answered <span className="text-emerald-400 font-bold">{activeSession?.correctAnswers || 0}</span> items correctly out of {totalItems}. If you cancel now, your score will be permanently recorded as <span className="text-red-400 font-bold font-mono">{currentScorePercent}%</span>.</p>
            <div className="flex flex-col sm:flex-row gap-4">
              <button onClick={() => setShowAbortModal(false)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded uppercase tracking-wider transition-colors">Go Back</button>
              <button onClick={handleConfirmAbort} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded uppercase tracking-wider transition-colors shadow-[0_0_15px_rgba(220,38,38,0.4)]">Confirm {currentScorePercent}%</button>
            </div>
          </div>
        </div>
      )}

      {activeSession && (
        <div className={`border p-6 md:p-8 rounded-xl shadow-2xl mt-4 md:mt-10 flex flex-col transition-colors ${displayTime <= 0 ? 'bg-red-900/40 border-red-500/50' : 'bg-amber-900/40 border-amber-500/50 animate-pulse'}`}>
          <div className="mb-6">
             <h3 className={`text-xl md:text-2xl ${displayTime <= 0 ? 'text-red-400' : 'text-amber-400'} font-bold uppercase tracking-wider mb-2 flex items-center gap-2`}><span>⚠️</span> {displayTime <= 0 ? 'Assessment Time Expired' : 'Interrupted Assessment Detected'}</h3>
             <p className="text-slate-300 text-base md:text-lg mb-4">You are currently locked out of the NAAP database due to an active assessment for <span className="font-bold text-white uppercase">{activeSession.itemName}</span>.</p>
             {displayTime !== null && <span className={`font-mono font-bold text-sm md:text-base px-4 py-2 rounded border ${displayTime <= 0 ? 'bg-red-950 text-red-500 border-red-500/50' : 'bg-amber-950 text-amber-500 border-amber-500/50'}`}>{formatTime(displayTime)}</span>}
          </div>
          <div className="flex flex-col sm:flex-row gap-4 w-full">
            <button onClick={() => setShowAbortModal(true)} className="w-full sm:w-1/3 bg-slate-800 hover:bg-red-600 text-white font-bold py-4 px-6 rounded uppercase tracking-widest transition-colors shadow-lg border border-slate-700 hover:border-red-500">Abort Exam</button>
            <button onClick={() => navigate('/quiz', { state: { itemName: activeSession.itemName, difficulty: activeSession.difficulty } })} className={`w-full sm:w-2/3 text-white font-bold py-4 px-8 rounded uppercase tracking-widest transition-colors shadow-lg ${displayTime <= 0 ? 'bg-red-600 hover:bg-red-500' : 'bg-amber-600 hover:bg-amber-500'}`}>{displayTime <= 0 ? 'Submit Score' : 'Resume Assessment'}</button>
          </div>
        </div>
      )}

      {!activeSession && (
        <>
          <header className="mb-8 flex flex-col md:flex-row justify-between items-start border-b border-slate-800 pb-6 pt-4 md:pt-0">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-white tracking-wider leading-tight">Welcome,<br className="md:hidden"/> <span className="text-blue-400 uppercase">{studentName}</span></h2>
              <p className="text-slate-500 font-mono mt-2 text-sm md:text-base">ID: {studentId} | Active Session</p>
            </div>
            <button onClick={() => navigate('/login')} className="mt-4 md:mt-0 bg-slate-900 hover:bg-red-900/40 text-slate-500 hover:text-red-400 border border-slate-800 hover:border-red-500/50 px-6 py-4 rounded-2xl transition-colors font-black uppercase tracking-[0.2em] text-xs h-full active:scale-95">Sign Out</button>
          </header>

          <form onSubmit={handleSearch} className="bg-slate-800 p-2 rounded-lg border border-slate-700 flex flex-col md:flex-row items-center shadow-lg focus-within:border-emerald-500 transition-colors gap-2 md:gap-0 relative z-20">
            <div className="flex w-full items-center flex-1">
               <span className="text-xl px-4 text-emerald-500">{isSearching ? '⏳' : '🤖'}</span>
               <input 
                 type="text" 
                 value={globalSearch} 
                 onChange={(e) => setGlobalSearch(e.target.value)} 
                 placeholder={isSearching ? "Synthesizing AI Answer..." : "Semantic Search: Ask a specific technical question..."} 
                 disabled={isSearching}
                 className="bg-transparent border-none text-white w-full py-3 outline-none text-base md:text-lg disabled:opacity-50" 
                 required 
               />
            </div>
            <button type="submit" disabled={isSearching} className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-3 rounded font-bold tracking-wider uppercase text-sm mr-0 md:mr-1 disabled:opacity-50 transition-colors shadow-[0_0_15px_rgba(16,185,129,0.3)]">Ask AI</button>
          </form>

          {/* THE AI ANSWER BOX */}
          {ragSummary && (
             <div className="bg-slate-900 border-2 border-emerald-500/50 rounded-2xl p-6 md:p-8 shadow-[0_0_30px_rgba(16,185,129,0.15)] animate-fade-in relative z-10">
                <div className="flex items-center gap-3 mb-4 border-b border-slate-800 pb-4">
                   <span className="text-2xl text-emerald-400">🧠</span>
                   <h3 className="text-white font-black uppercase tracking-widest text-lg">AI Answer</h3>
                </div>
                <p className="text-slate-300 leading-relaxed font-serif text-lg mb-6">{ragSummary}</p>
                
                {ragSources.length > 0 && (
                   <div className="bg-slate-950 rounded-xl p-4 border border-slate-800">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">Extracted Source Material</p>
                      <div className="flex flex-col gap-2">
                         {ragSources.map((src, i) => (
                           <button 
                              key={i} 
                              onClick={() => navigate('/reader', { state: { itemName: src.title, highlightRef: src.content } })}
                              className="text-left bg-slate-900 hover:bg-blue-900/20 border border-slate-800 hover:border-blue-500/50 p-3 rounded-lg transition-colors group flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                           >
                              <span className="text-blue-400 font-bold text-sm truncate uppercase tracking-wide group-hover:text-blue-300">{src.title}</span>
                              <span className="text-[9px] font-black text-slate-500 bg-slate-950 px-2 py-1 rounded shrink-0 uppercase group-hover:text-blue-400">Open Module & Highlight →</span>
                           </button>
                         ))}
                      </div>
                   </div>
                )}
             </div>
          )}

          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 md:p-8 shadow-2xl mt-6 relative z-0">
             <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] mb-6 border-b border-slate-700 pb-3">Academic Progress Overview</h3>
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
                
                <div className="bg-slate-900 p-5 rounded-xl border border-slate-700 flex flex-col h-64 shadow-inner">
                  <p className="text-xs text-blue-400 uppercase font-black tracking-widest mb-4 shrink-0">Most Studied Modules</p>
                  <ul className="space-y-3 font-mono text-sm overflow-y-auto pr-2 flex-grow custom-scrollbar">
                    {mostStudiedModules.length === 0 ? <li className="text-slate-600 text-xs">No modules opened yet.</li> : mostStudiedModules.map((item, idx) => (
                      <li key={idx} className="flex justify-between items-center border-b border-slate-800 pb-3">
                        <span className="text-white truncate pr-2">{item.topic}</span>
                        <span className="text-blue-400 text-[10px] bg-blue-900/30 px-2 py-1 rounded border border-blue-500/30">{item.count} Reads</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-slate-900 p-5 rounded-xl border border-slate-700 flex flex-col h-64 shadow-inner">
                  <p className="text-xs text-emerald-400 uppercase font-black tracking-widest mb-4 shrink-0">Recently Read Modules</p>
                  <ul className="space-y-3 font-mono text-sm overflow-y-auto pr-2 flex-grow custom-scrollbar">
                    {recentModules.length === 0 ? <li className="text-slate-600 text-xs">No reading data recorded.</li> : recentModules.map((log, idx) => (
                      <li key={idx} className="flex justify-between items-center border-b border-slate-800 pb-3">
                        <span className="text-white truncate pr-2">{log.topic}</span>
                        <span className="text-[10px] text-emerald-400 shrink-0">{log.date}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-slate-900 p-5 rounded-xl border border-red-900/50 flex flex-col h-64 relative overflow-hidden shadow-inner">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 rounded-bl-full pointer-events-none"></div>
                  <p className="text-xs text-red-400 uppercase font-black tracking-widest mb-4 shrink-0 relative z-10">Quiz Interventions</p>
                  <ul className="space-y-4 font-mono text-sm overflow-y-auto pr-2 flex-grow custom-scrollbar relative z-10">
                    {attentionQuizzes.length === 0 ? <li className="text-slate-600 text-xs">All active topics are passing (≥75%).</li> : attentionQuizzes.map((log, idx) => (
                      <li key={idx} className="flex flex-col border-b border-slate-800 pb-3">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-white truncate pr-2">{log.topic}</span>
                          <span className="text-[10px] bg-red-900/50 text-red-400 px-1.5 py-0.5 rounded uppercase border border-red-500/30">{log.score}% FAIL</span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-2 mt-1 border border-slate-700">
                          <div className="bg-red-500 h-2 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.5)]" style={{ width: `${log.score}%` }}></div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
            <button onClick={() => navigate('/modules')} className="bg-slate-800 border border-slate-700 hover:border-blue-500 p-8 rounded-2xl text-left group transition-all shadow-xl hover:-translate-y-1 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <h2 className="text-2xl font-black text-white uppercase tracking-widest group-hover:text-blue-400 mb-2 transition-colors">Module Library</h2>
              <p className="text-slate-400 text-sm">Access theoretical study materials across all CAAP subjects.</p>
            </button>
            <button onClick={() => navigate('/quizzes')} className="bg-slate-800 border border-slate-700 hover:border-amber-500 p-8 rounded-2xl text-left group transition-all shadow-xl hover:-translate-y-1 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <h2 className="text-2xl font-black text-white uppercase tracking-widest group-hover:text-amber-400 mb-2 transition-colors">Theoretical Quiz Bank</h2>
              <p className="text-slate-400 text-sm">Take adaptive assessments with algorithmic RAG feedback.</p>
            </button>
          </div>
        </>
      )}
    </div>
  );
}