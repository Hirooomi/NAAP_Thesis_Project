// src/hooks/useLiveUpdate.js
import { useEffect } from 'react';

export function useLiveUpdate(onUpdateCallback) {
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    // Connects to your existing Dev Tunnel WebSocket
    const wsUrl = `wss://ztp98nvz-8000.asse.devtunnels.ms/api/ws/connect?token=${token}`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Listen for the broadcast triggers from your Python backend
        if (data.event === "NEW_TELEMETRY" || data.event === "VAULT_UPDATE") {
          console.log("[WS] Live update detected! Triggering dashboard refresh...");
          onUpdateCallback(); // This fires the specific fetch function for whichever page is open
        }
      } catch (e) {
        console.error("Failed to parse WebSocket message", e);
      }
    };

    // Clean up the connection so you don't crash your server with phantom listeners
    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [onUpdateCallback]);
}