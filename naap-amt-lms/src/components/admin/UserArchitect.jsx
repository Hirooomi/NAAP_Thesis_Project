import { useState } from 'react';
import { API_BASE_URL } from "../../apiConfig"; 
import AccountCreator from './AccountCreator';
import RosterManager from './RosterManager';
// THE FIX: Import the new master synchronization hook
import useLiveSync from "../shared/useLiveSync";

export default function UserArchitect({ pendingApprovals, handleApproveAccount, setPendingApprovals, triggerModal }) {
  const currentClearanceLevel = parseInt(sessionStorage.getItem('adminClearance') || '0', 10); 
  const [architectTab, setArchitectTab] = useState('CREATE'); 

  // AI REJECTION PROTOCOL STATE
  const [rejectionModalOpen, setRejectionModalOpen] = useState(false);
  const [targetRequest, setTargetRequest] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectionDraft, setRejectionDraft] = useState('');
  const [isDraftingRejection, setIsDraftingRejection] = useState(false);
  const [isSendingRejection, setIsSendingRejection] = useState(false);

  // THE FIX: Replace bloated manual fetch/websocket/loading states with a single line
  const { data: rosterData, isLoading, mutate: refreshRosters } = useLiveSync(
    'api/users/roster', 
    ['ROSTER_UPDATE', 'USER_REGISTERED', 'USER_DELETED'], 
    { admins: [], profs: [], students: [] }
  );

  const activeAdmins = Array.isArray(rosterData?.admins) ? rosterData.admins : [];
  const activeProfs = Array.isArray(rosterData?.profs) ? rosterData.profs : [];
  const activeStudents = Array.isArray(rosterData?.students) ? rosterData.students : [];

  const openRejectionModal = (request) => {
      setTargetRequest(request);
      setRejectionReason('');
      setRejectionDraft('');
      setRejectionModalOpen(true);
  };

  const handleDraftRejection = async () => {
      setIsDraftingRejection(true);
      try {
          const token = sessionStorage.getItem('token');
          const res = await fetch(`${API_BASE_URL}api/users/draft-rejection`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({ student_name: targetRequest.name, reason: rejectionReason })
          });
          const data = await res.json();
          if(res.ok) setRejectionDraft(data.draft);
          else alert("Failed to connect to AI Engine.");
      } catch(e) { alert("Network error."); } 
      finally { setIsDraftingRejection(false); }
  };

  const handleFinalizeRejection = async () => {
      setIsSendingRejection(true);
      try {
          const token = sessionStorage.getItem('token');
          const res = await fetch(`${API_BASE_URL}api/users/finalize-rejection/${targetRequest.id}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({ student_email: targetRequest.email, email_body: rejectionDraft })
          });
          
          if(res.ok) {
              alert("[SYSTEM] Rejection letter dispatched and database purged.");
              setPendingApprovals(prev => prev.filter(r => r.id !== targetRequest.id));
              setRejectionModalOpen(false);
          } else { alert("Failed to dispatch rejection."); }
      } catch(e) { alert("Network error."); } 
      finally { setIsSendingRejection(false); }
  };

  return (
    <div className="animate-fade-in max-w-[100rem] mx-auto relative">
      
      {/* AI REJECTION PROTOCOL MODAL */}
      {rejectionModalOpen && targetRequest && (
        <div className="fixed inset-0 bg-red-950/90 backdrop-blur-md z-[999] flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-slate-950 border-2 border-red-600 rounded-3xl max-w-2xl w-full p-8 md:p-10 shadow-[0_0_50px_rgba(220,38,38,0.3)] flex flex-col relative">
                <button onClick={() => setRejectionModalOpen(false)} className="absolute top-4 right-6 text-slate-500 hover:text-white font-black text-2xl transition-colors">✕</button>

                <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-widest mb-2 flex items-center gap-3"><span className="text-red-500">🤖</span> AI Rejection Protocol</h2>
                <p className="text-xs text-slate-400 mb-6 font-mono leading-relaxed border-b border-slate-800 pb-4">
                    Target Identity: <strong className="text-white">{targetRequest.name}</strong><br/>
                    Target Email: <strong className="text-amber-500">{targetRequest.email}</strong>
                </p>

                <div className="space-y-6">
                    <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Reason for Rejection</label>
                        <input type="text" value={rejectionReason} onChange={e=>setRejectionReason(e.target.value)} placeholder="e.g. ID not found in official registry" className="w-full bg-slate-900 border border-slate-700 text-white text-sm font-bold p-4 rounded-xl outline-none focus:border-red-500 transition-colors shadow-inner" />
                    </div>

                    <button onClick={handleDraftRejection} disabled={isDraftingRejection || !rejectionReason.trim()} className="w-full bg-red-900/20 hover:bg-red-900/50 text-red-400 border border-red-500/50 font-black py-4 rounded-xl uppercase tracking-widest text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                        {isDraftingRejection ? 'Synthesizing Draft...' : 'Draft Formal Rejection Letter'}
                    </button>

                    {rejectionDraft && (
                        <div className="animate-fade-in space-y-4 pt-6 border-t border-slate-800">
                            <div>
                                <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-2 block">Review & Edit AI Draft</label>
                                <textarea value={rejectionDraft} onChange={e=>setRejectionDraft(e.target.value)} rows="8" className="w-full bg-slate-900 border border-blue-900/50 text-white text-sm p-4 rounded-xl outline-none focus:border-red-500 custom-scrollbar resize-none shadow-inner"></textarea>
                            </div>
                            <button onClick={handleFinalizeRejection} disabled={isSendingRejection || !rejectionDraft.trim()} className="w-full bg-red-600 hover:bg-red-500 text-white font-black py-5 rounded-xl uppercase tracking-[0.2em] text-xs transition-colors shadow-lg shadow-red-900/20 active:scale-95">
                                {isSendingRejection ? 'Processing...' : 'Confirm Rejection & Dispatch Email'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
      )}

      {/* TOP NAVIGATION */}
      <div className="flex overflow-x-auto bg-slate-950 rounded-xl border border-slate-800 p-2 mb-8 w-full md:w-max custom-scrollbar snap-x">
        {['CREATE', 'ROSTER_ADMIN', 'ROSTER_PROF', 'ROSTER_STUDENT'].map(tab => (
          (tab === 'ROSTER_ADMIN' && currentClearanceLevel === 3) ? null : (
            <button key={tab} onClick={() => setArchitectTab(tab)} className={`shrink-0 text-[10px] font-black px-6 py-3 rounded-lg uppercase tracking-widest transition-colors snap-center ${architectTab === tab ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>{tab.replace('_', ' ')}</button>
          )
        ))}
      </div>

      {architectTab === 'CREATE' ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          <AccountCreator 
             currentClearanceLevel={currentClearanceLevel} 
             triggerModal={triggerModal} 
             fetchRosters={refreshRosters} 
             activeStudents={activeStudents}
             activeAdmins={activeAdmins}
          />

          <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl flex flex-col h-full min-h-[500px]">
            <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4 shrink-0">
              <h3 className="text-lg font-black text-white uppercase tracking-widest">Maker-Checker Queue</h3>
              <span className="text-[10px] font-black text-red-500 uppercase tracking-widest bg-red-900/20 px-3 py-1 rounded border border-red-900/50">{pendingApprovals.length} Pending</span>
            </div>
            
            <div className="flex-grow space-y-4 overflow-y-auto custom-scrollbar pr-2">
              {pendingApprovals.map(req => (
                <div key={req.id} className="bg-slate-900 border border-slate-700 p-5 rounded-2xl relative">
                  <button onClick={() => openRejectionModal(req)} className="absolute top-4 right-5 text-slate-500 hover:text-red-500 font-bold transition-colors">✕</button>
                  <div className="flex justify-between items-start mb-4">
                    <div className="pr-6">
                      <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest block mb-1 border border-amber-900/50 bg-amber-900/20 px-2 py-0.5 w-max rounded">{req.type}</span>
                      <span className="text-sm font-bold text-white block">{req.name} <span className="text-slate-500 text-xs">({req.spec})</span></span>
                    </div>
                    <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest mt-1 hidden md:block">Req By: {req.requestedBy}</span>
                  </div>
                  
                  {currentClearanceLevel <= 1 || (currentClearanceLevel === 2 && req.type !== 'NEW_SUB_ADMIN') ? (
                    <div className="flex gap-2">
                      <button onClick={() => handleApproveAccount(req.id, req.name)} className="flex-[2] bg-emerald-900/30 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/50 font-black py-2 rounded-lg uppercase tracking-widest text-[9px] transition-colors">Verify & Activate</button>
                      <button onClick={() => openRejectionModal(req)} className="flex-1 bg-red-900/10 hover:bg-red-900/50 text-red-500 border border-red-900/50 hover:border-red-500/50 font-black py-2 rounded-lg uppercase tracking-widest text-[9px] transition-colors">AI Reject Protocol</button>
                    </div>
                  ) : (
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest text-center">Requires L1 Authorization</p>
                  )}
                </div>
              ))}
              {pendingApprovals.length === 0 && (
                <div className="text-center py-10 opacity-50">
                   <span className="text-3xl block mb-2">📋</span>
                   <p className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">Queue is empty.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <RosterManager 
            architectTab={architectTab} 
            activeAdmins={activeAdmins} 
            activeProfs={activeProfs} 
            activeStudents={activeStudents} 
            isLoading={isLoading} 
            currentClearanceLevel={currentClearanceLevel}
            triggerModal={triggerModal}
            fetchRosters={refreshRosters}
        />
      )}
    </div>
  );
}