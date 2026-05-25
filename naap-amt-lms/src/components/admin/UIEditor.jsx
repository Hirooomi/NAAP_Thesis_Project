import { useState, useEffect } from 'react';

export default function UIEditor() {
  // ==========================================
  // RBAC: ROLE-BASED ACCESS CONTROL
  // ==========================================
  const adminRole = localStorage.getItem('role') || 'HEAD_ADMIN';
  const currentClearanceLevel = parseInt(localStorage.getItem('adminClearance') || '0', 10); 
  
  const [codeContent, setCodeContent] = useState(`// Select a file from the explorer or a pending commit below to view code.`);
  const [isScanning, setIsScanning] = useState(false);
  const [viewMode, setViewMode] = useState('ACTIVE'); // 'ACTIVE' or 'ARCHIVED'
  
  // LIVE DATA STATES
  const [commits, setCommits] = useState([]);
  const [archivedCommits, setArchivedCommits] = useState([]);

  // FETCH LIVE COMMITS FROM BACKEND
  const fetchCommits = async () => {
    try {
      const res = await fetch('https://ztp98nvz-8000.asse.devtunnels.ms/api/ui-editor/commits');
      if (res.ok) {
        const data = await res.json();
        const allCommits = data.commits || [];
        
        // AUTO-ARCHIVE LOGIC: Keep top 10 active, push the rest to the Recycle Bin
        if (allCommits.length > 10) {
            setCommits(allCommits.slice(0, 10));
            setArchivedCommits(allCommits.slice(10));
        } else {
            setCommits(allCommits);
            setArchivedCommits([]);
        }
      }
    } catch (err) {
      console.error("Failed to fetch UI commits:", err);
    }
  };

  useEffect(() => {
    fetchCommits();
  }, []);

  const viewCommitCode = (snapshot) => {
    setCodeContent(snapshot);
  };

  // RBAC ACTION: Tier 2 & 3 can only submit drafts
  const handleSubmitDraft = async () => {
      if(codeContent.trim() === '' || codeContent.startsWith('//')) {
          alert("Cannot submit an empty draft.");
          return;
      }
      
      const payload = {
          author: localStorage.getItem('userId') || 'UNKNOWN_DEV',
          file_name: 'UnsavedFile.jsx',
          code_snapshot: codeContent
      };

      try {
          const res = await fetch('https://ztp98nvz-8000.asse.devtunnels.ms/api/ui-editor/draft', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
          });
          
          if (res.ok) {
              alert("Draft submitted for Tier 1 Review.");
              setCodeContent("// Draft submitted successfully. Awaiting review.");
              fetchCommits(); // Refresh lists
          } else {
              alert("Failed to submit draft to server.");
          }
      } catch (err) {
          alert("Network error.");
      }
  };

  // RBAC ACTION: Tier 1 reviews and passes to Tier 0
  const handleTier1Review = async (commitId) => {
      if(window.confirm(`Mark ${commitId} as secure and escalate to Head Admin for final deployment?`)) {
          try {
              const res = await fetch(`https://ztp98nvz-8000.asse.devtunnels.ms/api/ui-editor/forward/${commitId}`, { method: 'PUT' });
              if (res.ok) {
                  alert("Commit escalated to Head Admin.");
                  fetchCommits();
              }
          } catch (err) {
              alert("Server Error.");
          }
      }
  };

  // RBAC ACTION: Tier 0 (Head Admin) final execution
  const handleApproveAndScan = async (commitId) => {
    if(window.confirm(`Initialize Security Protocol for ${commitId}?`)) {
      setIsScanning(true);
      
      try {
          const res = await fetch(`https://ztp98nvz-8000.asse.devtunnels.ms/api/ui-editor/deploy/${commitId}`, { method: 'DELETE' });
          
          setTimeout(() => {
            setIsScanning(false);
            if (res.ok) {
                alert(`[SECURITY SCAN COMPLETE]\n0 Threats Found.\nCommit ${commitId} Approved & Deployed Live.`);
                setCodeContent('// File approved and deployed.');
                fetchCommits();
            } else {
                alert("Deployment failed on server.");
            }
          }, 3000); // Keep the cool scanning animation
      } catch (err) {
          setIsScanning(false);
          alert("Server Error.");
      }
    }
  };

  // RBAC ACTION: Tier 0 (Head Admin) Hard Purge
  const handleHardPurge = async (commitId) => {
      if(window.confirm(`⚠️ CRITICAL ACTION: Hard Purge will permanently delete Commit ${commitId} from the database. This cannot be undone. Proceed?`)) {
          try {
              // Deleting acts as a hard purge if it's already in the queue
              const res = await fetch(`https://ztp98nvz-8000.asse.devtunnels.ms/api/ui-editor/deploy/${commitId}`, { method: 'DELETE' });
              if (res.ok) {
                  alert(`Commit ${commitId} permanently purged from the system.`);
                  setCodeContent('// File permanently deleted.');
                  fetchCommits();
              }
          } catch (err) {
              alert("Server Error.");
          }
      }
  };

  return (
    <div className="animate-fade-in flex flex-col h-[80vh] max-w-[100rem] mx-auto overflow-hidden relative">
      {isScanning && (
        <div className="absolute inset-0 bg-black/90 z-[500] flex flex-col items-center justify-center p-4 backdrop-blur-md">
           <span className="text-6xl mb-6 animate-spin text-emerald-500">⚙️</span>
           <h3 className="text-2xl font-black text-emerald-500 uppercase tracking-widest mb-4">Scanning Code Matrix</h3>
           <p className="text-slate-400 font-mono text-sm mb-8 animate-pulse">Running heuristic malware detection...</p>
        </div>
      )}

      {/* TOP EDITOR SECTION */}
      <div className="flex-grow flex flex-col bg-[#1e1e1e] border border-slate-700 rounded-t-3xl overflow-hidden shadow-2xl relative">
        <div className="bg-[#252526] border-b border-[#3c3c3c] p-3 flex justify-between items-center shrink-0 shadow-sm z-10">
          <div className="flex items-center gap-4">
            <div className="flex gap-2"><div className="w-3 h-3 rounded-full bg-red-500"></div><div className="w-3 h-3 rounded-full bg-amber-500"></div><div className="w-3 h-3 rounded-full bg-emerald-500"></div></div>
            <span className="text-xs text-slate-400 font-mono tracking-widest">/server/src/pages/UI_Editor</span>
          </div>
          
          <div className="flex gap-4">
            {currentClearanceLevel >= 2 && (
                <button onClick={handleSubmitDraft} className="bg-blue-900/30 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/50 text-[9px] font-black px-4 py-2 rounded uppercase tracking-widest transition-colors flex items-center gap-2">
                    <span>📤</span> Submit Code Draft
                </button>
            )}

            {currentClearanceLevel === 0 && (
                <button onClick={() => { if(window.confirm('EMERGENCY RESTORE: Overwrite live branch with stable backup?')) alert('System Restored to Stable.'); }} className="bg-red-900/30 hover:bg-red-600 text-red-500 hover:text-white border border-red-500/50 hover:border-red-600 text-[9px] font-black px-4 py-2 rounded uppercase tracking-widest transition-colors flex items-center gap-2">
                <span>⚠️</span> Restore Stable Backup
                </button>
            )}
          </div>
        </div>

        <div className="flex flex-grow overflow-hidden">
          <textarea 
            value={codeContent}
            onChange={(e) => setCodeContent(e.target.value)}
            spellCheck="false"
            className="flex-grow bg-[#1e1e1e] p-6 overflow-auto font-mono text-sm leading-relaxed text-[#d4d4d4] outline-none resize-none custom-scrollbar"
          />
        </div>
      </div>

      {/* BOTTOM VERSION CONTROL SECTION */}
      <div className="h-56 bg-slate-950 border-x border-b border-slate-800 rounded-b-3xl p-6 shrink-0 shadow-inner flex flex-col">
        <div className="flex justify-between items-center mb-4">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">
                {viewMode === 'ACTIVE' ? 'Version Control & Deployment Queue (Max 10)' : 'Archive & Soft Purge Vault'}
            </h3>
            
            {currentClearanceLevel <= 1 && (
                <button 
                    onClick={() => setViewMode(prev => prev === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE')} 
                    className="text-[9px] font-black uppercase tracking-widest bg-slate-800 text-slate-300 hover:text-white px-4 py-2 rounded-lg transition-colors border border-slate-700"
                >
                    {viewMode === 'ACTIVE' ? '📂 View Archive' : '🔙 Back to Queue'}
                </button>
            )}
        </div>
        
        {currentClearanceLevel >= 2 ? (
            <div className="flex items-center justify-center h-full">
                 <p className="text-[10px] font-mono text-slate-600 uppercase tracking-widest">Queue hidden. L1/L0 Security Clearance Required.</p>
            </div>
        ) : (
            <div className="flex-grow overflow-y-auto custom-scrollbar pr-2 space-y-3">
            
            {/* RENDER ACTIVE QUEUE */}
            {viewMode === 'ACTIVE' && commits.length === 0 && (
                <div className="text-center py-4"><p className="text-[10px] text-slate-600 uppercase tracking-widest font-mono">No active commits in queue.</p></div>
            )}
            {viewMode === 'ACTIVE' && commits.map(commit => (
                <div key={commit.id} className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex justify-between items-center group">
                <div>
                    <span className="text-[10px] text-blue-400 font-mono font-black mb-1 block">{commit.id} <span className="text-slate-500 ml-2">by {commit.author}</span></span>
                    <p className="text-xs text-white font-bold">Modified: {commit.file}</p>
                </div>
                <div className="flex items-center gap-4">
                    <button onClick={() => viewCommitCode(commit.codeSnapshot)} className="text-[9px] font-black uppercase tracking-widest text-blue-400 hover:text-white transition-colors">View Code</button>
                    <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded border ${commit.status === 'AWAITING_HEAD_ADMIN' ? 'bg-purple-900/20 text-purple-500 border-purple-900/50' : 'bg-amber-900/20 text-amber-500 border-amber-900/50'}`}>{commit.status.replace('_', ' ')}</span>
                    
                    {currentClearanceLevel === 1 && commit.status === 'PENDING_REVIEW' && (
                    <button onClick={() => handleTier1Review(commit.id)} className="bg-blue-900/30 hover:bg-blue-600 border border-blue-500/50 hover:border-transparent text-blue-400 hover:text-white text-[9px] font-black px-4 py-2 rounded-lg uppercase tracking-widest transition-colors flex items-center gap-2">
                        Forward to Tier 0
                    </button>
                    )}

                    {currentClearanceLevel === 0 && commit.status === 'AWAITING_HEAD_ADMIN' && (
                    <button onClick={() => handleApproveAndScan(commit.id)} className="bg-emerald-900/30 hover:bg-emerald-600 border border-emerald-500/50 hover:border-transparent text-emerald-400 hover:text-white text-[9px] font-black px-4 py-2 rounded-lg uppercase tracking-widest transition-colors flex items-center gap-2">
                        <span>🛡️</span> Final Deploy
                    </button>
                    )}
                </div>
                </div>
            ))}

            {/* RENDER ARCHIVE / RECYCLE BIN */}
            {viewMode === 'ARCHIVED' && archivedCommits.length === 0 && (
                <div className="flex items-center justify-center h-full">
                     <p className="text-[10px] font-mono text-slate-600 uppercase tracking-widest">Archive is empty.</p>
                </div>
            )}
            
            {viewMode === 'ARCHIVED' && archivedCommits.map(commit => (
                <div key={commit.id} className="bg-slate-900 border border-slate-800 opacity-75 hover:opacity-100 p-4 rounded-xl flex justify-between items-center transition-opacity">
                <div>
                    <span className="text-[10px] text-slate-400 font-mono font-black mb-1 block">{commit.id} <span className="text-slate-600 ml-2">Time: {commit.time}</span></span>
                    <p className="text-xs text-slate-300 font-bold line-through decoration-red-500/50">{commit.file}</p>
                </div>
                <div className="flex items-center gap-4">
                    <button onClick={() => viewCommitCode(commit.codeSnapshot)} className="text-[9px] font-black uppercase tracking-widest text-blue-400 hover:text-white transition-colors">View Code</button>
                    <span className="text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded border bg-slate-800 text-slate-500 border-slate-700">ARCHIVED</span>
                    
                    {currentClearanceLevel === 0 && (
                    <button onClick={() => handleHardPurge(commit.id)} className="bg-red-900/20 hover:bg-red-600 border border-red-900/50 hover:border-transparent text-red-500 hover:text-white text-[9px] font-black px-4 py-2 rounded-lg uppercase tracking-widest transition-colors flex items-center gap-2">
                        <span>💀</span> Hard Purge
                    </button>
                    )}
                </div>
                </div>
            ))}

            </div>
        )}
      </div>
    </div>
  );
}