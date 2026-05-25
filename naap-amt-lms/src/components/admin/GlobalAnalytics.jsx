import { useState, useEffect } from 'react';

export default function GlobalAnalytics() {
  const [metrics, setMetrics] = useState({
    students: 0,
    faculty: 0,
    active_sessions: 0,
    modules: 0,
    pass_rate: 0.0
  });

  const [readiness, setReadiness] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        
        const token = localStorage.getItem('token');
        const res = await fetch('https://ztp98nvz-8000.asse.devtunnels.ms/api/analytics/global', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setMetrics(data.metrics);
          setReadiness(data.readiness);
        }
      } catch (err) {
        console.error("Failed to fetch analytics:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnalytics();
    // Poll every 60 seconds to keep dashboard live
    const interval = setInterval(fetchAnalytics, 60000);
    return () => clearInterval(interval);
  }, []);

  // Helper to color-code the bars based on passing threshold
  const getBarColor = (percentage) => {
    if (percentage >= 80) return 'bg-emerald-500';
    if (percentage >= 70) return 'bg-blue-500';
    if (percentage >= 60) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <div className="animate-fade-in max-w-[100rem] mx-auto space-y-8">
      
      {/* KPI CARDS (Updated to 5 columns for the new telemetry) */}
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-6">
        
        {/* NEW: LIVE TELEMETRY CARD */}
        <div className="bg-slate-900 border border-blue-900/50 rounded-3xl p-6 shadow-[0_0_30px_rgba(59,130,246,0.15)] relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
          <div className="absolute top-4 right-4 flex h-3 w-3 items-center justify-center">
             <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
             <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
          </div>
          <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-2 relative z-10">Active Sessions</p>
          <p className="text-5xl font-black text-white relative z-10">
            {isLoading ? '-' : metrics.active_sessions.toLocaleString()}
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 relative z-10">Total Students</p>
          <p className="text-5xl font-black text-white relative z-10">
            {isLoading ? '-' : metrics.students.toLocaleString()}
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 relative z-10">Active Faculty</p>
          <p className="text-5xl font-black text-white relative z-10">
            {isLoading ? '-' : metrics.faculty.toLocaleString()}
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 relative z-10">Global Passing Rate</p>
          <p className="text-5xl font-black text-white relative z-10 flex items-baseline gap-1">
            {isLoading ? '-' : metrics.pass_rate}<span className="text-2xl text-slate-400">%</span>
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 relative z-10">Total RAG Modules</p>
          <p className="text-5xl font-black text-white relative z-10">
            {isLoading ? '-' : metrics.modules.toLocaleString()}
          </p>
        </div>
      </div>

      {/* CAAP LICENSURE READINESS CHART */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 md:p-10 shadow-2xl">
        <div className="flex justify-between items-center mb-10 border-b border-slate-800 pb-4">
          <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">CAAP Licensure Readiness By Specialization</h3>
          <select className="bg-slate-950 border border-slate-700 text-slate-400 text-[10px] font-black px-4 py-2 rounded-lg outline-none cursor-pointer uppercase tracking-widest">
            <option>Year: 2026</option>
            <option>Year: 2025</option>
          </select>
        </div>

        <div className="space-y-8">
          {isLoading ? (
            <div className="text-center py-10"><p className="text-[10px] text-slate-500 font-mono animate-pulse uppercase tracking-widest">Compiling Analytics Data...</p></div>
          ) : readiness.length === 0 ? (
            <div className="text-center py-10"><p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">No Quiz Data Available Yet.</p></div>
          ) : (
            readiness.map((item, index) => (
              <div key={index} className="relative">
                <div className="flex justify-between items-end mb-2">
                  <span className="text-[10px] font-black text-white uppercase tracking-widest">{item.subject}</span>
                  <span className="text-[10px] font-black text-white font-mono">{item.percentage}%</span>
                </div>
                {/* Background Track */}
                <div className="w-full bg-slate-950 rounded-full h-3 border border-slate-800 overflow-hidden">
                  {/* Dynamic Filled Bar */}
                  <div 
                    className={`h-full rounded-full transition-all duration-1000 ease-out ${getBarColor(item.percentage)}`} 
                    style={{ width: `${item.percentage}%` }}
                  ></div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
}