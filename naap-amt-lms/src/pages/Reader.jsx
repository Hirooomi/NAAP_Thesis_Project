import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function Reader() {
  const navigate = useNavigate();
  const location = useLocation();
  
  const { itemName = 'Unknown Module', highlightRef = null } = location.state || {};
  const [showHighlight, setShowHighlight] = useState(!!highlightRef);
  
  // LIVE DATABASE CONTENT
  const [textContent, setTextContent] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDocumentContent = async () => {
       try {
           const res = await fetch(`https://ztp98nvz-8000.asse.devtunnels.ms/api/vault/module-by-title/${encodeURIComponent(itemName)}`);
           if (res.ok) {
               const data = await res.json();
               setTextContent(data.content);
           } else {
               setError("Failed to fetch document. It may have been purged or archived by the Admin.");
           }
       } catch (err) {
           setError("Database connection error.");
       } finally {
           setIsLoading(false);
       }
    };
    fetchDocumentContent();
  }, [itemName]);

  // 10-Second Temporal Highlight Logic
  useEffect(() => {
    let timer;
    if (showHighlight) {
      timer = setTimeout(() => setShowHighlight(false), 10000);
    }
    return () => clearTimeout(timer);
  }, [showHighlight]);

  // --- THE FIX: RAG TEXT HIGHLIGHTER ENGINE ---
  const renderHighlightedText = () => {
      if (!showHighlight || !highlightRef || !textContent) return textContent;
      
      const parts = textContent.split(highlightRef);
      if (parts.length === 1) return textContent; // Failsafe if exact string match isn't found
      
      return (
          <>
              {parts[0]}
              <mark className="bg-amber-500/40 text-white animate-pulse px-1 rounded shadow-[0_0_15px_rgba(245,158,11,0.5)]">
                  {highlightRef}
              </mark>
              {parts.slice(1).join(highlightRef)}
          </>
      );
  };

  return (
    <div className="p-4 md:p-8 h-full flex flex-col max-w-5xl mx-auto w-full">
      <header className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-4 bg-slate-800 p-4 rounded border border-slate-700 shadow-md pt-4 md:pt-4">
        <div>
          <span className="text-xs text-blue-400 font-mono uppercase tracking-widest block mb-1">Module Reader Active</span>
          <h1 className="text-xl font-bold text-white uppercase">{itemName}</h1>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <button onClick={() => navigate('/modules')} className="w-full md:w-auto bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold py-3 md:py-2 px-4 rounded uppercase flex items-center justify-center gap-2">← Back to Explorer</button>
        </div>
      </header>
      
      <div className="flex-grow bg-slate-950 rounded border border-slate-800 p-4 md:p-8 shadow-inner overflow-y-auto relative custom-scrollbar">
         {showHighlight && highlightRef && (
           <div className="absolute top-4 md:top-8 left-4 right-4 md:left-8 md:right-8 bg-amber-500/10 border-l-4 border-amber-500 p-4 md:p-6 rounded shadow-2xl z-40 animate-[pulse_2s_ease-in-out_infinite] backdrop-blur-sm">
              <div className="flex flex-col md:flex-row justify-between md:items-start gap-4">
                <div>
                  <p className="text-amber-400 font-bold uppercase tracking-widest text-xs md:text-sm mb-1">Target Reference Acquired</p>
                  <p className="text-white font-serif text-base md:text-lg">{highlightRef}</p>
                </div>
                <span className="bg-amber-500 text-slate-900 font-bold font-mono px-2 py-1 text-[10px] md:text-xs rounded shrink-0">10s Timer Active</span>
              </div>
           </div>
         )}

         <div className={`max-w-3xl mx-auto transition-all duration-500 ${showHighlight ? 'mt-32 md:mt-28 opacity-30' : 'mt-0 opacity-100'}`}>
            <h2 className="text-2xl md:text-3xl font-bold text-white border-b border-slate-800 pb-4 mb-6 uppercase">{itemName} - Theoretical Guide</h2>
            
            {isLoading ? (
               <div className="h-64 flex items-center justify-center">
                  <span className="text-blue-500 font-mono uppercase tracking-widest animate-pulse">Decrypting File Assets...</span>
               </div>
            ) : error ? (
               <div className="h-64 flex items-center justify-center">
                  <span className="text-red-500 font-bold uppercase tracking-widest border border-red-500/50 bg-red-900/20 p-4 rounded">{error}</span>
               </div>
            ) : (
               <div className="prose prose-invert prose-slate max-w-none font-serif leading-relaxed text-slate-300 whitespace-pre-wrap">
                  {/* FIX: Now securely renders the text with the embedded yellow highlighting */}
                  {renderHighlightedText()}
               </div>
            )}
         </div>
      </div>
    </div>
  );
}