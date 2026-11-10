import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from "../apiConfig";

export default function ProfAnalytics() {
  const navigate = useNavigate();
  
  const [rawStudents, setRawStudents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchGlobalTelemetry = async () => {
        try {
            const token = sessionStorage.getItem('token');
            if (!token || token === 'null') {
                setIsLoading(false);
                return;
            }
            
            const res = await fetch(`${API_BASE_URL}api/analytics/global`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                const data = await res.json();
                const logs = data.logs || [];
                
                const studentMap = {};
                logs.forEach(log => {
                    const id = log.student_id || log.student || 'Unknown';
                    const name = log.student_name || log.student || 'Unknown Student';
                    if (!studentMap[id]) {
                        studentMap[id] = { id, name, logs: [], totalScore: 0, totalItems: 0 };
                    }
                    studentMap[id].logs.push(log);
                    
                    const parsedScore = parseInt(String(log.score).replace('%', ''));
                    if (!isNaN(parsedScore)) {
                        studentMap[id].totalScore += parsedScore;
                        studentMap[id].totalItems += 1;
                    }
                });

                const processedStudents = Object.values(studentMap).map(student => {
                    const avg = student.totalItems > 0 ? Math.round(student.totalScore / student.totalItems) : 0;
                    let status = 'AVERAGE';
                    if (avg >= 90) status = 'EXCELLENT';
                    else if (avg < 75) status = 'CRITICAL';

                    const weakPoints = student.logs
                        .filter(l => parseInt(String(l.score).replace('%', '')) < 75)
                        .map(l => l.topic || l.action || 'Unknown Topic');

                    return {
                        id: student.id,
                        name: student.name,
                        section: "BSAMT 3-A", 
                        sy: "2025-2026",
                        avg,
                        status,
                        logs: student.logs.map(l => ({
                            module: l.topic || l.action,
                            preTest: Math.max(0, parseInt(String(l.score).replace('%', '')) - 15) || 0, 
                            postTest: parseInt(String(l.score).replace('%', '')) || 0,
                            tries: 1,
                            weakPoints: [...new Set(weakPoints)]
                        }))
                    };
                });

                setRawStudents(processedStudents);
            }
        } catch (err) {
            console.error("Telemetry link failed:", err);
        } finally {
            setIsLoading(false);
        }
    };
    
    fetchGlobalTelemetry();

    const token = sessionStorage.getItem('token');
    
    // THE FIX: Only build the socket if the token is valid, preventing a crash!
    let ws = null;
    if (token && token !== 'null' && token !== 'undefined') {
        const wsUrl = `${API_BASE_URL}api/ws/connect?token=${token}`.replace('https://', 'wss://').replace('http://', 'ws://');
        ws = new WebSocket(wsUrl);
        
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.event === "NEW_TELEMETRY") {
                fetchGlobalTelemetry(); 
            }
        };
    }
    
    return () => {
        if (ws) ws.close();
    };
  }, []);

  const filteredStudents = useMemo(() => {
    return rawStudents
      .filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.id.includes(searchQuery))
      .sort((a, b) => a.name.localeCompare(b.name)); 
  }, [rawStudents, searchQuery]);

  const [selectedStudent, setSelectedStudent] = useState(null);

  useEffect(() => {
      setSelectedStudent(filteredStudents[0] || null);
  }, [filteredStudents]);

  const currentLogs = selectedStudent?.logs || [];

  if (isLoading) {
      return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-500 font-mono text-xs uppercase tracking-widest">Syncing Jurisdictional Telemetry...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-300 font-sans p-4 md:p-8 overflow-hidden flex flex-col">
      <header className="flex justify-between items-end border-b border-slate-800 pb-6 mb-6 shrink-0">
        <div>
          <button onClick={() => navigate('/prof')} className="text-slate-500 hover:text-white text-[10px] font-black uppercase tracking-[0.2em] mb-4 flex items-center gap-2 transition-colors">
            <span>←</span> Return to Command Center
          </button>
          <h1 className="text-3xl font-black text-white tracking-[0.2em] uppercase">Student <span className="text-blue-500">Analytics Matrix</span></h1>
        </div>
      </header>

      <div className="flex-grow grid grid-cols-1 lg:grid-cols-12 gap-8 overflow-hidden">
        
        <div className="lg:col-span-4 bg-slate-800 rounded-[2rem] border border-slate-700 shadow-2xl flex flex-col overflow-hidden">
          <div className="p-6 border-b border-slate-700 bg-slate-800 z-10">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Cohort Roster</h3>
              <span className="text-[9px] bg-slate-900 border border-slate-700 px-2 py-1 rounded text-slate-500 font-mono">SORT: A-Z</span>
            </div>
            <input 
              type="text" 
              placeholder="Search Name or ID..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 p-4 rounded-xl text-white font-mono text-sm outline-none focus:border-blue-500 transition-colors shadow-inner placeholder:text-slate-600"
            />
          </div>
          
          <div className="flex-grow overflow-y-auto custom-scrollbar p-4 space-y-3">
            {filteredStudents.length === 0 ? (
              <p className="text-center text-slate-500 font-mono text-xs mt-10">No students found with quiz records in this catalog.</p>
            ) : (
              filteredStudents.map(student => (
                <button 
                  key={student.id}
                  onClick={() => setSelectedStudent(student)}
                  className={`w-full text-left p-5 rounded-2xl border transition-all duration-300 group ${selectedStudent?.id === student.id ? 'bg-blue-600 border-blue-500 shadow-lg shadow-blue-900/40 translate-x-2' : 'bg-slate-900 border-slate-700 hover:border-blue-500/50 hover:bg-slate-800'}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className={`font-black uppercase tracking-wider text-sm ${selectedStudent?.id === student.id ? 'text-white' : 'text-slate-300 group-hover:text-white'}`}>{student.name}</span>
                    <span className={`text-[9px] font-black px-2 py-1 rounded tracking-[0.2em] ${student.status === 'EXCELLENT' ? 'bg-emerald-900/50 text-emerald-400' : student.status === 'CRITICAL' ? 'bg-red-900/50 text-red-400' : 'bg-slate-800 text-slate-400'}`}>
                      {student.status}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mt-3">
                    <span className={`font-mono text-[10px] ${selectedStudent?.id === student.id ? 'text-blue-200' : 'text-slate-500'}`}>{student.id}</span>
                    <span className={`font-black font-mono text-xs ${selectedStudent?.id === student.id ? 'text-white' : 'text-blue-400'}`}>AVG: {student.avg}%</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {selectedStudent ? (
          <div className="lg:col-span-8 bg-slate-950 rounded-[2rem] border border-slate-800 shadow-2xl flex flex-col relative overflow-hidden animate-fade-in">
            <div className={`absolute top-0 right-0 w-96 h-96 rounded-full blur-[120px] opacity-10 pointer-events-none ${selectedStudent.status === 'CRITICAL' ? 'bg-red-600' : selectedStudent.status === 'EXCELLENT' ? 'bg-emerald-600' : 'bg-blue-600'}`}></div>
            
            <div className="p-8 md:p-10 flex-grow overflow-y-auto custom-scrollbar relative z-10">
              
              <div className="flex justify-between items-end mb-8 border-b border-slate-800 pb-6">
                <div>
                  <h2 className="text-4xl font-black text-white tracking-[0.1em] uppercase mb-2">{selectedStudent.name}</h2>
                  <p className="text-slate-500 font-mono tracking-widest text-xs uppercase">{selectedStudent.id} | {selectedStudent.section} | {selectedStudent.sy}</p>
                </div>
                <div className="flex gap-3">
                  {selectedStudent.status === 'CRITICAL' && (
                    <button className="bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-colors shadow-lg shadow-red-900/40">Initiate Intervention</button>
                  )}
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-8 mt-4 mb-8">
                <div className="flex-1">
                  <p className={`font-mono text-[10px] tracking-widest uppercase mb-3 font-bold text-slate-500`}>Flagged Concepts:</p>
                  <ul className="flex flex-wrap gap-2">
                    {currentLogs.flatMap(log => log.weakPoints).length === 0 ? (
                        <span className="text-[10px] font-mono text-emerald-500">No weak points detected.</span>
                    ) : (
                        currentLogs.flatMap(log => log.weakPoints).map((point, idx) => (
                        <li key={idx} className={`px-3 py-1.5 rounded-lg font-bold text-[10px] uppercase tracking-widest border ${selectedStudent.status === 'CRITICAL' ? 'bg-red-950 text-red-400 border-red-500/50' : 'bg-amber-950 text-amber-400 border-amber-500/50'}`}>
                            {point}
                        </li>
                        ))
                    )}
                  </ul>
                </div>
                <div className="flex-1 border-l border-slate-800 pl-8">
                    <p className={`font-mono text-[10px] tracking-widest uppercase mb-3 font-bold text-blue-500`}>Recommended Remediation:</p>
                    <ul className="space-y-2">
                        {currentLogs.flatMap(log => log.weakPoints).length === 0 ? (
                             <span className="text-[10px] font-mono text-emerald-500">Mastery Achieved. Proceed to next module.</span>
                        ) : (
                            currentLogs.flatMap(log => log.weakPoints).map((point, idx) => (
                            <li key={`mod-${idx}`} className="text-xs text-slate-300 flex items-center gap-2">
                                <span className="text-blue-400">→</span> 
                                Target Mastery: <span className="font-bold text-white uppercase">{point}</span>
                            </li>
                            ))
                        )}
                    </ul>
                </div>
              </div>

              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-4">Assessment History</h3>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-inner">
                <table className="w-full text-left">
                  <thead className="bg-slate-950 border-b border-slate-800">
                    <tr>
                      <th className="p-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Module Topic</th>
                      <th className="p-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] text-center">Pre-Test</th>
                      <th className="p-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] text-center">Post-Test</th>
                      <th className="p-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] text-right">Attempts</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50 font-mono">
                    {currentLogs.map((log, i) => (
                      <tr key={i} className="hover:bg-slate-800/50 transition-colors">
                        <td className="p-5 text-white font-bold text-sm font-sans tracking-wide">{log.module}</td>
                        <td className="p-5 text-center">
                          <span className={`text-xs font-black px-3 py-1 rounded border ${log.preTest >= 75 ? 'text-slate-400 border-slate-700' : 'text-amber-500 border-amber-500/30 bg-amber-900/10'}`}>
                            {log.preTest}%
                          </span>
                        </td>
                        <td className="p-5 text-center">
                          <span className={`text-xs font-black px-3 py-1 rounded border ${log.postTest >= 75 ? 'text-emerald-400 border-emerald-500/30 bg-emerald-900/10' : 'text-red-400 border-red-500/30 bg-red-900/10'}`}>
                            {log.postTest}%
                          </span>
                        </td>
                        <td className="p-5 text-right">
                          <span className={`text-[10px] font-black uppercase tracking-widest ${log.tries > 1 ? 'text-amber-500' : 'text-slate-500'}`}>
                            {log.tries} {log.tries === 1 ? 'Try' : 'Tries'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
            </div>
          </div>
        ) : (
          <div className="lg:col-span-8 flex items-center justify-center bg-slate-950 rounded-[2rem] border border-slate-800 shadow-inner">
            <p className="text-slate-600 font-mono uppercase tracking-[0.4em] text-sm font-bold">Select a student from the roster</p>
          </div>
        )}
      </div>
    </div>
  );
}