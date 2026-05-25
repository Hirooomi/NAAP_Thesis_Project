import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function DatabaseVault({ triggerModal }) {
  const navigate = useNavigate();
  const currentClearanceLevel = parseInt(localStorage.getItem('adminClearance') || '0', 10);

  const [vaultTab, setVaultTab] = useState('MODULES'); // MODULES, QUIZZES
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Live Data States
  const [globalModules, setGlobalModules] = useState([]);
  const [globalQuizzes, setGlobalQuizzes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // The 7 Official CAAP Broad Categories
  const caapCategories = [
    'ALL',
    '1. Air Law & Airworthiness',
    '2. Natural Science',
    '3. Aircraft Engineering',
    '4. Aircraft Maintenance',
    '5. Powerplant Rating',
    '6. Airframe Rating',
    '7. Human Performance'
  ];

  // Fetch Live Vault Data
  const fetchVaultData = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('https://ztp98nvz-8000.asse.devtunnels.ms/api/vault/assets');
      if (res.ok) {
        const data = await res.json();
        setGlobalModules(data.modules);
        setGlobalQuizzes(data.quizzes);
      }
    } catch (err) {
      console.error("Failed to fetch vault data:", err);
    } finally {
      setIsLoading(false);
    }
  };

useEffect(() => {
    fetchVaultData();
    
    // THE FIX: Listen for Live Backend WebSocket Events
    const token = localStorage.getItem('token');
const ws = new WebSocket(`wss://ztp98nvz-8000.asse.devtunnels.ms/api/ws/connect?token=${token}`);
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.event === "VAULT_UPDATE") {
            console.log("[WS] Admin modified Vault! Updating Global Library...");
            fetchVaultData(); // Instantly add or remove modules without reloading!
        }
    };
    return () => ws.close(); // Cleanup
  }, []);

  // Soft Purge (Ghost) - Hides from public, keeps in DB
  const handleGhostModule = async (id, title, currentStatus) => {
    if (currentClearanceLevel > 1) {
        alert("Tier 0 or Tier 1 Clearance required to Ghost/Unghost modules.");
        return;
    }

    const newStatus = currentStatus === 'GHOSTED' ? 'ACTIVE' : 'GHOSTED';
    
    triggerModal({
      type: 'CONFIRM',
      title: `${newStatus === 'GHOSTED' ? 'Soft Purge' : 'Restore'} Module?`,
      message: `Change ${title} (${id}) status to ${newStatus}?`,
      onYes: async () => {
        try {
            await fetch(`https://ztp98nvz-8000.asse.devtunnels.ms/api/vault/status/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });
            fetchVaultData();
        } catch (e) { alert("Failed to update status."); }
      }
    });
  };

  // Hard Purge - Permanent Deletion (Tier 0 Only)
  const handleHardDelete = async (id, title, type) => {
    if (currentClearanceLevel !== 0) {
        alert("CRITICAL: Only Tier 0 (Head Admin) can Hard Purge database assets.");
        return;
    }

    triggerModal({
        type: 'PURGE_BACKUP',
        title: `HARD PURGE: ${title}?`,
        message: `WARNING: This will permanently delete ${id} from the PostgreSQL database. This action cannot be undone. Proceed?`,
        reasonRequired: true,
        targetId: id,
        onYes: async () => {
            try {
                await fetch(`https://ztp98nvz-8000.asse.devtunnels.ms/api/vault/purge/${id}?type=${type}`, { method: 'DELETE' });
                alert(`[SYSTEM] Asset ${id} permanently deleted.`);
                fetchVaultData();
            } catch (e) { alert("Failed to purge asset."); }
        }
    });
  };

  // View / Test Simulation Routing
  const handleTestView = (id, title, type) => {
    triggerModal({
        type: 'CONFIRM',
        title: `Enter ${type} Studio?`,
        message: `Bypass normal routing and open the Read-Only Studio for ${title} (${id})?`,
        onYes: () => {
            // FIX: Replaced alert with dynamic standard routing to the respective UI
            if (type === 'MODULE') {
                navigate(`/reader/${id}`, { state: { title, mode: 'READ_ONLY' } });
            } else {
                navigate(`/quiz/${id}`, { state: { title, mode: 'READ_ONLY' } });
            }
        }
    });
  };

  // Filtering Logic
  const filteredModules = globalModules.filter(mod => 
    (activeFilter === 'ALL' || mod.category === activeFilter) &&
    mod.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredQuizzes = globalQuizzes.filter(quiz => 
    (activeFilter === 'ALL' || quiz.category === activeFilter) &&
    quiz.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="animate-fade-in max-w-[100rem] mx-auto bg-slate-950 border border-slate-800 rounded-3xl p-8 shadow-2xl relative flex flex-col h-[85vh]">
      
      {/* HEADER & CONTROLS */}
      <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-6 shrink-0">
        <div className="flex flex-col gap-4">
            <div className="flex gap-4 items-center">
            <h3 className="text-xl font-black text-white uppercase tracking-widest">Global Vault Access</h3>
            <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-800 ml-4">
                <button onClick={() => setVaultTab('MODULES')} className={`text-[10px] font-black px-6 py-2 rounded uppercase tracking-widest transition-colors ${vaultTab === 'MODULES' ? 'bg-amber-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>Modules</button>
                <button onClick={() => setVaultTab('QUIZZES')} className={`text-[10px] font-black px-6 py-2 rounded uppercase tracking-widest transition-colors ${vaultTab === 'QUIZZES' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>Quizzes</button>
            </div>
            </div>

            {/* THE CAAP SUBJECT FILTER */}
            <div className="flex items-center gap-3">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Jurisdiction Filter:</span>
                <select 
                    value={activeFilter} 
                    onChange={e => setActiveFilter(e.target.value)}
                    className="bg-slate-900 border border-slate-700 text-blue-400 text-xs font-bold px-4 py-2 rounded-lg outline-none focus:border-blue-500 cursor-pointer"
                >
                    {caapCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
            </div>
        </div>

        <input 
            type="text" 
            placeholder="Search Vault Database..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-white text-xs font-bold px-6 py-4 rounded-xl outline-none focus:border-amber-500 w-96 shadow-inner" 
        />
      </div>

      {/* DATA TABLE */}
      <div className="flex-grow overflow-y-auto custom-scrollbar pr-2">
        <table className="w-full text-left border-collapse">
          <thead className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-600 border-b border-slate-800 sticky top-0 bg-slate-950 z-10">
            <tr><th className="pb-4 pl-2">ID & Title</th><th className="pb-4">Author</th><th className="pb-4">Category</th><th className="pb-4">Metrics/Status</th><th className="pb-4 text-right pr-2">Actions</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {isLoading ? (
                <tr><td colSpan="5" className="py-10 text-center text-slate-500 text-xs font-mono animate-pulse">Scanning Secure Vault...</td></tr>
            ) : vaultTab === 'MODULES' ? (
                filteredModules.length === 0 ? <tr><td colSpan="5" className="py-10 text-center text-slate-500 text-xs font-mono">No modules found in this category.</td></tr> :
                filteredModules.map((mod) => (
              <tr key={mod.id} className={`hover:bg-slate-900 transition-colors ${mod.status === 'GHOSTED' ? 'opacity-50 hover:opacity-100' : ''}`}>
                <td className="py-4 pl-2 w-1/3">
                  <span className="block text-[10px] text-amber-500 font-mono font-black mb-1">{mod.id}</span>
                  <span className="text-sm text-white font-bold block truncate">{mod.title}</span>
                </td>
                <td className="py-4 text-slate-400 text-[10px] font-bold uppercase tracking-wider">{mod.author}</td>
                <td className="py-4 text-blue-400 text-[9px] font-bold uppercase tracking-widest">{mod.category}</td>
                <td className="py-4">
                  <span className={`text-[9px] font-black px-3 py-1.5 rounded uppercase tracking-widest border ${mod.status === 'ACTIVE' ? 'bg-emerald-900/20 text-emerald-400 border-emerald-900/50' : mod.status === 'ARCHIVED' ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-transparent text-slate-500 border-dashed border-slate-600'}`}>
                      {mod.status === 'GHOSTED' ? 'SOFT PURGED' : mod.status}
                  </span>
                </td>
                <td className="py-4 text-right pr-2">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => handleTestView(mod.id, mod.title, 'MODULE')} className="text-[9px] font-black px-3 py-1.5 rounded border border-slate-700 text-blue-400 hover:bg-slate-800 uppercase tracking-widest transition-colors">Test / View</button>
                    
                    {/* Soft Purge Toggle */}
                    <button 
                        onClick={() => handleGhostModule(mod.id, mod.title, mod.status)} 
                        className={`text-[9px] font-black px-3 py-1.5 rounded uppercase tracking-widest border transition-colors ${mod.status === 'GHOSTED' ? 'bg-amber-900/30 text-amber-500 border-amber-900/50 hover:bg-amber-600 hover:text-white' : 'bg-transparent text-slate-500 border-slate-700 hover:border-amber-500 hover:text-amber-500'}`}
                    >
                        {mod.status === 'GHOSTED' ? 'Restore' : 'Soft Purge'}
                    </button>
                    
                    {/* Hard Purge (Tier 0 Only) */}
                    <button 
                        onClick={() => handleHardDelete(mod.id, mod.title, 'module')} 
                        disabled={currentClearanceLevel !== 0}
                        className={`text-[9px] font-black px-3 py-1.5 rounded uppercase tracking-widest border transition-colors ${currentClearanceLevel === 0 ? 'bg-red-900/20 text-red-500 border-red-900/50 hover:bg-red-600 hover:text-white' : 'bg-transparent text-slate-700 border-slate-800 cursor-not-allowed'}`}
                    >
                        Hard Purge
                    </button>
                  </div>
                </td>
              </tr>
            ))) : (
                filteredQuizzes.length === 0 ? <tr><td colSpan="5" className="py-10 text-center text-slate-500 text-xs font-mono">No quizzes found in this category.</td></tr> :
                filteredQuizzes.map((quiz) => (
              <tr key={quiz.id} className={`hover:bg-slate-900 transition-colors ${quiz.status === 'GHOSTED' ? 'opacity-50 hover:opacity-100' : ''}`}>
                <td className="py-4 pl-2 w-1/3">
                  <span className="block text-[10px] text-purple-500 font-mono font-black mb-1">{quiz.id}</span>
                  <span className="text-sm text-white font-bold block truncate">{quiz.title}</span>
                </td>
                <td className="py-4 text-slate-400 text-[10px] font-bold uppercase tracking-wider">{quiz.author}</td>
                <td className="py-4 text-blue-400 text-[9px] font-bold uppercase tracking-widest">{quiz.category}</td>
                <td className="py-4">
                    <span className="text-[10px] text-slate-400 font-mono font-black block mb-1">{quiz.questions} Items</span>
                    <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-widest border ${quiz.status === 'ACTIVE' ? 'bg-emerald-900/20 text-emerald-400 border-emerald-900/50' : 'bg-transparent text-slate-500 border-dashed border-slate-600'}`}>
                        {quiz.status === 'GHOSTED' ? 'SOFT PURGED' : quiz.status}
                    </span>
                </td>
                <td className="py-4 text-right pr-2">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => handleTestView(quiz.id, quiz.title, 'QUIZ')} className="text-[9px] font-black px-3 py-1.5 rounded border border-slate-700 text-purple-400 hover:bg-slate-800 uppercase tracking-widest">Test / View</button>
                    
                    <button 
                        onClick={() => handleGhostModule(quiz.id, quiz.title, quiz.status)} 
                        className={`text-[9px] font-black px-3 py-1.5 rounded uppercase tracking-widest border transition-colors ${quiz.status === 'GHOSTED' ? 'bg-amber-900/30 text-amber-500 border-amber-900/50 hover:bg-amber-600 hover:text-white' : 'bg-transparent text-slate-500 border-slate-700 hover:border-amber-500 hover:text-amber-500'}`}
                    >
                        {quiz.status === 'GHOSTED' ? 'Restore' : 'Soft Purge'}
                    </button>

                    <button 
                        onClick={() => handleHardDelete(quiz.id, quiz.title, 'quiz')} 
                        disabled={currentClearanceLevel !== 0}
                        className={`text-[9px] font-black px-3 py-1.5 rounded uppercase tracking-widest border transition-colors ${currentClearanceLevel === 0 ? 'bg-red-900/20 text-red-500 border-red-900/50 hover:bg-red-600 hover:text-white' : 'bg-transparent text-slate-700 border-slate-800 cursor-not-allowed'}`}
                    >
                        Hard Purge
                    </button>
                  </div>
                </td>
              </tr>
            )))}
          </tbody>
        </table>
      </div>
    </div>
  );
}