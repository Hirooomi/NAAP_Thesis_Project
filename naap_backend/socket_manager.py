from fastapi import WebSocket, status
from typing import List
from jose import jwt, JWTError
import os
import security  

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket, token: str):
        # THE FIX: Purely in-memory cryptographic token verification.
        # This completely bypasses the database so the SQLite file is never locked.
        try:
            # Dynamically pull the secret and algorithm from your security module
            secret = getattr(security, "SECRET_KEY", os.getenv("SECRET_KEY", "your-super-secret-naap-key"))
            algo = getattr(security, "ALGORITHM", "HS256")
            
            payload = jwt.decode(token, secret, algorithms=[algo])
            if not payload.get("sub"):
                await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
                return False
        except JWTError:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return False
        
        await websocket.accept()
        self.active_connections.append(websocket)
        return True

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        """Pushes real-time JSON updates to all connected React Dashboards"""
        # THE FIX: Wrap active_connections in list() to safely iterate 
        # without crashing if a user disconnects mid-broadcast.
        for connection in list(self.active_connections):
            try:
                await connection.send_json(message)
            except Exception:
                self.disconnect(connection)

# The single global instance everyone will share
manager = ConnectionManager()