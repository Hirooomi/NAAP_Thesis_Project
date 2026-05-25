import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// Import our updated Component Files
import GlobalAnalytics from '../components/admin/GlobalAnalytics';
import DatabaseVault from '../components/admin/DatabaseVault';
import UserArchitect from '../components/admin/UserArchitect';
import TicketTriage from '../components/admin/TicketTriage';
import UIEditor from '../components/admin/UIEditor';
import GlobalComms from '../components/admin/GlobalComms';
import SystemMailbox from '../components/shared/SystemMailbox'; 

export default function HeadAdminDashboard() {
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());
  
  const [activeView, setActiveView] = useState('ANALYTICS'); 
  
  const adminId = localStorage.getItem('userId') || "h20041811";
  const adminRole = localStorage.getItem('role') || "HEAD_ADMIN (TIER 0)";

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // --- GLOBAL CONFIRMATION MODAL ENGINE ---
  const [globalModal, setGlobalModal] = useState({ 
    show: false, 
    type: 'CONFIRM',
    title: '', 
    message: '', 
    onYes: null, 
    onNo: null,
    reasonRequired: false,
    targetId: null
  });
  const [confirmationReason, setConfirmationReason] = useState("");

  const triggerModal = (config) => {
    setConfirmationReason(""); 
    setGlobalModal({
      ...config,
      show: true,
      onNo: config.onNo || (() => setGlobalModal(prev => ({ ...prev, show: false }))),
      onYes: config.onYes 
    });
  };

  // --- LIVE MAKER-CHECKER QUEUE STATE ---
  const [pendingApprovals, setPendingApprovals] = useState([]);

  const fetchPendingApprovals = async () => {
    try {
      const token = localStorage.getItem('token');
      // Failsafe: If no token exists, don't ping the server to avoid 401 spam
      if (!token) return; 

      const res = await fetch('https://ztp98nvz-8000.asse.devtunnels.ms/api/users/pending', {
          method: 'GET',
          headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}` // Secure JWT inclusion
          }
      });
      
      if (res.ok) {
        const data = await res.json();
        setPendingApprovals(data.pending || []);
      }
    } catch (err) {
      console.error("Failed to fetch Maker-Checker queue:", err);
    }
  };

  useEffect(() => {
    fetchPendingApprovals();
    const interval = setInterval(fetchPendingApprovals, 30000);
    return () => clearInterval(interval);
  }, []);

  // --- LIVE ACTIONS WITH GLOBAL MODALS ---
  const handleApproveAccount = (id, name) => {
    triggerModal({
        type: 'CONFIRM',
        title: 'Activate Account?',
        message: `Verify credentials for ${name} (${id})? An automated email with temporary password will be dispatched.`,
        onYes: async () => {
            try {
                const token = localStorage.getItem('token');
                // THE FIX: Added the JWT Authorization Header so the Admin can legally execute this action
                const res = await fetch(`https://ztp98nvz-8000.asse.devtunnels.ms/api/users/approve/${id}`, { 
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                if (res.ok) {
                    setPendingApprovals(prev => prev.filter(req => req.id !== id));
                    alert(`Access activated for ${name}. Email dispatched.`);
                } else {
                    alert("Failed to approve account. Check token authorization.");
                }
            } catch (e) {
                alert("Network error: Could not reach NAAP servers.");
            }
        }
    });
  };

  const handleTerminateSession = () => {
    triggerModal({
        type: 'WARNING',
        title: 'Terminate Session?',
        message: `Are you sure you want to logout? All unsaved UI drafts in the Studio will be lost.`,
        onYes: () => {
            localStorage.clear();
            navigate('/login');
        }
    });
  };

  const handleModalConfirm = () => {
      if (globalModal.reasonRequired && confirmationReason.trim().length < 10) {
          alert("Audit Trail required: Please provide a detailed structural reason (Min 10 characters).");
          return;
      }
      if (globalModal.reasonRequired) {
          console.log(`[AUDIT LOG] Reason for action on ${globalModal.targetId}: ${confirmationReason}`);
      }
      globalModal.onYes(); 
      setGlobalModal(prev => ({ ...prev, show: false })); 
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 font-sans flex overflow-hidden selection:bg-blue-500 selection:text-white">
      
      {/* =========================================
         GLOBAL CONFIRMATION MODAL
      ========================================= */}
      {globalModal.show && (
        <div className="fixed inset-0 bg-black/80 z-[2000] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className={`bg-slate-900 border ${globalModal.type === 'CONFIRM' ? 'border-slate-700' : globalModal.type === 'PURGE_BACKUP' ? 'border-red-600' : 'border-amber-600'} rounded-3xl p-8 max-w-lg w-full text-center shadow-2xl relative`}>
            
            {globalModal.type === 'WARNING' && <span className="text-5xl mb-6 block">⚠️</span>}
            {globalModal.type === 'PURGE_BACKUP' && <span className="text-5xl mb-6 block">Purge</span>}

            <h3 className={`text-xl font-black ${globalModal.type === 'PURGE_BACKUP' ? 'text-red-500' : 'text-white'} uppercase tracking-widest mb-4`}>{globalModal.title}</h3>
            <p className="text-slate-400 text-sm mb-6 leading-relaxed">{globalModal.message}</p>
            
            {globalModal.reasonRequired && (
                <div className="mb-6">
                    <label className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-2 block">Audit Trail Logging (Reason)</label>
                    <textarea 
                        value={confirmationReason} 
                        onChange={e => setConfirmationReason(e.target.value)} 
                        placeholder="Type structural reason for database log..." 
                        className="w-full h-24 bg-slate-950 border border-slate-700 rounded-xl p-4 text-white text-xs outline-none focus:border-amber-500 resize-none custom-scrollbar" 
                    />
                </div>
            )}

            <div className="flex gap-4">
              <button onClick={globalModal.onNo} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-black py-3.5 rounded-xl uppercase tracking-widest text-xs transition-colors shadow-lg">No, Cancel</button>
              <button onClick={handleModalConfirm} className={`flex-1 ${globalModal.type === 'PURGE_BACKUP' ? 'bg-red-600 hover:bg-red-500' : 'bg-blue-600 hover:bg-blue-500'} text-white font-black py-3.5 rounded-xl uppercase tracking-widest text-xs transition-colors shadow-lg active:scale-[0.98]`}>
                {globalModal.type === 'CONFIRM' ? 'Yes, Continue' : globalModal.type === 'WARNING' ? 'Yes, Logout' : 'Yes, Execute Purge'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LEFT SIDEBAR */}
      <div className="w-72 bg-slate-950 border-r border-slate-800 flex flex-col z-50 shrink-0 shadow-2xl relative">
        <div className="p-8 border-b border-slate-800">
          <h1 className="text-xl font-black text-white tracking-widest uppercase">NAAP <span className="text-blue-500">AMT</span></h1>
          <p className="text-[10px] font-mono text-slate-500 mt-2 tracking-[0.2em]">{adminRole}</p>
        </div>

        <nav className="flex-grow flex flex-col p-4 space-y-2 overflow-y-auto custom-scrollbar">
          <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest pl-4 mb-2 mt-2">Global Telemetry</p>
          <button onClick={() => setActiveView('ANALYTICS')} className={`flex items-center gap-4 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeView === 'ANALYTICS' ? 'bg-blue-900/30 text-blue-400 border border-blue-500/50' : 'text-slate-500 hover:bg-slate-900 hover:text-slate-300'}`}><span className="text-lg">📊</span> Global Matrix</button>

          <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest pl-4 mb-2 mt-4">Administrative Pillars</p>
          <button onClick={() => setActiveView('DATABASE')} className={`flex items-center gap-4 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeView === 'DATABASE' ? 'bg-amber-900/30 text-amber-400 border border-amber-500/50' : 'text-slate-500 hover:bg-slate-900 hover:text-slate-300'}`}><span className="text-lg">🗄️</span> The Vault (DB)</button>
          
          <button onClick={() => setActiveView('CREATE')} className={`flex items-center gap-4 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all relative ${activeView === 'CREATE' ? 'bg-blue-900/30 text-blue-400 border border-blue-500/50' : 'text-slate-500 hover:bg-slate-900 hover:text-slate-300'}`}>
            <span className="text-lg">👥</span> User Architect 
            {pendingApprovals.length > 0 && <span className="absolute right-4 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] animate-pulse">{pendingApprovals.length}</span>}
          </button>
          
          <button onClick={() => setActiveView('TICKETS')} className={`flex items-center gap-4 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeView === 'TICKETS' ? 'bg-purple-900/30 text-purple-400 border border-purple-500/50' : 'text-slate-500 hover:bg-slate-900 hover:text-slate-300'}`}><span className="text-lg">🎫</span> Triage Board</button>
          <button onClick={() => setActiveView('UI_EDITOR')} className={`flex items-center gap-4 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeView === 'UI_EDITOR' ? 'bg-slate-800 text-white border border-slate-600 shadow-[0_0_15px_rgba(255,255,255,0.1)]' : 'text-slate-500 hover:bg-slate-900 hover:text-slate-300'}`}><span className="text-lg">💻</span> Core UI Editor</button>
          <button onClick={() => setActiveView('ANNOUNCEMENTS')} className={`flex items-center gap-4 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeView === 'ANNOUNCEMENTS' ? 'bg-red-900/30 text-red-400 border border-red-500/50' : 'text-slate-500 hover:bg-slate-900 hover:text-slate-300'}`}><span className="text-lg">📣</span> Global Comms</button>

          <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest pl-4 mb-2 mt-4">Privilege Inheritance</p>
          <button onClick={() => navigate('/prof/upload')} className="flex items-center gap-4 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all text-emerald-500 hover:bg-emerald-900/30 hover:text-emerald-400 border border-transparent hover:border-emerald-500/50">
            <span className="text-lg">⚡</span> Launch RAG Studio
          </button>
        </nav>

        <div className="p-6 border-t border-slate-800 bg-slate-950 mt-auto">
          <button onClick={handleTerminateSession} className="w-full bg-slate-900 hover:bg-red-900/40 border border-slate-800 hover:border-red-500 text-slate-500 hover:text-red-400 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] transition-colors">Terminate Session</button>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-grow flex flex-col relative overflow-hidden bg-slate-900 h-screen">
        <header className="h-24 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 flex justify-between items-center px-10 shrink-0 z-40 relative">
          <div>
            <h2 className="text-sm font-black text-slate-400 uppercase tracking-[0.3em]">System Overview</h2>
            <p className="text-xl font-black text-white uppercase tracking-widest">{activeView.replace('_', ' ')}</p>
          </div>
          <div className="flex gap-6 items-center">
            <SystemMailbox />
            <div className="bg-slate-900 border border-slate-800 px-6 py-2 rounded-xl text-right shadow-inner">
               <p className="text-[9px] text-slate-500 uppercase tracking-[0.3em] font-black">Secure Time</p>
               <p className="text-blue-400 font-mono text-sm font-bold">{currentTime.toLocaleTimeString()}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Logged In</p>
              <p className="text-white font-mono text-sm font-bold uppercase">{adminId}</p>
            </div>
          </div>
        </header>

        <div className="flex-grow overflow-y-auto custom-scrollbar p-10 relative">
          {activeView === 'ANALYTICS' && <GlobalAnalytics />}
          {activeView === 'DATABASE' && <DatabaseVault triggerModal={triggerModal} />}
          {activeView === 'CREATE' && <UserArchitect pendingApprovals={pendingApprovals} triggerModal={triggerModal} handleApproveAccount={handleApproveAccount} setPendingApprovals={setPendingApprovals} />}
          {activeView === 'TICKETS' && <TicketTriage triggerModal={triggerModal} />}
          {activeView === 'UI_EDITOR' && <UIEditor triggerModal={triggerModal} />}
          {activeView === 'ANNOUNCEMENTS' && <GlobalComms triggerModal={triggerModal} />}
        </div>
      </div>
    </div>
  );
}