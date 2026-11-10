import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../apiConfig';
import GlobalSocketOverlay from '../components/shared/GlobalSocketOverlay';
// THE FIX: Import the universal silent sync hook
import useLiveSync from '../components/shared/useLiveSync';

export default function ProfDashboard() {
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());
  
  const [searchQuery, setSearchQuery] = useState('');
  const [repoTab, setRepoTab] = useState('ACTIVE'); 
  const [telemetryFilter, setTelemetryFilter] = useState('ALL');

  const [quizManagerModal, setQuizManagerModal] = useState(false);
  const [quizTab, setQuizTab] = useState('DRAFT'); 
  const [showSignOutModal, setShowSignOutModal] = useState(false);

  const profNameRaw = sessionStorage.getItem('profName') || sessionStorage.getItem('name') || "UNKNOWN PROFESSOR";
  const honorificText = profNameRaw.startsWith("Sir ") || profNameRaw.startsWith("Ma'am ") || profNameRaw.startsWith("Dr. ") ? "" : "PROF. ";
  const formattedProfName = `${honorificText}${profNameRaw}`;
  const profId = sessionStorage.getItem('userId') || "UNKNOWN-ID";
  
  // THE FIX: Single-line silent fetches for all three data streams
  const { data: profileData } = useLiveSync(`api/users/${profId}`, ['ROSTER_UPDATE']);
  const { data: vaultData, isLoading: isLoadingVault, mutate: mutateVault } = useLiveSync('api/vault/assets', ['MODULE_UPDATE', 'QUIZ_UPDATE']);
  const { data: telemetryData } = useLiveSync('api/analytics/global', ['NEW_TELEMETRY']);

  // Dynamic Profile Processing (Instantly updates when Head Admin saves subjects)
  const fetchedSubjects = profileData?.user?.subjects || sessionStorage.getItem('subjects') || "General Aviation";
  if (profileData?.user?.subjects) sessionStorage.setItem('subjects', fetchedSubjects);
  const assignedSubjects = fetchedSubjects.split(',').map(s => s.trim()).filter(Boolean);
  const departmentName = assignedSubjects.length > 0 ? assignedSubjects.join(' / ') : "General Aviation";

  // Vault Processing
  const dbModules = vaultData?.modules || [];
  const dbQuizzes = { 'DRAFT': [], 'ACTIVE': [], 'ARCHIVED': [] };
  (vaultData?.quizzes || []).forEach(q => {
      if (dbQuizzes[q.status]) dbQuizzes[q.status].push(q);
  });

  // Telemetry Processing
  const liveTelemetry = telemetryData?.logs || [];
  const displayedModules = dbModules.filter(m => m.status === repoTab);
  const displayedTelemetry = telemetryFilter === 'ALL' ? liveTelemetry : liveTelemetry.filter(log => log.category === telemetryFilter);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const toggleArchive = async (id, currentStatus) => {
      const newStatus = currentStatus === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE';
      try {
          await fetch(`${API_BASE_URL}api/vault/status/${id}`, {
              method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus })
          });
          mutateVault(); // Force an immediate silent reload
      } catch(e) { alert("Failed to change status."); }
  };

  const confirmSignOut = () => {
      sessionStorage.clear();
      navigate('/login');
  };

  return (
    <GlobalSocketOverlay>
      <div className="min-h-screen bg-slate-950 text-slate-300 font-sans overflow-y-auto animate-fade-in p-4 md:p-8 relative">
        
        {showSignOutModal && (
          <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
            <div className="bg-slate-900 border border-red-900/50 rounded-3xl p-8 max-w-sm w-full shadow-2xl flex flex-col text-center">
              <span className="text-5xl mb-4 block animate-pulse">⚠️</span>
              <h2 className="text-xl font-black text-white uppercase tracking-widest mb-2">Confirm Sign Out</h2>
              <p className="text-slate-400 text-sm mb-8">Are you sure you want to close your active session?</p>
              <div className="flex gap-4">
                <button onClick={() => setShowSignOutModal(false)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl uppercase tracking-widest transition-colors text-xs">Cancel</button>
                <button onClick={confirmSignOut} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl uppercase tracking-widest transition-colors text-xs shadow-[0_0_15px_rgba(220,38,38,0.3)]">Sign Out</button>
              </div>
            </div>
          </div>
        )}

        {quizManagerModal && (
          <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-4xl w-full shadow-2xl flex flex-col h-[70vh]">
              <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4 shrink-0">
                <h2 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-3"><span className="text-purple-500">🧠</span> Quiz & Assessment Manager</h2>
                <button onClick={() => setQuizManagerModal(false)} className="text-slate-500 hover:text-red-500 text-xl">✕</button>
              </div>
              
              <div className="flex gap-2 mb-6 shrink-0 bg-slate-950 p-2 rounded-xl border border-slate-800 w-max">
                {['DRAFT', 'ACTIVE', 'ARCHIVED'].map(tab => (
                  <button key={tab} onClick={() => setQuizTab(tab)} className={`text-[10px] font-black px-6 py-2 rounded-lg uppercase tracking-widest transition-colors ${quizTab === tab ? 'bg-purple-600 text-white' : 'text-slate-500 hover:text-white'}`}>
                    {tab} ({dbQuizzes[tab].length})
                  </button>
                ))}
              </div>

              <div className="flex-grow overflow-y-auto custom-scrollbar space-y-4">
                {isLoadingVault ? <p className="text-center text-slate-500 uppercase mt-10 tracking-widest">Scanning Vault...</p> : 
                 dbQuizzes[quizTab].length === 0 ? <p className="text-center text-slate-500 uppercase text-xs font-black tracking-widest mt-10">No Quizzes Found</p> :
                 dbQuizzes[quizTab].map((q, i) => (
                  <div key={i} className="bg-slate-950 border border-slate-800 p-5 rounded-2xl flex justify-between items-center group hover:border-purple-500/50 transition-colors">
                    <div>
                      <span className="text-[10px] text-purple-400 font-mono font-black mb-1 block">{q.id}</span>
                      <p className="text-base text-white font-bold">{q.title}</p>
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 mt-2 block">{q.questions} Questions</span>
                    </div>
                    <div className="flex gap-3">
                      {(quizTab === 'ACTIVE' || quizTab === 'ARCHIVED') && (
                        <button onClick={() => navigate('/prof/frequency')} className="bg-slate-800 hover:bg-blue-900/40 text-blue-400 border border-slate-700 hover:border-blue-500 text-[10px] font-black px-4 py-2 rounded-lg uppercase tracking-widest transition-colors">Item Analysis</button>
                      )}
                      <button onClick={() => navigate('/prof/upload', { state: { directTo: 'QUIZ' } })} className="bg-slate-800 hover:bg-emerald-900/40 text-emerald-400 border border-slate-700 hover:border-emerald-500 text-[10px] font-black px-4 py-2 rounded-lg uppercase tracking-widest transition-colors">
                        {quizTab === 'ARCHIVED' ? 'Restore & Edit' : quizTab === 'DRAFT' ? 'Resume Draft' : 'Edit Quiz'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="max-w-[100rem] mx-auto space-y-6 w-full">
          
          <header className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-800 pb-6 gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-black text-white tracking-wider leading-tight uppercase">Welcome,<br className="md:hidden"/> <span className="text-emerald-500">{formattedProfName}</span></h1>
              <p className="text-slate-500 font-mono mt-2 text-sm uppercase tracking-widest">ID: {profId} | Assigned Dept/Subjects: <span className="text-emerald-400 font-bold">{departmentName}</span></p>
            </div>
            <div className="flex gap-4 items-center w-full md:w-auto">
              <div className="bg-slate-900 border border-slate-800 px-6 py-3 rounded-2xl text-right shadow-inner flex-1 md:flex-none">
                 <p className="text-[10px] text-slate-500 uppercase tracking-[0.3em] font-black">System Time</p>
                 <p className="text-emerald-400 font-mono text-lg font-bold">{currentTime.toLocaleTimeString()}</p>
              </div>
              <button onClick={() => setShowSignOutModal(true)} className="bg-slate-900 hover:bg-red-900/40 text-slate-500 hover:text-red-400 border border-slate-800 hover:border-red-500/50 px-6 py-4 rounded-2xl transition-colors font-black uppercase tracking-[0.2em] text-xs h-full active:scale-95">Sign Out</button>
            </div>
          </header>

          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-grow relative group">
              <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-500 text-xl group-focus-within:text-emerald-500 transition-colors">🔍</span>
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="RAG Search: Find a specific module, phrase, or topic across the database..."
                className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-3xl py-5 pl-16 pr-6 text-white outline-none font-bold shadow-inner transition-colors"
              />
            </div>
            <button onClick={() => navigate('/profile')} className="bg-slate-900 hover:bg-blue-900/40 border border-slate-800 hover:border-blue-500 text-blue-400 px-8 py-5 rounded-3xl font-black uppercase tracking-widest text-xs transition-all shadow-xl active:scale-95 shrink-0 flex items-center gap-3">
              <span>⚙️</span> Command Center
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            <div className="space-y-6 lg:col-span-1">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-6 border-b border-slate-800 pb-4">Instructional Tools</h3>
                <div className="space-y-3">
                  <button onClick={() => navigate('/prof/analytics')} className="w-full bg-slate-950 hover:bg-emerald-900/40 text-left px-6 py-4 rounded-2xl border border-slate-800 hover:border-emerald-500 transition-all text-white text-[11px] font-black uppercase tracking-[0.2em] flex justify-between items-center group shadow-inner">
                    Student Analytics Matrix <span className="text-slate-600 group-hover:text-emerald-400 group-hover:translate-x-1 transition-transform">→</span>
                  </button>
                  <button onClick={() => navigate('/prof/upload')} className="w-full bg-slate-950 hover:bg-blue-900/40 text-left px-6 py-4 rounded-2xl border border-slate-800 hover:border-blue-500 transition-all text-white text-[11px] font-black uppercase tracking-[0.2em] flex justify-between items-center group shadow-inner">
                    RAG Upload Manager <span className="text-slate-600 group-hover:text-blue-400 group-hover:translate-x-1 transition-transform">→</span>
                  </button>
                  <button onClick={() => setQuizManagerModal(true)} className="w-full bg-slate-950 hover:bg-purple-900/40 text-left px-6 py-4 rounded-2xl border border-slate-800 hover:border-purple-500 transition-all text-white text-[11px] font-black uppercase tracking-[0.2em] flex justify-between items-center group shadow-inner">
                    Quiz & Assessment Manager <span className="text-slate-600 group-hover:text-purple-400 group-hover:translate-x-1 transition-transform">→</span>
                  </button>
                  <button onClick={() => navigate('/prof/frequency')} className="w-full bg-slate-950 hover:bg-amber-900/40 text-left px-6 py-4 rounded-2xl border border-slate-800 hover:border-amber-500 transition-all text-white text-[11px] font-black uppercase tracking-[0.2em] flex justify-between items-center group shadow-inner">
                    Item Frequency Analysis <span className="text-slate-600 group-hover:text-amber-400 group-hover:translate-x-1 transition-transform">→</span>
                  </button>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl flex flex-col h-[400px]">
                <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4 shrink-0">
                  <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] leading-snug w-32">Shared Dept Repository</h3>
                  <div className="flex bg-slate-950 rounded-lg p-1 border border-slate-800">
                    <button onClick={() => setRepoTab('ACTIVE')} className={`text-[9px] font-black px-4 py-1.5 rounded uppercase tracking-widest transition-colors ${repoTab === 'ACTIVE' ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:text-white'}`}>Active</button>
                    <button onClick={() => setRepoTab('ARCHIVED')} className={`text-[9px] font-black px-4 py-1.5 rounded uppercase tracking-widest transition-colors ${repoTab === 'ARCHIVED' ? 'bg-slate-700 text-slate-300' : 'text-slate-500 hover:text-white'}`}>Archived</button>
                    <button onClick={() => setRepoTab('DRAFT')} className={`text-[9px] font-black px-4 py-1.5 rounded uppercase tracking-widest transition-colors ${repoTab === 'DRAFT' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-white'}`}>Drafts</button>
                  </div>
                </div>
                <div className="space-y-4 overflow-y-auto custom-scrollbar pr-2 flex-grow">
                  {isLoadingVault ? <p className="text-center text-slate-500 text-xs tracking-widest uppercase mt-4">Syncing Database...</p> : 
                   displayedModules.length === 0 ? <p className="text-center text-slate-600 font-bold uppercase text-xs mt-10 tracking-widest">No Modules Found</p> :
                   displayedModules.map((mod, i) => (
                    <div key={i} className="bg-slate-950 border border-slate-800 p-5 rounded-2xl flex flex-col shadow-inner group hover:border-slate-600 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] text-emerald-400 font-mono font-black">{mod.id}</span>
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 bg-slate-900 px-2 py-1 rounded">MODULE</span>
                      </div>
                      <p className="text-sm text-white font-bold truncate mb-4">{mod.title}</p>
                      <div className="flex justify-between items-center mt-auto">
                        <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">By: {mod.author}</p>
                        <div className="flex gap-2">
                          {repoTab === 'DRAFT' ? (
                            <button onClick={() => navigate('/prof/upload')} className="bg-slate-900 hover:bg-blue-900/40 text-blue-400 border border-slate-700 hover:border-blue-500 text-[9px] font-black px-3 py-1.5 rounded uppercase tracking-widest transition-colors">Resume Draft</button>
                          ) : (
                            <>
                              <button onClick={() => navigate(`/reader/${mod.id}`, { state: { itemName: mod.title }})} className="bg-slate-900 hover:bg-blue-900/40 text-blue-400 border border-slate-700 hover:border-blue-500 text-[9px] font-black px-3 py-1.5 rounded uppercase tracking-widest transition-colors">Read</button>
                              <button onClick={() => toggleArchive(mod.id, mod.status)} className={`text-[9px] font-black px-3 py-1.5 rounded uppercase tracking-widest transition-colors border ${repoTab === 'ACTIVE' ? 'bg-slate-900 text-amber-500 border-slate-700 hover:border-amber-500' : 'bg-slate-900 text-emerald-500 border-slate-700 hover:border-emerald-500'}`}>
                                {repoTab === 'ACTIVE' ? 'Archive' : 'Restore'}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl flex flex-col h-[770px]">
              <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4 shrink-0">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Dept Telemetry
                </h3>
                <select value={telemetryFilter} onChange={(e) => setTelemetryFilter(e.target.value)} className="bg-slate-950 border border-slate-800 text-slate-400 font-black text-[9px] uppercase tracking-[0.2em] p-2.5 rounded-lg outline-none focus:border-emerald-500 cursor-pointer">
                  <option value="ALL">FILTER: RECENT ALL</option>
                  {assignedSubjects.map((sub, idx) => (
                    <option key={idx} value={sub}>CATEGORY: {sub.toUpperCase()}</option>
                  ))}
                </select>
              </div>
              <div className="flex-grow bg-slate-950 rounded-2xl border border-slate-800 p-6 overflow-y-auto custom-scrollbar shadow-inner">
                <table className="w-full text-left border-collapse">
                  <thead className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 border-b border-slate-800">
                    <tr><th className="pb-4 pl-2">Student</th><th className="pb-4">Action Log</th><th className="pb-4">Result</th><th className="pb-4 text-right pr-2">Time</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {displayedTelemetry.length === 0 && (
                        <tr><td colSpan="4" className="py-6 text-center text-slate-500 text-xs font-mono uppercase tracking-widest">No telemetry data recorded.</td></tr>
                    )}
                    {displayedTelemetry.map((log, i) => (
                      <tr key={i} className="hover:bg-slate-900 transition-colors group">
                        <td className="py-6 text-white font-bold text-sm whitespace-nowrap pr-4 pl-2 uppercase">{log.student}</td>
                        <td className="py-6 text-slate-400 text-sm pr-4 font-medium">{log.action}</td>
                        <td className="py-6 whitespace-nowrap">
                          <span className={`text-[10px] font-mono font-black px-3 py-1.5 rounded-lg border tracking-widest ${log.score.includes('9') || log.score.includes('8') || log.score === '100%' ? 'bg-emerald-950/50 text-emerald-400 border-emerald-900/50' : log.score.includes('4') || log.score.includes('5') || log.score.includes('6') ? 'bg-red-950/50 text-red-400 border-red-900/50' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>{log.score}</span>
                        </td>
                        <td className="py-6 text-right text-[10px] text-slate-600 font-mono font-bold whitespace-nowrap pr-2">{log.time || new Date().toLocaleTimeString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      </div>
    </GlobalSocketOverlay>
  );
}