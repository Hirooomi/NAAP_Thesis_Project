import { useState, useEffect, useRef } from 'react';
import { questionBank } from '../data/mockData';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../apiConfig';
import GlobalSocketOverlay from '../components/shared/GlobalSocketOverlay';
// THE FIX: Import universal silent sync hook
import useLiveSync from '../components/shared/useLiveSync';

export default function Dashboard() {
  const navigate = useNavigate();
  const [globalSearch, setGlobalSearch] = useState('');
  const [activeSession, setActiveSession] = useState(null);
  const [displayTime, setDisplayTime] = useState(null);
  const [showAbortModal, setShowAbortModal] = useState(false);
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [recentModules, setRecentModules] = useState([]);
  const [mostStudiedModules, setMostStudiedModules] = useState([]);

  const [isSearching, setIsSearching] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [followUpText, setFollowUpText] = useState('');
  const chatEndRef = useRef(null);

  const studentId = sessionStorage.getItem('userId') || 'UNKNOWN ID';
  const studentName = sessionStorage.getItem('name') || sessionStorage.getItem('studentName') || 'GUEST USER';

  // THE FIX: Silent fetch implementation for live student analytics
  const { data: analyticsData } = useLiveSync(`api/analytics/student/${studentId}`, ['NEW_TELEMETRY', 'VAULT_UPDATE']);
  
  // Calculate attention quizzes directly from synced data
  const logs = analyticsData?.logs || [];
  const topicsMap = new Map();
  [...logs].reverse().forEach(log => topicsMap.set(log.topic, log));
  const attentionQuizzes = [];
  topicsMap.forEach((latestLog) => {
      if (latestLog.score < 75) attentionQuizzes.push(latestLog);
  });

  useEffect(() => {
    const interruptedSession = localStorage.getItem('activeQuizSession');
    let timer = null;
    if (interruptedSession) {
        const parsedSession = JSON.parse(interruptedSession);
        setActiveSession(parsedSession);
        const updateTimer = () => {
            const lastSaved = parsedSession.timestamp || Date.now();
            const elapsedSeconds = Math.floor((Date.now() - lastSaved) / 1000);
            setDisplayTime(Math.max(0, parsedSession.timeLeft - elapsedSeconds));
        };
        updateTimer();
        timer = setInterval(updateTimer, 1000);
    }

    const moduleLogs = JSON.parse(localStorage.getItem('moduleLogs')) || [];
    const freq = {};
    moduleLogs.forEach(m => { freq[m.topic] = (freq[m.topic] || 0) + 1; });
    const sortedModules = Object.entries(freq).map(([topic, count]) => ({ topic, count })).sort((a, b) => b.count - a.count);
    setMostStudiedModules(sortedModules);
    setRecentModules(moduleLogs.slice(0, 10));

    return () => {
        if (timer) clearInterval(timer);
    };
  }, []);
  
  useEffect(() => {
      if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isSearching]);

  const formatTime = (seconds) => {
    if (seconds === null) return '';
    if (seconds <= 0) return 'TIME EXPIRED';
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `⏳ ${m}:${s} REMAINING`;
  };

  const handleSignOutRequest = () => {
    if (activeSession) {
        alert("SECURITY PROTOCOL: You cannot sign out during an active exam. Please abort or submit your exam first.");
        return;
    }
    setShowSignOutModal(true);
  };

  const executeSearch = async (queryText, isFollowUp = false) => {
    if (!queryText.trim()) return;

    setIsSearching(true);
    
    if (!isFollowUp) {
        setChatHistory([{ role: 'user', text: queryText }]);
    } else {
        setChatHistory(prev => [...prev, { role: 'user', text: queryText }]);
    }

    try {
      const token = sessionStorage.getItem('token');
      
      const contextualQuery = isFollowUp 
        ? `Previous Conversation Context:\n${chatHistory.map(m => `${m.role.toUpperCase()}:${m.text}`).join('\n')}\n\nNew Follow-up Question: ${queryText}`
        : queryText;

      const res = await fetch(`${API_BASE_URL}api/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ query: contextualQuery })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.summary) {
          const uniqueSources = [];
          const titles = new Set();
          (data.sources || []).forEach(src => {
             if (!titles.has(src.title)) {
                titles.add(src.title);
                uniqueSources.push(src);
             }
          });
          
          setChatHistory(prev => [...prev, { 
              role: 'ai', 
              text: data.summary, 
              sources: uniqueSources 
          }]);
        }
      } else {
        alert("Search failed. Ensure AI engine is online.");
      }
    } catch (err) {
      alert("Network error: Could not reach NAAP servers.");
    } finally {
      setIsSearching(false);
      setGlobalSearch('');
      setFollowUpText('');
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

  const handleConfirmAbort = async () => {
    if (!activeSession) return;
    try {
        const token = sessionStorage.getItem('token') || localStorage.getItem('token'); 
        await fetch(`${API_BASE_URL}api/analytics/submit-quiz`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
                student_id: studentId,
                quiz_id: activeSession.itemName,
                category: activeSession.category || "General Aviation",
                difficulty: activeSession.difficulty,
                score: activeSession.correctAnswers,
                total_items: totalItems
            })
        });
    } catch(e) { console.error("Failed to sync score"); }

    localStorage.removeItem('activeQuizSession');
    setActiveSession(null);
    setShowAbortModal(false);
    navigate('/analytics');
  };

  return (
    <GlobalSocketOverlay>
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

        {showSignOutModal && (
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-slate-900 border border-slate-700 p-6 md:p-8 rounded-xl shadow-2xl max-w-md w-full">
              <h3 className="text-2xl font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-2"><span>🚪</span> Confirm Sign Out</h3>
              <p className="text-slate-300 mb-6 font-mono text-sm">Are you sure you want to securely end your session and log out of the NAAP database?</p>
              <div className="flex flex-col sm:flex-row gap-4">
                <button onClick={() => setShowSignOutModal(false)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded uppercase tracking-wider transition-colors">Cancel</button>
                <button onClick={() => { sessionStorage.clear(); navigate('/login'); }} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded uppercase tracking-wider transition-colors shadow-lg shadow-red-900/20">Sign Out</button>
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
              <button onClick={handleSignOutRequest} className="mt-4 md:mt-0 bg-slate-900 hover:bg-red-900/40 text-slate-500 hover:text-red-400 border border-slate-800 hover:border-red-500/50 px-6 py-4 rounded-2xl transition-colors font-black uppercase tracking-[0.2em] text-xs h-full active:scale-95">Sign Out</button>
            </header>

            <form onSubmit={(e) => { e.preventDefault(); executeSearch(globalSearch, false); }} className="bg-slate-800 p-2 rounded-lg border border-slate-700 flex flex-col md:flex-row items-center shadow-lg focus-within:border-emerald-500 transition-colors gap-2 md:gap-0 relative z-20">
              <div className="flex w-full items-center flex-1">
                 <span className="text-xl px-4 text-emerald-500">{isSearching && chatHistory.length === 0 ? '⏳' : '🤖'}</span>
                 <input 
                   type="text" 
                   value={globalSearch} 
                   onChange={(e) => setGlobalSearch(e.target.value)} 
                   placeholder={isSearching && chatHistory.length === 0 ? "Synthesizing AI Answer..." : "Semantic Search: Ask a specific technical question..."} 
                   disabled={isSearching}
                   className="bg-transparent border-none text-white w-full py-3 outline-none text-base md:text-lg disabled:opacity-50" 
                   required={chatHistory.length === 0} 
                 />
              </div>
              <button type="submit" disabled={isSearching || !globalSearch.trim()} className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-3 rounded font-bold tracking-wider uppercase text-sm mr-0 md:mr-1 disabled:opacity-50 transition-colors shadow-[0_0_15px_rgba(16,185,129,0.3)]">Ask AI</button>
            </form>

            {chatHistory.length > 0 && (
               <div className="bg-slate-900 border-2 border-emerald-500/50 rounded-2xl flex flex-col shadow-[0_0_30px_rgba(16,185,129,0.15)] animate-fade-in relative z-10 overflow-hidden mt-6">
                  <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar max-h-[600px] space-y-6">
                     {chatHistory.map((msg, idx) => (
                        <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                           {msg.role === 'ai' && (
                               <div className="flex items-center gap-3 mb-2">
                                   <span className="text-xl text-emerald-400">🧠</span>
                                   <h3 className="text-white font-black uppercase tracking-widest text-sm">AI Tutor</h3>
                               </div>
                           )}
                           <div className={`p-4 rounded-2xl max-w-[85%] ${msg.role === 'user' ? 'bg-slate-800 text-emerald-100 border border-slate-700 rounded-tr-none' : 'bg-transparent text-slate-300 font-serif text-lg leading-relaxed'}`}>
                              {msg.text}
                           </div>
                           
                           {msg.role === 'ai' && msg.sources && msg.sources.length > 0 && (
                              <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 mt-4 w-full max-w-[85%]">
                                 <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">Extracted Source Material</p>
                                 <div className="flex flex-col gap-2">
                                    {msg.sources.map((src, i) => (
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
                     ))}
                     {isSearching && chatHistory[chatHistory.length - 1]?.role === 'user' && (
                         <div className="flex items-center gap-3 text-emerald-500 font-mono text-sm animate-pulse">
                             <span>🧠</span> Synthesizing response...
                         </div>
                     )}
                     <div ref={chatEndRef} />
                  </div>
                  
                  <div className="p-4 bg-slate-950 border-t border-slate-800">
                     <form onSubmit={(e) => { e.preventDefault(); executeSearch(followUpText, true); }} className="relative flex items-center">
                        <input 
                           type="text" 
                           value={followUpText}
                           onChange={(e) => setFollowUpText(e.target.value)}
                           placeholder="Ask a follow-up question..." 
                           disabled={isSearching}
                           className="w-full bg-slate-900 border border-slate-700 text-white rounded-full py-4 pl-6 pr-16 outline-none focus:border-emerald-500 transition-colors disabled:opacity-50"
                        />
                        <button type="submit" disabled={isSearching || !followUpText.trim()} className="absolute right-2 top-1/2 -translate-y-1/2 bg-emerald-600 hover:bg-emerald-500 text-white w-10 h-10 rounded-full flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                           ↑
                        </button>
                     </form>
                  </div>
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
                          <div className="w-full bg-slate-800 rounded-full h-2 mt-1 mb-3 border border-slate-700">
                            <div className="bg-red-500 h-2 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.5)]" style={{ width: `${log.score}%` }}></div>
                          </div>
                          
                          <button 
                             onClick={() => navigate('/flashcards', { state: { topic: log.topic } })}
                             className="w-full bg-red-900/30 hover:bg-red-800 text-red-400 hover:text-white border border-red-500/30 py-2 rounded text-[10px] uppercase font-black tracking-widest transition-colors flex items-center justify-center gap-2 shadow-inner"
                          >
                             <span>🧠</span> Launch AI Remedial Study
                          </button>
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
    </GlobalSocketOverlay>
  );
}