import { useState, useEffect, useRef } from 'react';
import { API_BASE_URL } from "../../apiConfig"; 

export default function SystemMailbox() {
  const [isOpen, setIsOpen] = useState(false);
  const [announcements, setAnnouncements] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef(null);

  const fetchAnnouncements = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}api/comms/announcements`);
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'success') {
          setAnnouncements(data.announcements || []);
          
          const lastSeenId = localStorage.getItem('lastSeenAnnouncementId');
          if (data.announcements.length > 0 && data.announcements[0].id !== lastSeenId) {
             setUnreadCount(data.announcements.filter(a => a.id !== lastSeenId).length);
          }
        }
      }
    } catch (error) {
      console.error("Failed to fetch communications.", error);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
    
    // THE FIX: Correct WebSocket Endpoint and Error Boundary
    const token = sessionStorage.getItem('token');
    if (!token) return;

    try {
        const wsUrl = `${API_BASE_URL}api/ws/connect?token=${token}`.replace(/^http/, 'ws');
        const ws = new WebSocket(wsUrl);

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.event === 'SYSTEM_MAIL') {
                    console.log("[WS] Incoming Server Mail detected.");
                    fetchAnnouncements();
                }
            } catch (parseError) {
                // Ignore parse errors silently to prevent UI crash
            }
        };

        ws.onerror = (error) => {
            console.warn("Mailbox WebSocket connection suppressed error to protect UI state.", error);
        };

        return () => ws.close();
    } catch (e) {
        console.error("Failed to mount mailbox socket:", e);
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOpenMailbox = () => {
    setIsOpen(!isOpen);
    if (!isOpen && announcements.length > 0) {
      setUnreadCount(0);
      localStorage.setItem('lastSeenAnnouncementId', announcements[0].id);
    }
  };

  const getSeverityColor = (severity) => {
    switch(severity) {
      case 'CRITICAL': return 'border-red-500/50 bg-red-900/20 text-red-400';
      case 'MODERATE': return 'border-amber-500/50 bg-amber-900/20 text-amber-400';
      default: return 'border-blue-500/50 bg-blue-900/20 text-blue-400';
    }
  };

  return (
    <div className="relative z-50" ref={dropdownRef}>
      <button 
        onClick={handleOpenMailbox}
        className="relative bg-slate-900 border border-slate-800 hover:border-slate-600 w-10 h-10 rounded-xl flex items-center justify-center transition-colors shadow-inner"
      >
        <span className="text-lg">📬</span>
        
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-black text-white shadow-lg animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-slate-950 border border-slate-800 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] overflow-hidden animate-fade-in flex flex-col">
          
          <div className="bg-slate-900 border-b border-slate-800 p-4 flex justify-between items-center">
             <h3 className="text-xs font-black text-white uppercase tracking-widest">System Comms</h3>
             <span className="text-[9px] text-slate-500 font-mono">Top 10 Recent</span>
          </div>

          <div className="max-h-96 overflow-y-auto custom-scrollbar p-2 flex flex-col gap-2">
            {announcements.length === 0 ? (
              <div className="p-6 text-center text-slate-600">
                <span className="text-3xl mb-2 block opacity-50">📭</span>
                <p className="text-[10px] font-black uppercase tracking-widest">Inbox Empty</p>
              </div>
            ) : (
              announcements.map((ann) => (
                <div key={ann.id} className={`p-4 rounded-xl border ${getSeverityColor(ann.severity)} transition-all hover:bg-opacity-40`}>
                  <div className="flex justify-between items-start mb-2 gap-2">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wide leading-tight">{ann.header}</h4>
                    <span className="text-[8px] font-black uppercase tracking-widest border border-current px-1.5 py-0.5 rounded shrink-0">
                      {ann.severity}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed mb-3 whitespace-pre-wrap">
                    {ann.message}
                  </p>
                  <div className="flex justify-between items-center text-[9px] text-slate-500 font-mono border-t border-slate-800 pt-2">
                    <span>{ann.author}</span>
                    <span>{ann.date}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}