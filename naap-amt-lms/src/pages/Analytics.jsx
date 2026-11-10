import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../apiConfig';

export default function Analytics() {
  const navigate = useNavigate();
  const studentId = sessionStorage.getItem('userId');
  
  const [displayRows, setDisplayRows] = useState([]);
  const [expandedRow, setExpandedRow] = useState(null); 
  const [isLoading, setIsLoading] = useState(true);

  const fetchStudentTelemetry = async () => {
    if (!studentId) {
        setIsLoading(false);
        return;
    }
    
    // THE FIX: Add a 10-second timeout controller so it never hangs indefinitely
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const token = sessionStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}api/analytics/student/${studentId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const logs = data.logs || [];
        
        const topics = [...new Set(logs.map(l => l.topic))];
        const rolledUpData = [];

        topics.forEach(topic => {
          const topicLogs = logs.filter(l => l.topic === topic);
          
          const lvl1Pre = topicLogs.find(l => l.baseLevel === 'Lvl 1' && l.type === 'Pre');
          const lvl1Post = topicLogs.filter(l => l.baseLevel === 'Lvl 1' && l.type === 'Post')[0];
          const lvl2Pre = topicLogs.find(l => l.baseLevel === 'Lvl 2' && l.type === 'Pre');
          const lvl2Post = topicLogs.filter(l => l.baseLevel === 'Lvl 2' && l.type === 'Post')[0];
          const caap = topicLogs.filter(l => l.baseLevel === 'CAAP')[0];

          let currentLevel = 'Lvl 1: Easy';
          let preScore = lvl1Pre ? lvl1Pre.score : '--';
          let postScore = lvl1Post ? lvl1Post.score : '--';
          let status = lvl1Post ? (lvl1Post.score >= 75 ? 'PASSED' : 'FAILED') : (lvl1Pre ? 'PENDING' : '--');

          if (lvl1Post && lvl1Post.score >= 75) {
            currentLevel = 'Lvl 2: Advanced';
            preScore = lvl2Pre ? lvl2Pre.score : '--';
            postScore = lvl2Post ? lvl2Post.score : '--';
            status = lvl2Post ? (lvl2Post.score >= 75 ? 'PASSED' : 'FAILED') : (lvl2Pre ? 'PENDING' : 'UNLOCKED');

            if (lvl2Post && lvl2Post.score >= 75) {
              currentLevel = 'CAAP Exam Readiness';
              preScore = '--'; 
              postScore = caap ? caap.score : '--';
              status = caap ? (caap.score >= 75 ? 'PASSED' : 'FAILED') : 'UNLOCKED';
            }
          }

          rolledUpData.push({ topic, level: currentLevel, pre: preScore, post: postScore, status });
        });

        setDisplayRows(rolledUpData);
      }
    } catch (err) {
      console.error("Failed to fetch student analytics:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStudentTelemetry();
    
    const token = sessionStorage.getItem('token');
    if (!token) return;

    const wsUrl = `${API_BASE_URL}api/ws/connect?token=${token}`.replace('https://', 'wss://').replace('http://', 'ws://');
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.event === "NEW_TELEMETRY" || data.event === "QUIZ_COMPLETED") {
                console.log("[WS] Assessment finalized. Syncing scorecard matrix...");
                fetchStudentTelemetry();
            }
        } catch (e) {
            console.error("WS Parse Error", e);
        }
    };

    return () => ws.close();
  }, [studentId]);

  const handleReviewClick = (topic) => {
    if (topic.includes('Overall')) {
      const baseCategory = topic.replace(' Overall', '');
      navigate('/modules', { state: { openCategory: baseCategory } });
    } else {
      navigate('/reader', { state: { itemName: topic } });
    }
  };

  if (isLoading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-blue-500 font-mono text-sm animate-pulse uppercase tracking-widest">Syncing Telemetry...</div>;

  return (
    <div className="p-4 md:p-10 max-w-6xl mx-auto w-full">
       <header className="mb-6 md:mb-8 border-b border-slate-800 pb-4 md:pb-6 pt-4 md:pt-0">
          <h2 className="text-2xl md:text-3xl font-bold text-white uppercase tracking-wider">Score Analytics</h2>
          <p className="text-slate-400 font-mono mt-1 text-sm md:text-base">Current Mastery Level Matrix</p>
       </header>

       <div className="bg-slate-800 rounded-lg border border-slate-700 shadow-xl overflow-x-auto">
          <table className="w-full text-left min-w-[800px]">
            <thead className="bg-slate-900 border-b border-slate-700 text-xs uppercase tracking-widest text-slate-400 font-bold">
              <tr>
                <th className="p-4">Module Topic</th><th className="p-4">Active Level</th><th className="p-4">Pre-Test</th><th className="p-4">Post-Test</th><th className="p-4">Status</th><th className="p-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {displayRows.length === 0 ? (
                <tr><td colSpan="6" className="p-8 text-center text-slate-500 font-mono">No assessment data found. Take a quiz to begin tracking.</td></tr>
              ) : (
                displayRows.map((data, i) => (
                  <React.Fragment key={i}>
                    <tr className="hover:bg-slate-800/50 transition-colors">
                      <td className="p-4 text-white font-bold whitespace-nowrap">{data.topic}</td>
                      <td className="p-4 text-blue-400 font-mono text-sm whitespace-nowrap">{data.level}</td>
                      <td className="p-4 font-mono text-slate-300">{data.pre !== '--' ? `${data.pre}%` : '--'}</td>
                      <td className="p-4 font-mono text-white">{data.post !== '--' ? `${data.post}%` : '--'}</td>
                      <td className="p-4">
                        {data.status === 'PASSED' ? <span className="bg-emerald-900/40 text-emerald-400 px-2 py-1 rounded text-xs font-bold border border-emerald-500/50">{data.status}</span> :
                         data.status === 'FAILED' ? <span className="bg-red-900/40 text-red-400 px-2 py-1 rounded text-xs font-bold border border-red-500/50">{data.status}</span> :
                         data.status === 'UNLOCKED' ? <span className="bg-blue-900/40 text-blue-400 px-2 py-1 rounded text-xs font-bold border border-blue-500/50">UNLOCKED</span> :
                         <span className="bg-slate-700 text-slate-400 px-2 py-1 rounded text-xs font-bold">{data.status}</span>}
                      </td>
                      <td className="p-4 flex gap-2 items-center h-full">
                        {data.status === 'FAILED' && (
                           <>
                             <button 
                               onClick={() => setExpandedRow(expandedRow === i ? null : i)} 
                               className="bg-slate-700 hover:bg-slate-600 text-white text-[10px] md:text-xs font-bold py-2 px-3 rounded transition-colors uppercase tracking-widest"
                             >
                               {expandedRow === i ? 'Hide' : 'Details'}
                             </button>
                             <button 
                               onClick={() => handleReviewClick(data.topic)} 
                               className="bg-red-600 hover:bg-red-500 text-white text-[10px] md:text-xs font-bold py-2 px-4 rounded transition-colors uppercase tracking-widest shadow-[0_0_10px_rgba(220,38,38,0.2)] whitespace-nowrap"
                             >
                               {data.topic.includes('Overall') ? 'Review Subject' : 'Review Module'}
                             </button>
                           </>
                        )}
                      </td>
                    </tr>
                    
                    {expandedRow === i && (
                      <tr>
                        <td colSpan="6" className="p-0 border-b border-slate-700 bg-slate-900/50">
                           <div className="p-4 md:p-6 border-l-4 border-amber-500 ml-4 my-4 bg-slate-900 rounded-r shadow-inner">
                             <h4 className="text-amber-400 font-bold uppercase tracking-wider mb-2 text-sm">Targeted Study Plan</h4>
                             <p className="text-slate-300 text-sm mb-2">Based on algorithmic analysis of your incorrect answers, you are required to review:</p>
                             <ul className="list-disc pl-5 text-blue-400 font-mono text-xs md:text-sm space-y-1">
                               {data.topic.includes('Overall') ? (
                                 <>
                                   <li>Fundamental concepts within the <span className="font-bold text-white">{data.topic.replace(' Overall', '')}</span> directory.</li>
                                   <li>Retake Level 1 Pre-Tests for all sub-modules to re-establish baselines.</li>
                                 </>
                               ) : (
                                 <>
                                   <li>Specific CAAP advisory circulars related to <span className="font-bold text-white">{data.topic}</span>.</li>
                                   <li>Highlighted RAG-intervention sections in the source PDF.</li>
                                 </>
                               )}
                             </ul>
                           </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
       </div>
    </div>
  );
}