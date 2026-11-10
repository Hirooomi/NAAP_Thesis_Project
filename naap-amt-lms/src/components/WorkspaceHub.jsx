import React, { useState, useEffect } from 'react';

// THE FIX: Import the permanent architecture for the WebSocket connection
import { API_BASE_URL } from "../apiConfig";

export default function WorkspaceHub({ 
  moduleTitle, setModuleTitle, attributionString, userRole,
  
  stagedModuleContent, stagedQuizContent,

  moduleTargetFolder, setModuleTargetFolder, moduleTargetSubFolder, setModuleTargetSubFolder, 
  quizTargetFolder, setQuizTargetFolder, quizTargetSubFolder, setQuizTargetSubFolder, 
  
  isScanning, handleScanTopics, scannedTopics,

  jurisdictionFolders, finalizeUploadFlow, handleOpenStudio, isProcessingPhase3 
}) {
  
  const [adminOverride, setAdminOverride] = useState(false);
  
  // NEW: Real-Time Lock State to prevent simultaneous overwrites
  const [lockedFiles, setLockedFiles] = useState({}); // Example: { "Aerodynamics": "Prof. Smith" }

  useEffect(() => {
    // THE FIX: Listen for Live File Locks across the Professor Network
    const token = localStorage.getItem('token');
    if (!token) return;

    const wsUrl = `${API_BASE_URL}api/ws/connect?token=${token}`.replace('https://', 'wss://').replace('http://', 'ws://');
    const ws = new WebSocket(wsUrl);
    
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.event === "FILE_LOCK_STATUS") {
            setLockedFiles(prev => ({
                ...prev,
                [data.topic]: data.isLocked ? data.profName : null
            }));
        }
    };
    
    return () => ws.close(); // Cleanup socket
  }, []);

  const isModuleLocked = lockedFiles[moduleTargetSubFolder];
  const isQuizLocked = lockedFiles[quizTargetSubFolder];

  return (
    <div className="bg-slate-900 border border-emerald-500/30 rounded-3xl p-6 md:p-10 w-full relative overflow-hidden shadow-2xl flex-grow">
      <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-bl-full blur-3xl pointer-events-none"></div>
      
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-8 border-b border-slate-800 pb-8 relative z-10 gap-6">
        <div className="w-full max-w-3xl">
          <h2 className="text-sm font-black text-emerald-500 uppercase tracking-[0.3em] mb-4">Post-Processing Complete</h2>
          <input type="text" value={moduleTitle} onChange={(e) => setModuleTitle(e.target.value)} className="text-3xl md:text-5xl font-black text-white uppercase tracking-[0.1em] bg-transparent border-b-2 border-transparent hover:border-slate-700 focus:border-emerald-500 outline-none w-full transition-colors pb-2 mb-4" />
          <p className="text-slate-500 font-mono text-[10px] uppercase tracking-widest">{attributionString}</p>
        </div>

        <div className="flex flex-col gap-3 w-full xl:w-auto items-end">
          {(!stagedModuleContent && !stagedQuizContent) && (
              <p className="text-slate-500 text-xs font-black tracking-widest uppercase">Enter a Studio Below to Begin</p>
          )}

          <div className="flex gap-2 w-full justify-end">
             {stagedModuleContent && !stagedQuizContent && (
                 <button onClick={() => finalizeUploadFlow('MODULE_ACTIVE')} disabled={isProcessingPhase3} className="bg-white hover:bg-slate-200 text-slate-900 font-black px-6 py-3 rounded-xl uppercase tracking-[0.2em] shadow-xl text-xs transition-transform hover:scale-105 disabled:opacity-50">🚀 Upload Module</button>
             )}
             {stagedQuizContent && !stagedModuleContent && (
                 <button onClick={() => finalizeUploadFlow('QUIZ_ACTIVE')} disabled={isProcessingPhase3} className="bg-white hover:bg-slate-200 text-slate-900 font-black px-6 py-3 rounded-xl uppercase tracking-[0.2em] shadow-xl text-xs transition-transform hover:scale-105 disabled:opacity-50">🚀 Upload Quiz</button>
             )}
             {stagedModuleContent && stagedQuizContent && (
                 <button onClick={() => finalizeUploadFlow('BOTH_ACTIVE')} disabled={isProcessingPhase3} className="bg-emerald-500 hover:bg-emerald-400 text-white font-black px-6 py-3 rounded-xl uppercase tracking-[0.2em] shadow-[0_0_20px_rgba(16,185,129,0.4)] text-xs transition-transform hover:scale-105 disabled:opacity-50">🚀 Upload Both to DB</button>
             )}
          </div>

          <div className="flex gap-2 w-full justify-end mt-2">
             {stagedModuleContent && (
                 <button onClick={() => finalizeUploadFlow('MODULE_DRAFT')} disabled={isProcessingPhase3} className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-black px-4 py-2 rounded uppercase tracking-widest border border-slate-700 text-[10px] transition-colors disabled:opacity-50">💾 Draft Module</button>
             )}
             {stagedQuizContent && (
                 <button onClick={() => finalizeUploadFlow('QUIZ_DRAFT')} disabled={isProcessingPhase3} className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-black px-4 py-2 rounded uppercase tracking-widest border border-slate-700 text-[10px] transition-colors disabled:opacity-50">💾 Draft Quiz</button>
             )}
          </div>
        </div>
      </div>

      <div className="mb-8 bg-slate-950 p-6 rounded-2xl border border-slate-800 relative z-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="max-w-xl">
            <h3 className="text-sm font-black text-white uppercase tracking-widest mb-1">AI Syllabus Scanner</h3>
            <p className="text-xs text-slate-500">The AI must verify which authorized syllabus topics exist in this document before you can enter the Studios.</p>
          </div>
          <button 
            onClick={handleScanTopics}
            disabled={isScanning || isProcessingPhase3}
            className="bg-blue-600 hover:bg-blue-500 text-white font-black px-8 py-4 rounded-xl uppercase tracking-widest text-xs shadow-lg shadow-blue-900/30 transition-all disabled:opacity-50 shrink-0"
          >
            {isScanning ? 'SCANNING PDF...' : '🔍 Scan Document'}
          </button>
        </div>

        {userRole === 'HEAD_ADMIN' && (
          <div className="mt-6 pt-4 border-t border-slate-800 flex items-center gap-3">
             <input type="checkbox" id="godmode" checked={adminOverride} onChange={e => setAdminOverride(e.target.checked)} className="w-4 h-4 accent-amber-500 cursor-pointer" />
             <label htmlFor="godmode" className="text-[10px] text-amber-500 font-black uppercase tracking-widest cursor-pointer">
                🔓 TIER 0 OVERRIDE: Unlock Manual Folder Assignment
             </label>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 relative z-10">
        
        {/* MODULE STUDIO CARD */}
        <div className={`bg-slate-950 border rounded-3xl p-8 shadow-xl flex flex-col min-h-[300px] relative transition-colors ${isModuleLocked ? 'border-red-500/50' : 'border-slate-800'}`}>
          {stagedModuleContent && <div className="absolute top-4 right-4 bg-emerald-900/40 text-emerald-400 border border-emerald-500/50 px-3 py-1 rounded text-[9px] font-black uppercase tracking-widest">✓ Saved to Hub</div>}
          <span className="text-6xl mb-6">{isProcessingPhase3 ? '⏳' : '📄'}</span>
          <h3 className="text-2xl font-black text-white uppercase tracking-widest mb-2">Module Studio</h3>
          
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 mb-6 flex flex-col gap-3 mt-4 relative">
            
            {/* NEW: Lock Indicator */}
            {isModuleLocked && (
               <div className="absolute -top-3 right-4 bg-red-900/90 text-red-400 font-bold text-[9px] px-3 py-1 rounded border border-red-500 uppercase tracking-widest animate-pulse z-20">
                  ⚠️ Locked by {isModuleLocked}
               </div>
            )}

            <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Target Syllabus Assignment</span>
            
            {adminOverride ? (
              <div className="flex flex-col sm:flex-row gap-2">
                <select value={moduleTargetFolder} onChange={(e) => setModuleTargetFolder(e.target.value)} className="bg-slate-950 border border-slate-700 text-emerald-400 text-xs font-bold px-3 py-2 rounded-lg outline-none cursor-pointer w-full sm:w-1/2">
                  {Object.keys(jurisdictionFolders).map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                <select value={moduleTargetSubFolder} onChange={(e) => setModuleTargetSubFolder(e.target.value)} className="bg-slate-950 border border-slate-700 text-emerald-400 text-xs font-bold px-3 py-2 rounded-lg outline-none cursor-pointer w-full sm:w-1/2">
                  {jurisdictionFolders[moduleTargetFolder] && jurisdictionFolders[moduleTargetFolder].map(sf => <option key={sf} value={sf}>{sf}</option>)}
                </select>
              </div>
            ) : (
              <select value={moduleTargetSubFolder} onChange={(e) => setModuleTargetSubFolder(e.target.value)} className="bg-slate-950 border border-slate-700 text-emerald-400 text-xs font-bold px-3 py-3 rounded-lg outline-none cursor-pointer w-full" disabled={scannedTopics.length === 0}>
                {scannedTopics.length > 0 
                  ? scannedTopics.map(topic => <option key={topic} value={topic}>{topic}</option>)
                  : <option>Awaiting AI Scan...</option>
                }
              </select>
            )}
          </div>

          <div className="mt-auto pt-4 border-t border-slate-800">
             <button 
               onClick={() => handleOpenStudio('MODULE')} 
               // NEW: Button disabled if another prof has locked this file
               disabled={isProcessingPhase3 || (!adminOverride && scannedTopics.length === 0) || isModuleLocked} 
               className="w-full bg-emerald-900/20 hover:bg-emerald-900/40 border border-emerald-500/30 text-emerald-400 font-black py-3 rounded-xl text-sm tracking-widest uppercase transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
             >
               {isModuleLocked ? 'Studio Locked' : 'Launch Module Studio →'}
             </button>
          </div>
        </div>

        {/* ASSESSMENT STUDIO CARD */}
        <div className={`bg-slate-950 border rounded-3xl p-8 shadow-xl flex flex-col min-h-[300px] relative transition-colors ${isQuizLocked ? 'border-red-500/50' : 'border-slate-800'}`}>
          {stagedQuizContent && <div className="absolute top-4 right-4 bg-emerald-900/40 text-emerald-400 border border-emerald-500/50 px-3 py-1 rounded text-[9px] font-black uppercase tracking-widest">✓ Saved to Hub</div>}
          <span className="text-6xl mb-6">{isProcessingPhase3 ? '⏳' : '🧠'}</span>
          <h3 className="text-2xl font-black text-white uppercase tracking-widest mb-2">Assessment Studio</h3>
          
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 mb-6 flex flex-col gap-3 mt-4 relative">
            
            {/* NEW: Lock Indicator */}
            {isQuizLocked && (
               <div className="absolute -top-3 right-4 bg-red-900/90 text-red-400 font-bold text-[9px] px-3 py-1 rounded border border-red-500 uppercase tracking-widest animate-pulse z-20">
                  ⚠️ Locked by {isQuizLocked}
               </div>
            )}

            <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest">Quiz Target Syllabus</span>
            
            {adminOverride ? (
              <div className="flex flex-col sm:flex-row gap-2">
                <select value={quizTargetFolder} onChange={(e) => setQuizTargetFolder(e.target.value)} className="bg-slate-950 border border-slate-700 text-blue-400 text-xs font-bold px-3 py-2 rounded-lg outline-none cursor-pointer w-full sm:w-1/2">
                  {Object.keys(jurisdictionFolders).map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                <select value={quizTargetSubFolder} onChange={(e) => setQuizTargetSubFolder(e.target.value)} className="bg-slate-950 border border-slate-700 text-blue-400 text-xs font-bold px-3 py-2 rounded-lg outline-none cursor-pointer w-full sm:w-1/2">
                  {jurisdictionFolders[quizTargetFolder] && jurisdictionFolders[quizTargetFolder].map(sf => <option key={sf} value={sf}>{sf}</option>)}
                </select>
              </div>
            ) : (
              <select value={quizTargetSubFolder} onChange={(e) => setQuizTargetSubFolder(e.target.value)} className="bg-slate-950 border border-slate-700 text-blue-400 text-xs font-bold px-3 py-3 rounded-lg outline-none cursor-pointer w-full" disabled={scannedTopics.length === 0}>
                {scannedTopics.length > 0 
                  ? scannedTopics.map(topic => <option key={topic} value={topic}>{topic}</option>)
                  : <option>Awaiting AI Scan...</option>
                }
              </select>
            )}
          </div>

          <div className="mt-auto pt-4 border-t border-slate-800">
             <button 
               onClick={() => handleOpenStudio('QUIZ')} 
               // NEW: Button disabled if another prof has locked this file
               disabled={isProcessingPhase3 || (!adminOverride && scannedTopics.length === 0) || isQuizLocked} 
               className="w-full bg-blue-900/20 hover:bg-blue-900/40 border border-blue-500/30 text-blue-400 font-black py-3 rounded-xl text-sm tracking-widest uppercase transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
             >
               {isQuizLocked ? 'Studio Locked' : 'Launch Assessment Studio →'}
             </button>
          </div>
        </div>
      </div>
    </div>
  );
}