from fastapi import WebSocket, status
from typing import List
import security  # Ensure this is imported to validate tokens

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket, token: str):
        # 1. Validate the token before accepting
        user = security.verify_token(token)
        if not user:
            # 2. Reject if unauthorized
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return False
        
        # 3. Accept and add to list if authorized
        await websocket.accept()
        self.active_connections.append(websocket)
        return True

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        """Pushes real-time JSON updates to all connected React Dashboards"""
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                self.disconnect(connection)

# The single global instance everyone will share
manager = ConnectionManager()