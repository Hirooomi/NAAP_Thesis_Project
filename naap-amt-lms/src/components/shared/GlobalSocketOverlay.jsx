import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from "../../apiConfig"; 

// --- THE SINGLETON ENGINE ---
let globalWs = null;
let reconnectTimeout = null;
let offlineGraceTimer = null;
let heartbeatInterval = null;

export default function GlobalSocketOverlay({ children }) {
  const navigate = useNavigate();
  const [shutdownTimer, setShutdownTimer] = useState(null);
  const [isOffline, setIsOffline] = useState(false);
  
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;

    const connectWebSocket = () => {
      const token = sessionStorage.getItem('token') || localStorage.getItem('token');
      if (!token || token === 'null' || token === 'undefined') return;

      if (globalWs && (globalWs.readyState === WebSocket.OPEN || globalWs.readyState === WebSocket.CONNECTING)) {
        bindSocketEvents(globalWs);
        return;
      }

      const wsUrl = `${API_BASE_URL}api/ws/connect?token=${token}`
          .replace('https://', 'wss://')
          .replace('http://', 'ws://');
          
      globalWs = new WebSocket(wsUrl);
      bindSocketEvents(globalWs);
    };

    const bindSocketEvents = (ws) => {
      ws.onopen = () => {
        if (offlineGraceTimer) clearTimeout(offlineGraceTimer);
        if (isMounted.current) setIsOffline(false);
        if (reconnectTimeout) clearTimeout(reconnectTimeout);
        
        if (heartbeatInterval) clearInterval(heartbeatInterval);
        heartbeatInterval = setInterval(() => {
            if (globalWs && globalWs.readyState === WebSocket.OPEN) {
                globalWs.send(JSON.stringify({ event: 'ping' }));
            }
        }, 25000); 
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.event === 'SYSTEM_SHUTDOWN' && isMounted.current) {
          setShutdownTimer(60); 
        }
        window.dispatchEvent(new CustomEvent('global_ws_event', { detail: data }));
      };

      // THE FIX: Listen for the server's rejection code (1008)
      ws.onclose = (event) => {
        if (heartbeatInterval) clearInterval(heartbeatInterval);
        
        // If the backend rejects the token, kill the loop and auto-logout
        if (event.code === 1008 || event.code === 403) {
            sessionStorage.clear();
            localStorage.removeItem('token');
            window.location.href = '/login';
            return;
        }

        offlineGraceTimer = setTimeout(() => {
            if (isMounted.current) setIsOffline(true);
        }, 3500);
        reconnectTimeout = setTimeout(() => connectWebSocket(), 3000);
      };

      ws.onerror = () => {
          if (globalWs) globalWs.close(); 
      };
    };

    connectWebSocket();

    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (shutdownTimer === null) return;
    if (shutdownTimer <= 0) {
      sessionStorage.clear();
      localStorage.clear();
      window.location.href = '/login'; 
      return;
    }
    const timerId = setInterval(() => setShutdownTimer(prev => prev - 1), 1000);
    return () => clearInterval(timerId);
  }, [shutdownTimer]);

  return (
    <>
      {isOffline && shutdownTimer === null && (
        <div className="fixed top-0 left-0 w-full bg-red-600 text-white text-center text-[10px] md:text-xs font-black py-1.5 z-[9999] uppercase tracking-[0.2em] shadow-lg shadow-red-900/50 animate-pulse">
          ⚠️ Network Connection Lost. Auto-Reconnecting to NAAP Servers...
        </div>
      )}

      {shutdownTimer !== null && (
        <div className="fixed inset-0 bg-red-950/95 z-[9999] flex flex-col items-center justify-center p-4 backdrop-blur-md animate-fade-in">
          <span className="text-7xl mb-6 block animate-pulse">⚠️</span>
          <h1 className="text-4xl md:text-5xl font-black text-white uppercase tracking-widest mb-4 text-center">System Shutdown Initiated</h1>
          <p className="text-red-400 font-mono text-xl md:text-2xl mb-8 text-center text-balance max-w-2xl">Global server maintenance overriding all active sessions. Please save your work immediately.</p>
          <div className="bg-slate-950 border-2 border-red-600 rounded-3xl p-8 flex flex-col items-center min-w-[300px] shadow-[0_0_50px_rgba(220,38,38,0.5)]">
            <p className="text-xs text-slate-500 uppercase tracking-widest font-black mb-2">Auto-Kick Protocol</p>
            <p className="text-7xl font-mono font-black text-white animate-pulse">{shutdownTimer}s</p>
          </div>
        </div>
      )}
      {children}
    </>
  );
}