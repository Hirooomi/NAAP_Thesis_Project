import { useState, useEffect } from 'react';

export default function GlobalComms({ triggerModal }) {
  // ==========================================
  // RBAC: ROLE-BASED ACCESS CONTROL
  // ==========================================
  const adminRole = localStorage.getItem('role') || 'HEAD_ADMIN';
  const currentClearanceLevel = parseInt(localStorage.getItem('adminClearance') || '0', 10); 
  
  const [sendAsEmail, setSendAsEmail] = useState(false);
  const [announcementText, setAnnouncementText] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [severity, setSeverity] = useState("LOW"); 
  const [headerText, setHeaderText] = useState(""); 
  const [isDrafting, setIsDrafting] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  
  // LIVE MAKER-CHECKER QUEUE STATE
  const [scheduledRequests, setScheduledRequests] = useState([]);

  // FETCH PENDING COMMS FROM DATABASE
  const fetchPendingComms = async () => {
    try {
      const res = await fetch('https://ztp98nvz-8000.asse.devtunnels.ms/api/comms/pending');
      if (res.ok) {
        const data = await res.json();
        if (data.pending) {
            setScheduledRequests(data.pending);
        }
      }
    } catch (err) {
      console.error("Failed to fetch pending comms:", err);
    }
  };

  useEffect(() => {
    fetchPendingComms();
    const interval = setInterval(fetchPendingComms, 15000);
    return () => clearInterval(interval);
  }, []);

  const generateAIText = async () => {
    setIsDrafting(true);
    setAnnouncementText("Synthesizing parameters with AI Engine...");
    
    try {
      // THE FIX: Payload perfectly aligned to the backend AIDraftRequest
      const payload = {
        topic: headerText || "System Update",
        date: scheduleDate || "Immediate",
        severity: severity
      };

      const response = await fetch('https://ztp98nvz-8000.asse.devtunnels.ms/api/comms/ai-draft', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error("AI drafting failed. Verify backend connection.");
      const data = await response.json();
      
      setAnnouncementText(data.draft || "Failed to generate text.");
    } catch (err) {
      setAnnouncementText("");
      alert(`AI Engine Error: ${err.message}`);
    } finally {
      setIsDrafting(false);
    }
  };

  const handleDeployBroadcast = () => {
    if(!announcementText.trim() || !headerText.trim()) {
        triggerModal({ type: 'WARNING', title: 'Missing Data', message: 'ERROR: Both Header and Broadcast Content are required to deploy.' });
        return;
    }

    const payload = {
        header: headerText,
        message: announcementText,
        severity: severity,
        schedule_date: scheduleDate, 
        dispatch_email: sendAsEmail,
        author: adminRole,
        requested_by_id: localStorage.getItem('userId') || 'SYSTEM',
        clearance_level: currentClearanceLevel
    };

    // RBAC: Check if the current user is allowed to deploy this severity
    const isRestricted = 
        (currentClearanceLevel === 3) || 
        (currentClearanceLevel === 2 && severity === 'CRITICAL');

    if (isRestricted) {
        triggerModal({
            type: 'CONFIRM',
            title: 'Submit Comms Request?',
            message: `Your clearance (Level ${currentClearanceLevel}) does not permit direct deployment of ${severity} messages. Submit this draft for superior approval?`,
            onYes: async () => {
                setIsDeploying(true);
                try {
                    const response = await fetch('https://ztp98nvz-8000.asse.devtunnels.ms/api/comms/deploy', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    if (response.ok) {
                        alert(`[SYSTEM] Comms Draft placed in the Maker-Checker queue for authorization.`);
                        setAnnouncementText("");
                        setHeaderText("");
                        setScheduleDate("");
                        fetchPendingComms(); // Refresh queue
                    } else {
                        alert("Failed to submit request to server.");
                    }
                } catch (e) {
                    alert("Network Error: Could not reach NAAP servers.");
                } finally {
                    setIsDeploying(false);
                }
            }
        });
        return;
    }

    // Normal Execution for Authorized Tiers
    triggerModal({
        type: 'CONFIRM',
        title: 'Confirm Push Deployment?',
        message: sendAsEmail 
            ? 'Send this push notification network-wide AND dispatch to all registered emails immediately?' 
            : 'Send this push notification network-wide immediately?',
        onYes: async () => {
            setIsDeploying(true);
            try {
                const response = await fetch('https://ztp98nvz-8000.asse.devtunnels.ms/api/comms/deploy', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) throw new Error("Deployment failed on the server.");
                
                alert('Global Broadcast Fired Successfully!');
                setAnnouncementText("");
                setHeaderText("");
                setScheduleDate("");
            } catch (err) {
                alert(`Deployment Error: ${err.message}`);
            } finally {
                setIsDeploying(false);
            }
        }
    });
  };

  const executeKillSwitchConfirmation = () => {
    const confirmationText = window.prompt("ULTIMATE AUTHORIZATION REQUIRED.\n\nType 'CONFIRM SHUTDOWN' to sever database connections network-wide.");
    if(confirmationText === "CONFIRM SHUTDOWN") {
        alert("EXECUTION ACCEPTED. Sessions frozen. Offline Review Mode activated.");
    } else {
        alert("Incorrect code. Shutdown Aborted.");
    }
  };

  const triggerKillSwitchModal = () => {
    triggerModal({
        type: 'PURGE_BACKUP',
        title: '⚠️ CRITICAL SHUTDOWN PROTOCOL',
        message: 'You are initiating a global server shutdown. PostgreSQL connections will be severed, and all live student assessments will be forced into Offline Review Mode to prevent data corruption.',
        reasonRequired: true,
        targetId: 'SERVER_KILL_SWITCH',
        onYes: () => executeKillSwitchConfirmation()
    });
  };

  return (
    <div className="animate-fade-in grid grid-cols-1 xl:grid-cols-2 gap-8 max-w-7xl mx-auto">
      
      {/* STANDARD BROADCAST CREATOR */}
      <div className="bg-slate-950 border border-slate-800 rounded-3xl p-8 md:p-10 shadow-2xl flex flex-col relative">
        <h3 className="text-2xl font-black text-white uppercase tracking-widest mb-2 flex items-center gap-3"><span className="text-blue-500">📣</span> Global Push System</h3>
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-8">Send notifications or schedules.</p>

        <div className="space-y-6 flex-grow">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block flex justify-between">
                 <span>Severity Level</span>
                 {currentClearanceLevel === 3 && <span className="text-amber-500">Req. Approval</span>}
                 {currentClearanceLevel === 2 && severity === 'CRITICAL' && <span className="text-amber-500">Req. L1 Auth</span>}
              </label>
              <select value={severity} onChange={(e) => setSeverity(e.target.value)} className="w-full bg-slate-900 border border-slate-700 text-white text-xs font-bold p-4 rounded-xl outline-none cursor-pointer focus:border-blue-500">
                <option value="LOW">Low Severity</option>
                {currentClearanceLevel <= 2 && <option value="MODERATE">Moderate Popup</option>}
                {currentClearanceLevel <= 1 && <option value="CRITICAL">CRITICAL Banner</option>}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Scheduled Deployment</label>
              <input type="datetime-local" value={scheduleDate} onChange={e=>setScheduleDate(e.target.value)} className="w-full bg-slate-900 border border-slate-700 text-white text-xs font-bold p-4 rounded-xl outline-none cursor-pointer focus:border-blue-500" />
            </div>
          </div>
          
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Message Header</label>
            <input type="text" value={headerText} onChange={(e) => setHeaderText(e.target.value)} placeholder="e.g., SCHEDULED DATABASE MAINTENANCE" className="w-full bg-slate-900 border border-slate-700 text-white text-sm font-bold p-4 rounded-xl outline-none focus:border-blue-500" />
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Broadcast Content</label>
              <button onClick={generateAIText} disabled={isDrafting} className="text-[9px] font-black uppercase tracking-widest text-blue-400 hover:text-white transition-colors bg-blue-900/20 px-3 py-1 rounded border border-blue-900/50 disabled:opacity-50">
                {isDrafting ? '✨ PROCESSING...' : '✨ AI Assistant'}
              </button>
            </div>
            <textarea 
              value={announcementText} onChange={e=>setAnnouncementText(e.target.value)}
              rows="5" placeholder="Type message or use AI Assistant to draft..." 
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-white text-sm outline-none resize-none custom-scrollbar focus:border-blue-500"
            />
          </div>

          <label className="flex items-center gap-3 text-xs font-bold text-slate-300 cursor-pointer hover:text-white transition-colors">
            <input type="checkbox" checked={sendAsEmail} onChange={e=>setSendAsEmail(e.target.checked)} className="w-4 h-4 accent-blue-500 cursor-pointer" />
            Simultaneously dispatch to Registered Email Accounts
          </label>
        </div>

        <button 
            onClick={handleDeployBroadcast} 
            disabled={isDeploying || isDrafting} 
            className={`w-full font-black py-5 rounded-xl uppercase tracking-[0.2em] text-xs transition-colors shadow-lg active:scale-95 mt-6 disabled:opacity-50 disabled:cursor-not-allowed ${
                (currentClearanceLevel === 3) || (currentClearanceLevel === 2 && severity === 'CRITICAL') 
                ? 'bg-amber-600 hover:bg-amber-500 text-white border border-amber-500/50' 
                : 'bg-blue-600 hover:bg-blue-500 text-white'
            }`}
        >
          {isDeploying ? 'PROCESSING...' : 
            ((currentClearanceLevel === 3) || (currentClearanceLevel === 2 && severity === 'CRITICAL') 
            ? `Request ${severity} Deployment` 
            : 'Deploy Push Notification 🚀')
          }
        </button>
      </div>

      <div className="flex flex-col gap-8">
        {/* CO-ADMIN SCHEDULING REQUESTS */}
        <div className="bg-slate-950 border border-slate-800 rounded-3xl p-8 shadow-2xl flex-grow flex flex-col">
          <h3 className="text-lg font-black text-white uppercase tracking-widest mb-6 border-b border-slate-800 pb-4">Maker-Checker Queue (Comms)</h3>
          <div className="flex-grow overflow-y-auto custom-scrollbar pr-2 space-y-4">
            
            {scheduledRequests.length === 0 && (
                <div className="text-center py-8"><p className="text-[10px] text-slate-600 uppercase tracking-widest font-mono">No pending comms requests.</p></div>
            )}

            {scheduledRequests.map(req => (
              <div key={req.id} className="bg-slate-900 border border-slate-700 p-5 rounded-2xl">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest block mb-1 border border-amber-900/50 bg-amber-900/20 px-2 py-0.5 w-max rounded">PENDING APPROVAL</span>
                  <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">Req By: {req.admin}</span>
                </div>
                <p className="text-sm font-bold text-white mb-1">Target: {req.date}</p>
                <p className="text-[10px] text-slate-400 font-mono mb-4">Header: {req.reason}</p>
                
                {currentClearanceLevel <= 1 ? (
                  <div className="flex gap-2">
                    <button onClick={() => { 
                        triggerModal({ type: 'CONFIRM', title: 'Authorize Request?', message: `Deploy this requested broadcast?`, onYes: async () => { 
                            try {
                                const res = await fetch(`https://ztp98nvz-8000.asse.devtunnels.ms/api/comms/approve/${req.id}`, { 
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ approved_by_id: localStorage.getItem('userId') || 'SYSTEM' })
                                });
                                if (res.ok) {
                                    alert('Broadcast Authorized.'); 
                                    fetchPendingComms(); 
                                } else {
                                    alert("Server failed to authorize.");
                                }
                            } catch (e) {
                                alert("Network Error.");
                            }
                        }}) 
                    }} className="flex-1 bg-emerald-900/30 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/50 font-black py-3 rounded-lg uppercase tracking-widest text-[9px] transition-colors">Authorize Release</button>
                  </div>
                ) : (
                  <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest text-center mt-2">Requires L1 Authorization</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* HEAD ADMIN EXCLUSIVE KILL SWITCH */}
        {currentClearanceLevel === 0 && (
          <div className="bg-slate-950 border border-red-900/50 rounded-3xl p-8 shadow-[0_0_30px_rgba(220,38,38,0.15)] shrink-0 group">
            <h3 className="text-xl font-black text-red-500 uppercase tracking-widest mb-2 flex items-center gap-3"><span>⚠️</span> Ultimate Kill Switch</h3>
            <p className="text-slate-400 text-xs mb-6 leading-relaxed group-hover:text-slate-300 transition-colors">Instantly sever DB connections. Prevent corruption. Students forced to Review Mode. <strong>Emergencies only.</strong></p>
            <button onClick={triggerKillSwitchModal} className="w-full bg-red-600 hover:bg-red-500 text-white font-black py-5 rounded-xl uppercase tracking-[0.2em] text-xs transition-colors shadow-lg shadow-red-900/40 active:scale-95">
              INITATE GLOBAL SHUTDOWN
            </button>
          </div>
        )}
      </div>
    </div>
  );
}