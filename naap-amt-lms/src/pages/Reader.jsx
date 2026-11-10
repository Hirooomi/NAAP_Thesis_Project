import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { API_BASE_URL } from '../apiConfig';

export default function Reader() {
  const navigate = useNavigate();
  const location = useLocation();
  
  const scrollContainerRef = useRef(null);
  
  const { itemName = 'Unknown Module', highlightRef = null } = location.state || {};
  const [showHighlight, setShowHighlight] = useState(!!highlightRef);
  
  // LIVE DATABASE CONTENT
  const [textContent, setTextContent] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    const fetchDocumentContent = async () => {
       try {
           const token = localStorage.getItem('token');
           const res = await fetch(`${API_BASE_URL}api/vault/module-by-title/${encodeURIComponent(itemName)}`, {
               headers: {
                   'Authorization': `Bearer ${token}`
               }
           });
           
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

    const token = localStorage.getItem('token');
    const wsUrl = `${API_BASE_URL}api/ws/connect?token=${token}`.replace('https://', 'wss://').replace('http://', 'ws://');
    const ws = new WebSocket(wsUrl);
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.event === "VAULT_UPDATE") {
            console.log("[WS] Admin modified Vault! Instantly reloading module content...");
            fetchDocumentContent();
        }
    };

    return () => ws.close(); 
  }, [itemName]);

  useEffect(() => {
     if (!isLoading && textContent && scrollContainerRef.current) {
        const savedModule = localStorage.getItem('lastReadModule');
        const savedScroll = localStorage.getItem('lastScrollPosition');
        
        if (savedModule === itemName && savedScroll && !highlightRef) {
            scrollContainerRef.current.scrollTop = Number(savedScroll);
        }
     }
  }, [isLoading, textContent, itemName, highlightRef]);

  const handleScroll = () => {
    if (scrollContainerRef.current) {
       localStorage.setItem('lastReadModule', itemName);
       localStorage.setItem('lastScrollPosition', scrollContainerRef.current.scrollTop.toString());
    }
  };

  useEffect(() => {
    let timer;
    if (showHighlight) {
      timer = setTimeout(() => setShowHighlight(false), 10000);
    }
    return () => clearTimeout(timer);
  }, [showHighlight]);

  // --- THE FIX: Telemetry Logging & Secure Offline Download ---
  const handleDownload = async () => {
    if (!textContent) return;
    setIsDownloading(true);

    try {
      const studentId = sessionStorage.getItem('userId') || 'UNKNOWN';
      const token = localStorage.getItem('token');

      // 1. Fire the read-receipt to the backend
      await fetch(`${API_BASE_URL}api/analytics/log-download`, {
         method: 'POST',
         headers: {
             'Content-Type': 'application/json',
             'Authorization': `Bearer ${token}`
         },
         body: JSON.stringify({
             student_id: studentId,
             module_title: itemName,
             timestamp: new Date().toISOString()
         })
      }).catch(err => console.error("Telemetry failure (silent):", err));

      // 2. Generate the local offline document (.txt for bulletproof mobile/desktop compatibility)
      const blob = new Blob([`${itemName.toUpperCase()}\n\nNAAP Offline Study Material\nDownloaded: ${new Date().toLocaleDateString()}\n\n---\n\n${textContent}`], { type: 'text/plain;charset=utf-8' });
      const href = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = href;
      link.download = `${itemName.replace(/\s+/g, '_')}_Offline_Module.txt`; 
      document.body.appendChild(link);
      link.click();
      
      document.body.removeChild(link);
      URL.revokeObjectURL(href);
      
    } catch (err) {
      alert("Download failed. Please check your connection.");
    } finally {
      setIsDownloading(false);
    }
  };

  const renderHighlightedText = () => {
      if (!showHighlight || !highlightRef || !textContent) return textContent;
      
      const parts = textContent.split(highlightRef);
      if (parts.length === 1) return textContent; 
      
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
    <div className="p-4 md:p-8 h-full flex flex-col max-w-5xl mx-auto w-full animate-fade-in">
      <header className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-4 bg-slate-800 p-4 rounded border border-slate-700 shadow-md pt-4 md:pt-4">
        <div>
          <span className="text-xs text-blue-400 font-mono uppercase tracking-widest block mb-1">Module Reader Active</span>
          <h1 className="text-xl font-bold text-white uppercase">{itemName}</h1>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          {/* NEW EXPORT BUTTON */}
          <button 
             onClick={handleDownload} 
             disabled={isLoading || error || isDownloading}
             className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold py-3 md:py-2 px-6 rounded uppercase tracking-wider flex items-center justify-center gap-2 transition-colors shadow-lg"
          >
             {isDownloading ? '⏳ LOGGING...' : '⬇️ OFFLINE EXPORT'}
          </button>
          
          <button onClick={() => navigate('/modules')} className="w-full sm:w-auto bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold py-3 md:py-2 px-6 rounded uppercase tracking-wider flex items-center justify-center gap-2 transition-colors">
             ← BACK
          </button>
        </div>
      </header>
      
      <div 
         ref={scrollContainerRef}
         onScroll={handleScroll}
         className="flex-grow bg-slate-950 rounded border border-slate-800 p-4 md:p-8 shadow-inner overflow-y-auto relative custom-scrollbar"
      >
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
                  {renderHighlightedText()}
               </div>
            )}
         </div>
      </div>
    </div>
  );
}