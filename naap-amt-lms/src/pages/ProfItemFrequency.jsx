import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../apiConfig';

export default function ProfItemFrequency() {
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState([]);
  const [selectedQuizId, setSelectedQuizId] = useState('');
  const [analysisData, setAnalysisData] = useState([]);
  const [isLoading, setIsLoading] = useState(false); // Default to false to prevent initial spin

  const fetchQuizzes = async () => {
    try {
      const token = sessionStorage.getItem('token');
      if (!token || token === 'null') return; // Stop if no valid token
      
      const res = await fetch(`${API_BASE_URL}api/vault/catalog?type=QUIZ`, {
          headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setQuizzes(data.items || []);
        if (data.items && data.items.length > 0 && !selectedQuizId) {
            setSelectedQuizId(data.items[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to fetch quizzes", err);
    }
  };

  const fetchAnalysis = async (quizId) => {
      if (!quizId) return; // Stop if no quiz is selected
      setIsLoading(true);
      try {
          const token = sessionStorage.getItem('token');
          if (!token || token === 'null') {
              setIsLoading(false);
              return;
          }
          const res = await fetch(`${API_BASE_URL}api/analytics/item-frequency/${quizId}`, {
              headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
              const data = await res.json();
              setAnalysisData(data.analysis || []);
          }
      } catch (err) {
          console.error("Analysis fetch failed", err);
      } finally {
          setIsLoading(false);
      }
  };

  useEffect(() => {
    fetchQuizzes();
  }, []);

  useEffect(() => {
      if (selectedQuizId) {
          fetchAnalysis(selectedQuizId);
      }
  }, [selectedQuizId]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-300 font-sans p-4 md:p-10 animate-fade-in">
      <header className="max-w-7xl mx-auto mb-8 flex justify-between items-end border-b border-slate-800 pb-6">
        <div>
          <button onClick={() => navigate('/prof')} className="text-slate-500 hover:text-white text-[10px] font-black uppercase tracking-[0.2em] mb-4 flex items-center gap-2 transition-colors">
            <span>←</span> Return to Command Center
          </button>
          <h1 className="text-3xl font-black text-white tracking-[0.2em] uppercase">Item <span className="text-amber-500">Frequency Analysis</span></h1>
        </div>
        
        <div className="flex flex-col items-end">
          <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Target Assessment</label>
          <select 
              value={selectedQuizId} 
              onChange={(e) => setSelectedQuizId(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-amber-400 font-black text-[10px] uppercase tracking-widest p-3 rounded-lg outline-none focus:border-amber-500 w-64"
          >
              <option value="" disabled>Select an Assessment...</option>
              {quizzes.map(q => (
                  <option key={q.id} value={q.id}>{q.title}</option>
              ))}
          </select>
        </div>
      </header>

      <main className="max-w-7xl mx-auto bg-slate-950 border border-slate-800 rounded-3xl p-8 shadow-2xl min-h-[600px] flex flex-col">
          {isLoading ? (
               <div className="flex-grow flex items-center justify-center text-slate-500 font-mono text-xs uppercase tracking-widest animate-pulse">Running Algorithmic Item Analysis...</div>
          ) : analysisData.length === 0 ? (
               <div className="flex-grow flex items-center justify-center text-slate-500 font-mono text-xs uppercase tracking-widest">No attempt data recorded for this assessment yet.</div>
          ) : (
              <div className="flex-grow overflow-y-auto custom-scrollbar">
                  <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-900 border-b border-slate-800 sticky top-0 z-10">
                          <tr>
                              <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Item / Concept</th>
                              <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] text-center">Correct Hits</th>
                              <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] text-center">Misses (Errors)</th>
                              <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] text-right">Difficulty Index</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/50">
                          {analysisData.map((item, idx) => {
                              const totalAttempts = item.hits + item.misses;
                              const difficultyRatio = totalAttempts === 0 ? 0 : Math.round((item.misses / totalAttempts) * 100);
                              
                              let diffStatus = 'EASY';
                              let diffColor = 'text-emerald-400';
                              if (difficultyRatio > 70) { diffStatus = 'CRITICAL (REVISE)'; diffColor = 'text-red-500'; }
                              else if (difficultyRatio > 40) { diffStatus = 'MODERATE'; diffColor = 'text-amber-500'; }

                              return (
                                  <tr key={idx} className="hover:bg-slate-900 transition-colors">
                                      <td className="p-4 text-white font-bold text-sm w-1/2">{item.questionText}</td>
                                      <td className="p-4 text-center font-mono text-emerald-500">{item.hits}</td>
                                      <td className="p-4 text-center font-mono text-red-500">{item.misses}</td>
                                      <td className="p-4 text-right">
                                          <div className="flex flex-col items-end">
                                              <span className={`font-black text-lg ${diffColor}`}>{difficultyRatio}% Failure</span>
                                              <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded border mt-1 ${
                                                  difficultyRatio > 70 ? 'bg-red-900/30 text-red-500 border-red-900/50' :
                                                  difficultyRatio > 40 ? 'bg-amber-900/30 text-amber-500 border-amber-900/50' :
                                                  'bg-emerald-900/30 text-emerald-500 border-emerald-900/50'
                                              }`}>{diffStatus}</span>
                                          </div>
                                      </td>
                                  </tr>
                              );
                          })}
                      </tbody>
                  </table>
              </div>
          )}
      </main>
    </div>
  );
}