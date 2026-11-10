import { useState } from 'react';
// THE FIX: Import the new master synchronization hook
import useLiveSync from "../shared/useLiveSync";

export default function GlobalAnalytics() {
  const currentRole = sessionStorage.getItem('role') || 'HEAD_ADMIN';
  const clearanceLevel = parseInt(sessionStorage.getItem('adminClearance') || '0', 10);

  // Cohort Drilldown Controls
  const [selectedYear, setSelectedYear] = useState('1st Year');
  const [selectedSection, setSelectedSection] = useState('ALL');

  // THE FIX: Replace the manual fetch interval and websockets with the silent hook
  const { data: analyticsData, isLoading } = useLiveSync(
      'api/analytics/global', 
      ['NEW_TELEMETRY', 'QUIZ_COMPLETED', 'SESSION_UPDATE', 'ROSTER_UPDATE'],
      { metrics: {}, readiness: [], cohort_breakdown: {}, online_profs: [], alumni: [], testers: [] }
  );

  const metrics = analyticsData?.metrics || { active_students: 0, total_students: 0, active_faculty: 0, total_faculty: 0, modules: 0, pass_rate: 0.0 };
  const readiness = analyticsData?.readiness || [];
  const cohortBreakdown = analyticsData?.cohort_breakdown || {};
  const onlineProfs = analyticsData?.online_profs || [];
  const alumniNetwork = analyticsData?.alumni || [];
  const testerNetwork = analyticsData?.testers || [];

  const getBarColor = (percentage) => {
    if (percentage >= 80) return 'bg-emerald-500';
    if (percentage >= 70) return 'bg-blue-500';
    if (percentage >= 60) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const activeCohort = cohortBreakdown[selectedYear] || { passing_rate: 0, student_count: 0, sections: {} };
  const availableSections = Object.keys(activeCohort.sections || {}).sort((a, b) => a.localeCompare(b));

  return (
    <div className="animate-fade-in max-w-[100rem] mx-auto space-y-8 pb-12">
      
      {/* 1. SYSTEM KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6">
        <div className="bg-slate-900 border border-blue-900/50 rounded-3xl p-6 shadow-[0_0_30px_rgba(59,130,246,0.15)] relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
          <div className="absolute top-4 right-4 flex h-3 w-3 items-center justify-center">
             <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
             <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
          </div>
          <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-2 relative z-10">Active Students</p>
          <p className="text-5xl font-black text-white relative z-10">{isLoading ? '-' : (metrics.active_students || 0).toLocaleString()}</p>
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex justify-between items-center text-[10px] text-slate-400 font-mono relative z-10">
            <span>Total Enrolled</span>
            <span className="text-white font-bold">{metrics.total_students || 0}</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-emerald-900/50 rounded-3xl p-6 shadow-[0_0_30px_rgba(16,185,129,0.15)] relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
          <div className="absolute top-4 right-4 flex h-3 w-3 items-center justify-center">
             <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
             <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </div>
          <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-2 relative z-10">Active Faculty</p>
          <p className="text-5xl font-black text-white relative z-10">{isLoading ? '-' : (metrics.active_faculty || 0).toLocaleString()}</p>
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex justify-between items-center text-[10px] text-slate-400 font-mono relative z-10">
            <span>Total Faculty</span>
            <span className="text-white font-bold">{metrics.total_faculty || 0}</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 relative z-10">Global Passing Rate</p>
          <p className="text-5xl font-black text-white relative z-10 flex items-baseline gap-1">
            {isLoading ? '-' : (metrics.pass_rate || 0)}<span className="text-2xl text-slate-400">%</span>
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 relative z-10">Total RAG Modules</p>
          <p className="text-5xl font-black text-white relative z-10">
            {isLoading ? '-' : (metrics.modules || 0).toLocaleString()}
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden group">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 relative z-10">Telemetry Scope</p>
          <p className="text-lg font-black text-white uppercase mt-1 truncate">
            {currentRole === 'HEAD_ADMIN' ? 'Tier 0 Sovereign' : `Tier ${clearanceLevel} Control`}
          </p>
          <div className="mt-4 pt-3 border-t border-slate-800/80 text-[10px] text-slate-400 font-mono truncate">
            <span>{currentRole} Access Granted</span>
          </div>
        </div>
      </div>

      {/* 2. COHORT PERFORMANCE MODULE */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-6 mb-6">
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-widest">Cohort Academic Analytics</h3>
            <p className="text-xs text-slate-500 mt-1">Passing metrics segmented by academic level and classroom section</p>
          </div>
          
          <div className="flex flex-wrap gap-3">
            <select 
              value={selectedYear} 
              onChange={(e) => { setSelectedYear(e.target.value); setSelectedSection('ALL'); }}
              className="bg-slate-950 border border-slate-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl outline-none cursor-pointer"
            >
              <option>1st Year</option><option>2nd Year</option><option>3rd Year</option><option>4th Year</option>
            </select>
            <select 
              value={selectedSection} 
              onChange={(e) => setSelectedSection(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl outline-none cursor-pointer"
            >
              <option value="ALL">All Sections</option>
              {availableSections.map(sec => <option key={sec} value={sec}>Section {sec}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Target Year Passing Rate</span>
            <p className="text-3xl font-black text-white mt-1">{activeCohort.passing_rate}%</p>
          </div>
          <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Enrolled in Cohort</span>
            <p className="text-3xl font-black text-white mt-1">{activeCohort.student_count}</p>
          </div>
          <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Selected Scope</span>
            <p className="text-3xl font-black text-blue-400 mt-1">{selectedSection === 'ALL' ? 'Full Cohort' : `Sec ${selectedSection}`}</p>
          </div>
        </div>

        <div className="space-y-4">
          {availableSections.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-4 font-mono">No active section logs for {selectedYear}.</p>
          ) : (
            availableSections
              .filter(sec => selectedSection === 'ALL' || selectedSection === sec)
              .map(sec => {
                const secData = activeCohort.sections[sec];
                return (
                  <div key={sec} className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
                    <div className="flex justify-between items-center text-xs mb-2">
                      <span className="font-bold text-white uppercase tracking-wider">Section {sec} ({secData.student_count} Students)</span>
                      <span className="font-mono text-emerald-400 font-bold">{secData.passing_rate}% Passing ({secData.total_attempts} attempts)</span>
                    </div>
                    <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                      <div className={`h-full rounded-full ${getBarColor(secData.passing_rate)}`} style={{ width: `${secData.passing_rate}%` }}></div>
                    </div>
                  </div>
                );
              })
          )}
        </div>
      </div>

      {/* 3. CAAP READINESS */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 md:p-10 shadow-2xl">
        <div className="flex justify-between items-center mb-10 border-b border-slate-800 pb-4">
          <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">CAAP Licensure Readiness By Specialization</h3>
          <select className="bg-slate-950 border border-slate-700 text-slate-400 text-[10px] font-black px-4 py-2 rounded-lg outline-none cursor-pointer uppercase tracking-widest">
            <option>Year: 2026</option><option>Year: 2025</option>
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
                <div className="w-full bg-slate-950 rounded-full h-3 border border-slate-800 overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-1000 ease-out ${getBarColor(item.percentage)}`} style={{ width: `${item.percentage}%` }}></div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 4. LIVE ONLINE FACULTY BOARD */}
      {(clearanceLevel <= 2 || currentRole === 'HEAD_ADMIN') && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl">
          <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse"></span> Live Online Faculty Board
              </h3>
            </div>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/50 border border-emerald-800 px-3 py-1 rounded-full font-bold">
              {onlineProfs.length} Active Now
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[500px]">
              <thead className="text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-800">
                <tr><th className="pb-3 pl-2">Instructor</th><th className="pb-3">Faculty ID</th><th className="pb-3">Assigned Subjects</th><th className="pb-3 text-right pr-2">Session Sync</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-xs">
                {onlineProfs.length === 0 ? (
                  <tr><td colSpan="4" className="py-6 text-center text-slate-500 font-mono">No faculty members currently online.</td></tr>
                ) : (
                  onlineProfs.map((prof) => (
                    <tr key={prof.id} className="hover:bg-slate-950/50 transition-colors">
                      <td className="py-3 pl-2 font-bold text-white">{prof.name}</td>
                      <td className="py-3 font-mono text-slate-400">{prof.id}</td>
                      <td className="py-3">
                        <div className="flex flex-wrap gap-1">
                          {prof.subjects.split(',').map((sub, i) => (
                            <span key={i} className="text-[9px] font-bold bg-slate-950 text-slate-300 border border-slate-800 px-2 py-0.5 rounded">{sub.trim()}</span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 text-right pr-2 font-mono text-emerald-400 font-bold">{prof.last_active}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. HEAD ADMIN SPECIAL WORKSPACES */}
      {currentRole === 'HEAD_ADMIN' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl overflow-x-auto">
            <h3 className="text-sm font-black text-white uppercase tracking-widest mb-6 border-b border-slate-800 pb-4 flex items-center gap-3">
               <span className="text-purple-500 text-xl">🎓</span> Alumni
            </h3>
            <table className="w-full text-left text-xs min-w-[500px]">
              <thead className="text-[9px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800">
                <tr><th className="pb-3 pl-2">Alumni Name & Degree</th><th className="pb-3">Cohort Batch</th><th className="pb-3">Industry Status</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {alumniNetwork.length === 0 && <tr><td colSpan="3" className="py-4 text-center text-slate-600 font-mono">No alumni registered.</td></tr>}
                {alumniNetwork.map(a => (
                  <tr key={a.id} className="hover:bg-slate-950/50">
                    <td className="py-4 pl-2"><p className="font-bold text-white text-sm mb-1">{a.name}</p><span className="text-[9px] bg-purple-900/30 text-purple-400 border border-purple-500/50 px-2 py-0.5 rounded">{a.degree}</span></td>
                    <td className="py-4 font-mono text-slate-300">{a.batch}</td>
                    <td className="py-4 text-emerald-400 font-bold">{a.employment}<br/><span className="text-[10px] font-medium text-slate-500 uppercase">{a.company}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl overflow-x-auto">
            <h3 className="text-sm font-black text-white uppercase tracking-widest mb-6 border-b border-slate-800 pb-4 flex items-center gap-3">
               <span className="text-amber-500 text-xl">🛡️</span> Tester
            </h3>
            <table className="w-full text-left text-xs min-w-[500px]">
              <thead className="text-[9px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800">
                <tr><th className="pb-3 pl-2">Tester Info</th><th className="pb-3">Institute</th><th className="pb-3 text-right">NDA Validity Status</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {testerNetwork.length === 0 && <tr><td colSpan="3" className="py-4 text-center text-slate-600 font-mono">No active testers.</td></tr>}
                {testerNetwork.map(t => (
                  <tr key={t.id} className="hover:bg-slate-950/50">
                    <td className="py-4 pl-2"><p className="font-bold text-white text-sm mb-1">{t.name}</p><span className="text-[10px] text-slate-500 font-mono">{t.id}</span></td>
                    <td className="py-4 font-bold text-slate-300 uppercase">{t.institute}</td>
                    <td className="py-4 text-right pr-2">
                      {t.expired ? <span className="text-[10px] font-black bg-red-900/30 text-red-500 border border-red-500/50 px-2 py-1 rounded uppercase tracking-widest">Expired</span>
                                 : <span className="text-[10px] font-black bg-emerald-900/30 text-emerald-400 border border-emerald-500/50 px-2 py-1 rounded uppercase tracking-widest">Active: Ends {t.end}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      )}

    </div>
  );
}