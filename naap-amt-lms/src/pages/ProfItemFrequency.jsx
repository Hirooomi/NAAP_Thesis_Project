import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function ProfItemFrequency() {
  const navigate = useNavigate();

  // THE FIX: State for dynamically loaded and tallied questions
  const [quizData, setQuizData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
      const fetchAndTallyData = async () => {
          try {
              // 1. Fetch Global Telemetry
              const analyticsRes = await fetch(`https://ztp98nvz-8000.asse.devtunnels.ms/api/analytics/global`);
              const analyticsData = await analyticsRes.json();
              const logs = analyticsData.logs || [];

              // 2. Fetch Vault Quizzes
              const vaultRes = await fetch(`https://ztp98nvz-8000.asse.devtunnels.ms/api/vault/assets`);
              const vaultData = await vaultRes.json();
              const quizzes = vaultData.quizzes || [];

              // 3. Aggregate logic: Tally right and wrong across all active quizzes
              const tallyMap = {};
              
              // We aggregate the logs to see how many got right vs wrong based on standard items
              logs.forEach(log => {
                  const qId = log.quiz_id || log.topic || "Unknown";
                  const score = parseInt(String(log.score).replace('%', ''));
                  const total = parseInt(log.total_items) || 10;
                  
                  if (!isNaN(score)) {
                      if (!tallyMap[qId]) {
                          tallyMap[qId] = {
                              id: qId,
                              lvl: log.difficulty || "LVL 1",
                              q: `Assessment Block: ${qId}`, // Fallback if no specific question text
                              right: 0,
                              wrong: 0,
                              review: false
                          };
                      }
                      // Estimate correct/incorrect tallies per assessment
                      const rightAnswers = Math.round((score / 100) * total);
                      const wrongAnswers = total - rightAnswers;
                      
                      tallyMap[qId].right += rightAnswers;
                      tallyMap[qId].wrong += wrongAnswers;
                      
                      // Auto-flag review if fail rate exceeds 50%
                      const failRate = tallyMap[qId].wrong / (tallyMap[qId].right + tallyMap[qId].wrong);
                      if (failRate >= 0.5) tallyMap[qId].review = true;
                  }
              });

              setQuizData(Object.values(tallyMap));
          } catch (e) {
              console.error("Failed to map item frequencies");
          } finally {
              setIsLoading(false);
          }
      };
      
      fetchAndTallyData();
  }, []);
// THE FIX: Listen for Live Backend WebSocket Events
    const token = localStorage.getItem('token');
const ws = new WebSocket(`wss://ztp98nvz-8000.asse.devtunnels.ms/api/ws/connect?token=${token}`);
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.event === "NEW_TELEMETRY" || data.event === "VAULT_UPDATE") {
            console.log("[WS] Tally Changed! Running Recalculation Algorithm...");
            fetchAndTallyData(); // Instantly recalculate item fail rates!
        }
    };
    return () => ws.close(); // Cleanup
  if (isLoading) {
      return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-amber-500 font-mono text-sm animate-pulse uppercase tracking-widest">Running Tally Algorithms...</div>;
  }

  const itemsAnalyzed = quizData.length;
  const flaggedQuestions = quizData.filter(q => q.review).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 font-sans p-4 md:p-10 animate-fade-in">
      <div className="max-w-[100rem] mx-auto w-full">
        
        {/* HEADER & RETURN */}
        <button onClick={() => navigate('/prof')} className="text-slate-600 hover:text-white text-[10px] font-black uppercase tracking-[0.2em] mb-8 flex items-center gap-2 transition-colors">
          <span>←</span> Return to Command Center
        </button>

        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end mb-10 border-b border-slate-800 pb-8 gap-6">
          <div>
            <h1 className="text-4xl md:text-5xl font-black text-white tracking-[0.1em] uppercase mb-2">
              Item Frequency <span className="text-amber-500">Analysis</span>
            </h1>
            <p className="text-slate-500 font-mono text-[10px] uppercase tracking-widest">Identify Critical Algorithmic Weak Points</p>
          </div>
        </div>

        {/* TOP METRIC CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between h-32">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Items Analyzed</h3>
            <span className="text-5xl font-black text-blue-500">{itemsAnalyzed}</span>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between h-32 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-900/10 rounded-bl-full pointer-events-none"></div>
            <h3 className="text-[10px] font-black text-red-400 uppercase tracking-widest relative z-10">Flagged Questions (High Fail Rate)</h3>
            <span className="text-5xl font-black text-red-500 relative z-10">{flaggedQuestions}</span>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex items-center justify-center h-32">
            <select className="bg-slate-950 border border-slate-800 text-white w-full h-full text-xs font-black px-4 rounded-xl outline-none cursor-pointer uppercase tracking-widest">
              <option>Filter By: All Difficulties</option>
              <option>Filter By: Level 1</option>
              <option>Filter By: Level 2</option>
            </select>
          </div>
        </div>

        {/* BREAKDOWN LIST */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-10 shadow-2xl">
          <div className="flex justify-between items-center mb-8 border-b border-slate-800 pb-4">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Quiz Item Breakdown</h3>
            <span className="text-[9px] font-black px-3 py-1.5 rounded uppercase tracking-widest bg-slate-950 border border-slate-800 text-slate-500">Live Database Tally</span>
          </div>

          <div className="space-y-6">
            {quizData.length === 0 ? <p className="text-center font-mono text-slate-600 py-10 uppercase tracking-widest">No item data recorded in the vault.</p> : quizData.map((item, i) => {
              const total = item.right + item.wrong;
              const rightPercent = total > 0 ? Math.round((item.right / total) * 100) : 0;
              const wrongPercent = total > 0 ? 100 - rightPercent : 0;

              return (
                <div key={i} className={`bg-slate-950 border ${item.review ? 'border-red-900/50 shadow-[0_0_15px_rgba(239,68,68,0.1)]' : 'border-slate-800'} rounded-2xl p-6 md:p-8 relative`}>
                  
                  {/* Headers */}
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-3">
                      <span className="text-[9px] font-black px-3 py-1 rounded bg-blue-900/20 text-blue-400 border border-blue-900/50 uppercase">{item.lvl}</span>
                      <span className="text-[10px] font-mono font-black text-slate-500 uppercase">{item.id}</span>
                      {item.review && <span className="text-[9px] font-black px-3 py-1 rounded bg-red-600 text-white uppercase tracking-widest ml-2 animate-pulse shadow-lg shadow-red-900/50">Review Required</span>}
                    </div>
                    
                    {/* Tally Numbers */}
                    <div className="flex gap-8 text-center hidden md:flex">
                      <div><span className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Right</span><span className="text-xl font-black text-emerald-400">{item.right}</span></div>
                      <div><span className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Wrong</span><span className="text-xl font-black text-red-400">{item.wrong}</span></div>
                    </div>
                  </div>

                  {/* Question Text */}
                  <h4 className="text-sm md:text-base font-bold text-white mb-8 max-w-4xl leading-relaxed">{item.q}</h4>

                  {/* Progress Bar Container */}
                  <div className="w-full relative">
                    <div className="flex h-3 rounded-full overflow-hidden bg-slate-900 mb-3 shadow-inner">
                      <div className="bg-emerald-500 transition-all duration-1000" style={{ width: `${rightPercent}%` }}></div>
                      <div className="bg-red-500 transition-all duration-1000" style={{ width: `${wrongPercent}%` }}></div>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">{rightPercent}% Success Rate</span>
                      <span className="text-[10px] font-black uppercase tracking-widest text-red-500">{wrongPercent}% Fail Rate</span>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}