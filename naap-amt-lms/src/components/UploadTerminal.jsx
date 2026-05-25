import React from 'react';

export default function UploadTerminal({ files, setFiles, uploadAsIs, setUploadAsIs, uploadState, startProcessing, logs }) {
  
  // Function to surgically remove a specific file by its index
  const removeFile = (indexToRemove) => {
    setFiles(prevFiles => prevFiles.filter((_, index) => index !== indexToRemove));
  };

  return (
    <div className="flex-grow flex flex-col">
      <div className="mb-8 shrink-0">
        <h1 className="text-4xl font-black text-white tracking-[0.2em] uppercase">RAG <span className="text-emerald-500">Terminal</span></h1>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 flex-grow pb-8">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 flex flex-col shadow-2xl">
          <div 
            onDragOver={(e) => e.preventDefault()} 
            onDrop={(e) => { 
              e.preventDefault(); 
              // Append newly dropped files to the existing array
              setFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)]); 
            }} 
            className={`flex-grow border-2 border-dashed rounded-3xl flex flex-col items-center justify-center p-8 transition-colors ${files.length > 0 ? 'border-emerald-500 bg-emerald-950/20' : 'border-slate-800 bg-slate-950/50 hover:border-blue-500'}`}
          >
            {files.length === 0 ? (
              <>
                <span className="text-6xl mb-6 opacity-30">📑</span>
                <p className="text-lg font-bold text-slate-500 uppercase tracking-widest text-center">Drag & Drop Source PDF(s)</p>
                <label className="mt-8 cursor-pointer bg-slate-800 text-white text-xs font-black px-8 py-4 rounded-xl uppercase tracking-widest transition-colors border border-slate-700 hover:border-blue-500">
                  Browse Files
                  <input type="file" className="hidden" accept=".pdf" multiple onChange={(e) => setFiles(Array.from(e.target.files))} />
                </label>
              </>
            ) : (
              <div className="w-full h-full flex flex-col">
                
                <div className="flex justify-between items-center w-full mb-4">
                  <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">{files.length} Document(s) Loaded</span>
                  <label className="cursor-pointer text-[10px] font-black text-blue-400 hover:text-blue-300 uppercase tracking-widest transition-colors">
                    + Add More
                    <input type="file" className="hidden" accept=".pdf" multiple onChange={(e) => setFiles(prev => [...prev, ...Array.from(e.target.files)])} />
                  </label>
                </div>

                <ul className="text-xs font-mono text-emerald-400 space-y-3 overflow-y-auto max-h-[180px] custom-scrollbar bg-black/30 p-5 rounded-2xl">
                  {files.map((f, i) => (
                    <li key={i} className="flex justify-between items-center group">
                      <span className="truncate pr-4">✓ {f.name}</span>
                      <button 
                        onClick={() => removeFile(i)} 
                        className="text-slate-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all text-sm px-2"
                        title="Remove File"
                      >
                        🗑️
                      </button>
                    </li>
                  ))}
                </ul>
                
                <label className="flex items-center gap-2 cursor-pointer mt-4" title="Preserves original PDF layout. Disables text editor.">
                  <input type="checkbox" checked={uploadAsIs} onChange={(e) => setUploadAsIs(e.target.checked)} className="accent-amber-500" />
                  <span className={`text-[10px] font-black uppercase tracking-widest ${uploadAsIs ? 'text-amber-400' : 'text-slate-500'}`}>Upload As-Is (Lock Formatting)</span>
                </label>
                
                {uploadState === 'IDLE' && (
                  <button onClick={startProcessing} className="mt-auto bg-blue-600 hover:bg-blue-500 text-white font-black py-5 px-8 rounded-2xl uppercase tracking-[0.2em] shadow-xl shadow-blue-900/20 active:scale-95 w-full transition-all">
                    Initiate Pipeline
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="bg-black/40 border border-slate-800 rounded-3xl p-8 flex flex-col shadow-inner">
          <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] mb-6 border-b border-slate-800 pb-4">System Logs</h3>
          <div className="flex-grow font-mono text-xs text-emerald-400 overflow-y-auto space-y-3 custom-scrollbar pr-3">
            {logs.map((log, i) => <p key={i}>{log}</p>)}
            {uploadState === 'PROCESSING' && <p className="animate-pulse text-amber-500">{'>'} Processing matrix...</p>}
          </div>
        </div>
      </div>
    </div>
  );
}