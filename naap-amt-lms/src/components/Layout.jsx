import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';

export default function Layout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  const [activeAlert, setActiveAlert] = useState(null);
  
  const navigate = useNavigate();
  const location = useLocation();

  // THE FIX: Prof layout recognition so the Student Sidebar hides properly
  const role = localStorage.getItem('role') || 'STUDENT';
  const isProfileRoute = location.pathname === '/profile';
  
  // A route is a Prof Route if it has /prof, /reader, OR if a Prof is visiting their /profile.
  const isProfRoute = location.pathname.includes('/prof') || location.pathname.includes('/reader') || (isProfileRoute && (role === 'FACULTY' || role === 'HEAD_ADMIN'));
  
  const hasActiveQuiz = !!localStorage.getItem('activeQuizSession');
  const isQuizRoute = location.pathname === '/quiz';
  const isLockedDown = !isProfRoute && (isQuizRoute || hasActiveQuiz);
  
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (isQuizRoute) return;

    const fetchGlobalAlerts = async () => {
      try {
        const response = await fetch('https://ztp98nvz-8000.asse.devtunnels.ms/api/comms/announcements');
        if (response.ok) {
          const data = await response.json();
          const urgentAlerts = data.announcements.filter(a => 
            a.severity === 'URGENT' || a.severity === 'CRITICAL'
          );

          if (urgentAlerts.length > 0) {
            const latestAlert = urgentAlerts.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
            const dismissedAlerts = JSON.parse(localStorage.getItem('dismissedAlerts')) || [];
            if (!dismissedAlerts.includes(latestAlert.id)) {
              setActiveAlert(latestAlert);
            }
          }
        }
      } catch (err) {
        console.error("Global Comms Listener Offline.");
      }
    };

    fetchGlobalAlerts();
    const commsInterval = setInterval(fetchGlobalAlerts, 30000);
    return () => clearInterval(commsInterval);
  }, [isQuizRoute]);

  const dismissAlert = () => {
    if (activeAlert) {
      const dismissedAlerts = JSON.parse(localStorage.getItem('dismissedAlerts')) || [];
      dismissedAlerts.push(activeAlert.id);
      localStorage.setItem('dismissedAlerts', JSON.stringify(dismissedAlerts));
      setActiveAlert(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('studentId');
    localStorage.removeItem('userId');
    localStorage.removeItem('role');
    localStorage.removeItem('token');
    navigate('/login');
  };

  const renderLogo = () => (
    <div className="w-10 h-10 bg-slate-800 border border-slate-600 rounded flex items-center justify-center mr-3 shadow-inner shrink-0 transition-colors group-hover:border-blue-500">
      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter text-center leading-tight group-hover:text-blue-400">LOGO<br/>HERE</span>
    </div>
  );

  const navLinkClass = (path) => {
    const isActive = location.pathname.includes(path);
    return `w-full text-left px-4 py-3 rounded uppercase text-sm font-bold tracking-wider transition-colors ${
      isActive ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
    }`;
  };

  return (
    <div className="flex h-screen bg-slate-900 text-slate-300 font-sans overflow-hidden relative">
      
      {activeAlert && (
        <div className="fixed inset-0 bg-red-950/90 backdrop-blur-md z-[999] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-950 border-2 border-red-600 rounded-3xl max-w-2xl w-full p-8 md:p-12 shadow-[0_0_50px_rgba(220,38,38,0.3)] flex flex-col items-center text-center">
            <div className="w-20 h-20 bg-red-900/30 rounded-full flex items-center justify-center mb-6 border border-red-500/50">
              <span className="text-4xl text-red-500 animate-pulse">⚠️</span>
            </div>
            
            <h2 className="text-sm font-black text-red-500 uppercase tracking-[0.3em] mb-2">Global System Broadcast</h2>
            <h1 className="text-2xl md:text-3xl font-black text-white uppercase tracking-widest mb-8">{activeAlert.header}</h1>
            
            <div className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-8 text-left max-h-60 overflow-y-auto custom-scrollbar">
              <p className="text-slate-300 font-mono leading-relaxed whitespace-pre-wrap">{activeAlert.message}</p>
            </div>
            
            <div className="flex flex-col items-center gap-3 w-full">
              <button 
                onClick={dismissAlert}
                className="w-full max-w-md bg-red-600 hover:bg-red-500 text-white font-black py-5 rounded-xl uppercase tracking-[0.2em] transition-all shadow-xl active:scale-95"
              >
                Acknowledge & Dismiss
              </button>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">Dispatched by: {activeAlert.author}</p>
            </div>
          </div>
        </div>
      )}

      {/* SIDEBAR - Hides completely if the user is a Prof/Admin OR if they are forced into Profile Lockout */}
      {!isLockedDown && !isProfRoute && (
        <aside className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col hidden md:flex shrink-0">
          <div className="p-6 border-b border-slate-800 flex items-center cursor-pointer group" onClick={() => navigate('/dashboard')}>
            {renderLogo()}
            <div>
              <h1 className="text-xl font-bold text-white tracking-wider group-hover:text-blue-400">NAAP <span className="text-blue-500">AMT</span></h1>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Theoretical Quiz Bank</p>
            </div>
          </div>
          
          <div className="p-4 flex-grow space-y-2 overflow-y-auto custom-scrollbar">
            <p className="text-xs text-slate-600 font-bold uppercase tracking-widest mb-2 pl-2">Navigation</p>
            <button onClick={() => navigate('/dashboard')} className={navLinkClass('dashboard')}>Dashboard</button>
            <button onClick={() => navigate('/modules')} className={navLinkClass('modules')}>Module Library</button>
            <button onClick={() => navigate('/quizzes')} className={navLinkClass('quizzes')}>Theoretical Quiz Bank</button>
            
            <p className="text-xs text-slate-600 font-bold uppercase tracking-widest mt-6 mb-2 pl-2 border-t border-slate-800 pt-4">User Tools</p>
            <button onClick={() => navigate('/analytics')} className={navLinkClass('analytics')}>Score Analytics</button>
            <button onClick={() => navigate('/profile')} className={navLinkClass('profile')}>Profile & Command Center</button>
          </div>

          <div className="p-4 border-t border-slate-800">
            <div className="bg-slate-900 p-3 rounded border border-slate-700 mb-3 text-center">
               <p className="text-xs text-slate-500 uppercase">Active Session</p>
               <p className="text-sm text-emerald-400 font-mono mt-1">{currentTime.toLocaleTimeString()}</p>
            </div>
            <button onClick={handleLogout} className="w-full bg-slate-800 hover:bg-red-900/50 text-slate-400 hover:text-red-400 text-xs font-bold py-2 px-4 rounded border border-slate-700 transition-colors uppercase">Sign Out</button>
          </div>
        </aside>
      )}

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto relative flex flex-col z-0">
        
        <div className="flex bg-slate-950 p-4 border-b border-slate-800 justify-between items-center sticky top-0 z-50">
          <div className="flex items-center gap-3">
            {!isLockedDown && !isProfRoute && (
              <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="md:hidden text-2xl text-slate-300 hover:text-white">☰</button>
            )}
            
            {isProfRoute && !isProfileRoute ? (
              <h1 className="text-sm font-bold text-amber-500 uppercase tracking-[0.2em] animate-pulse">Professor Verification Mode</h1>
            ) : isProfileRoute ? (
              <h1 className="text-sm font-bold text-blue-500 uppercase tracking-[0.2em]">User Command Center</h1>
            ) : (
              <div className="md:hidden flex items-center">
                 <h1 className="text-lg font-bold text-white tracking-wider">NAAP <span className="text-blue-500">AMT</span></h1>
              </div>
            )}
          </div>
          
          {/* Hide back button if they are forced into password lockout */}
          {!isLockedDown && location.pathname !== '/dashboard' && localStorage.getItem('forcePassChange') !== 'true' && (
            <button onClick={() => navigate(-1)} className="bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-bold py-1.5 px-4 rounded border border-slate-700 uppercase tracking-widest transition-all">
              ← Back
            </button>
          )}
        </div>

        <Outlet />
      </main>
    </div>
  );
}