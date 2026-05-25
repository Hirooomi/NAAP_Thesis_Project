import { useState, useEffect } from 'react';

export default function TicketTriage() {
  // ==========================================
  // RBAC: ROLE-BASED ACCESS CONTROL
  // ==========================================
  const adminRole = localStorage.getItem('role') || 'HEAD_ADMIN';
  const currentClearanceLevel = parseInt(localStorage.getItem('adminClearance') || '0', 10); 
  const userId = localStorage.getItem('userId') || 'h20041811';

  const [aiModal, setAiModal] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [aiDraft, setAiDraft] = useState("");

  const [tickets, setTickets] = useState({
    'URGENT': [],
    'IMPORTANT': [],
    'MODERATE': [],
    'INTERMEDIATE': []
  });

  // FETCH LIVE TICKETS FROM DATABASE WITH JWT
  const fetchTickets = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const res = await fetch('https://ztp98nvz-8000.asse.devtunnels.ms/api/tickets/active', {
          method: 'GET',
          headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}` // THE FIX: Phase 2 Security Header
          }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.tickets) {
            setTickets(data.tickets);
        }
      }
    } catch (err) {
      console.error("Failed to fetch live tickets:", err);
    }
  };

  // THE FIX: PHASE 4 WEBSOCKET LIVE SYNC
  useEffect(() => {
    fetchTickets(); // Initial load

    // 1. Establish the tunnel
    const ws = new WebSocket('wss://ztp98nvz-8000.asse.devtunnels.ms/api/ws/stream');
    
    // 2. Listen for the backend broadcast
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.event === 'TICKET_UPDATE') {
            console.log("WebSocket Broadcast Received:", data.message);
            fetchTickets(); // Instantly refresh the board!
        }
    };
    
    // 3. Clean up the tunnel when the admin leaves the page
    return () => ws.close();
  }, []);

  const triggerAIResolve = (ticket) => {
    setAiModal(ticket);
    setIsGenerating(true);
    setAiDraft("");
    
    setTimeout(() => {
      setIsGenerating(false);
      if (ticket.issue.includes('deletion') || ticket.issue.includes('delete') || ticket.issue.includes('Ghost')) {
        setAiDraft(`[SYSTEM LOG]: Authorized Deletion Request Received.\n[SYSTEM LOG]: Database Backup Successfully Created & Verified.\n[SYSTEM LOG]: Corrupted Module Soft-Deleted.\n\nDear ${ticket.name},\n\nYour request has been fulfilled. The module has been backed up and removed from the active repository.\n\nBest regards,\nNAAP IT Support`);
      } else if (ticket.type === 'STUDENT' && ticket.issue.includes('Password')) {
        setAiDraft(`Dear ${ticket.name},\n\nYour account lockout has been overridden by the system administrator. Your temporary password is: NAAP-TEMP-8841.\n\nPlease log in and change your password immediately.\n\nBest regards,\nNAAP IT Support`);
      } else {
        setAiDraft(`Dear ${ticket.name},\n\nWe have received your ticket regarding: "${ticket.issue}".\n\nOur system administrators have reviewed the logs and applied a patch to correct this anomaly. Please refresh your dashboard.\n\nBest regards,\nNAAP IT Support`);
      }
    }, 1500);
  };

  const confirmAndSend = async () => {
    if (currentClearanceLevel === 3) {
        if(!window.confirm(`Your clearance level does not permit direct database execution. Submit this resolution draft to the Maker-Checker queue for Tier 2 approval?`)) {
            return;
        }
    } else {
        if(!window.confirm(`Are you sure you want to execute this action? Database protocols will trigger automatically.`)) {
            return;
        }
    }

    setIsExecuting(true);
    try {
        const token = localStorage.getItem('token');
        const payload = {
            resolution_text: aiDraft,
            executed_by_id: userId,
            clearance_level: currentClearanceLevel
        };

        const res = await fetch(`https://ztp98nvz-8000.asse.devtunnels.ms/api/tickets/resolve/${aiModal.id}`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` // THE FIX: Phase 2 Security Header
            },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            if (currentClearanceLevel === 3) {
                alert("Resolution draft submitted to management queue.");
            } else {
                alert("Resolution logged. Email dispatched via backend SMTP.");
            }
            setAiModal(null);
            fetchTickets(); 
        } else {
            alert("Failed to process ticket resolution on the server.");
        }
    } catch (err) {
        alert("Network Error: Could not reach NAAP servers.");
    } finally {
        setIsExecuting(false);
    }
  };

  return (
    <div className="animate-fade-in flex gap-6 h-[80vh] overflow-x-auto overflow-y-hidden custom-scrollbar pb-4 items-start relative">
      
      {aiModal && (
        <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-blue-900/50 rounded-3xl p-8 max-w-2xl w-full shadow-[0_0_30px_rgba(59,130,246,0.15)] flex flex-col">
            <h3 className="text-xl font-black text-white uppercase tracking-widest mb-4 flex items-center gap-3"><span className="text-blue-500">✨</span> AI Auto-Resolution Protocol</h3>
            
            <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl mb-6">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Target Data Context</p>
              <p className="text-xs text-white font-bold">{aiModal.name} ({aiModal.idNumber})</p>
              <p className="text-[10px] font-mono text-slate-400">{aiModal.email}</p>
              <p className="text-xs text-amber-400 mt-2 font-mono">Issue: {aiModal.issue}</p>
            </div>

            <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-2 block flex justify-between">
                <span>AI Drafted Email & Action Log</span>
                {currentClearanceLevel === 3 && <span className="text-amber-500">Tier 2 Approval Required</span>}
            </label>
            
            {isGenerating ? (
              <div className="h-48 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-center text-blue-500 font-mono text-xs animate-pulse">
                &gt; AI analyzing parameters and drafting response...
              </div>
            ) : (
              <textarea 
                value={aiDraft} onChange={(e) => setAiDraft(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-white text-sm outline-none focus:border-blue-500 resize-none h-48 mb-6 custom-scrollbar"
              />
            )}

            <div className="flex gap-4 mt-auto">
              <button onClick={() => setAiModal(null)} disabled={isExecuting} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-black py-4 rounded-xl uppercase tracking-widest text-xs transition-colors border border-slate-600 disabled:opacity-50">Cancel</button>
              
              <button 
                onClick={confirmAndSend} 
                disabled={isGenerating || isExecuting} 
                className={`flex-1 font-black py-4 rounded-xl uppercase tracking-widest text-xs transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${
                    currentClearanceLevel === 3 
                    ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-900/40' 
                    : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/40'
                }`}
              >
                  {isExecuting ? 'Processing...' : (currentClearanceLevel === 3 ? 'Submit Draft' : 'Execute & Send')}
              </button>
            </div>
          </div>
        </div>
      )}

      {Object.entries(tickets).map(([category, list]) => (
        <div key={category} className="w-96 shrink-0 bg-slate-950 border border-slate-800 rounded-3xl p-5 flex flex-col max-h-full">
          <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-800 shrink-0">
            <h3 className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border ${
              category === 'URGENT' ? 'bg-red-900/20 text-red-500 border-red-900/50' : 
              category === 'IMPORTANT' ? 'bg-amber-900/20 text-amber-500 border-amber-900/50' : 
              'bg-blue-900/20 text-blue-400 border-blue-900/50'
            }`}>{category} Folder</h3>
            <span className="text-[10px] font-mono font-black text-slate-600">{list.length}</span>
          </div>

          <div className="flex-grow overflow-y-auto custom-scrollbar space-y-4 pr-2">
            {list.length === 0 && (
                <div className="text-center py-8"><p className="text-[10px] text-slate-600 uppercase tracking-widest font-mono">No active tickets.</p></div>
            )}
            {list.map(ticket => (
              <div key={ticket.id} className="bg-slate-900 border border-slate-700 p-5 rounded-2xl group transition-colors flex flex-col">
                <div className="flex justify-between items-start mb-3">
                  <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${ticket.type === 'STUDENT' ? 'bg-emerald-900/30 text-emerald-400 border-emerald-900/50' : 'bg-purple-900/30 text-purple-400 border-purple-900/50'}`}>{ticket.type}</span>
                  <span className="text-[9px] font-mono text-slate-500">{ticket.time}</span>
                </div>
                <p className="text-sm font-bold text-white mb-1 leading-snug">{ticket.issue}</p>
                <div className="mt-4 bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{ticket.name} <span className="font-mono ml-1">[{ticket.idNumber}]</span></p>
                  <p className="text-[9px] font-mono text-slate-500 mt-1">{ticket.email}</p>
                  <p className="text-[9px] font-mono text-slate-600 mt-1">Class: {ticket.yearSec}</p>
                </div>
                
                <button onClick={() => triggerAIResolve(ticket)} className="w-full mt-4 bg-slate-800 hover:bg-blue-600 text-blue-400 hover:text-white font-black py-3 rounded-xl text-[9px] uppercase tracking-widest transition-colors flex justify-center items-center gap-2">
                  <span>✨</span> {currentClearanceLevel === 3 ? 'Draft AI Response' : '1-Click AI Resolve'}
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}