import sys
import os
import io
import json
from fastapi import FastAPI, Depends, HTTPException, File, UploadFile, Form, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import fitz
import docx
from pptx import Presentation

import models
from database import engine, get_db
import security
import ai_engine

from dependencies import get_current_user, require_role 
from socket_manager import manager
from routes import comms, ui_editor, tickets, users, vault, analytics, auth

models.Base.metadata.create_all(bind=engine)
app = FastAPI(title="NAAP AMT Sentinel Server")

# THE FIX: Updated CORS Policy to prevent crashes and allow dynamic Dev Tunnels
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", 
        "http://127.0.0.1:5173",
        "https://9j6zh67b-5173.asse.devtunnels.ms" # Add your exact frontend tunnel URL here
    ], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(comms.router)
app.include_router(ui_editor.router)
app.include_router(tickets.router)
app.include_router(users.router)
app.include_router(vault.router)
app.include_router(analytics.router)

# ==========================================
# PHASE 4: SECURED WEBSOCKET CONNECTION TUNNEL
# ==========================================
@app.websocket("/api/ws/connect")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(...)):
    # Pass token to manager to handle validation and connection
    is_authorized = await manager.connect(websocket, token)
    
    if is_authorized:
        try:
            while True:
                # THE FIX: Explicitly parse incoming messages to respond to heartbeats
                data = await websocket.receive_text()
                try:
                    payload = json.loads(data)
                    if payload.get("event") == "ping":
                        # Send pong back to Dev Tunnel to prevent idle disconnects
                        await websocket.send_json({"event": "pong"})
                    elif payload.get("event") == "NEW_TELEMETRY":
                        # Broadcast telemetry to all connected professors/admins
                        await manager.broadcast(payload)
                except json.JSONDecodeError:
                    pass
        except WebSocketDisconnect:
            manager.disconnect(websocket)

# ==========================================
# PYDANTIC SCHEMAS & ENDPOINTS
# ==========================================
class SingleQuestionRequest(BaseModel):
    context: str
    type: str
    level: str
    topic: Optional[str] = None
    sync_style: bool = False
    reference_questions: Optional[List[str]] = []

class BulkQuestionRequest(BaseModel):
    context: str
    level: str
    topic: Optional[str] = None
    count: int = 10 
    max_choices: int = 4

class ParaphraseTopicRequest(BaseModel):
    context: str
    topic: str
    section_type: str = "body"

class TopicDiscoveryRequest(BaseModel):
    context: str
    user_id: str

class SearchQuery(BaseModel):
    query: str

class CloneQuestionRequest(BaseModel):
    context: str
    level: str
    topic: Optional[str] = None
    reference_question: Dict[str, Any]

class SyncPatternRequest(BaseModel):
    user_id: str
    questions: List[Dict[str, Any]]

# NEW: Flashcard Schema
class FlashcardRequest(BaseModel):
    topic: str

# ==========================================
# ENDPOINTS (NOW SECURED WITH RBAC)
# ==========================================

@app.post("/api/modules/upload", dependencies=[Depends(require_role(["ADMIN", "FACULTY"]))])
async def upload_and_sentinel_verify(
    files: List[UploadFile] = File(...), 
    user_id: str = Form(...),
    upload_as_is: bool = Form(...),
    db: Session = Depends(get_db)
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    jurisdiction = "ALL_SUBJECTS_AUTHORIZED" if (user and user.role == "HEAD_ADMIN") or user_id == "h20041811" else (user.subjects if user else "")

    try:
        full_text = ""
        for file in files:
            file_bytes = await file.read()
            filename = file.filename.lower()

            if filename.endswith(".pdf"):
                pdf = fitz.open(stream=file_bytes, filetype="pdf")
                for page in pdf:
                    full_text += page.get_text()
                pdf.close()
            elif filename.endswith(".docx"):
                doc = docx.Document(io.BytesIO(file_bytes))
                for para in doc.paragraphs:
                    full_text += para.text + "\n"
            elif filename.endswith(".pptx"):
                ppt = Presentation(io.BytesIO(file_bytes))
                for slide in ppt.slides:
                    for shape in slide.shapes:
                        if hasattr(shape, "text"):
                            full_text += shape.text + "\n"
            else:
                raise HTTPException(status_code=400, detail=f"Unsupported file type: {file.filename}.")

        sentinel_result = ai_engine.validate_and_chunk_document(
            full_text, jurisdiction, upload_as_is
        )

        if not sentinel_result.get("valid"):
            new_log = models.AuditLog(
                action="DOCUMENT_VOIDED",
                target_id="Multi-file Batch" if len(files) > 1 else files[0].filename,
                performed_by=user_id,
                reason=sentinel_result.get("reason")
            )
            db.add(new_log)
            db.commit()
            raise HTTPException(status_code=400, detail=sentinel_result.get("reason"))

        module_title = f"{sentinel_result.get('subject')}: {files[0].filename[:20]}"
        ai_engine.ingest_into_rag(full_text, module_title)

        return {
            "status": "success",
            "subject_category": sentinel_result.get("subject"),
            "chunks": [{"id": "source_1", "title": "Merged Raw Data", "content": full_text}],
            "quiz_data": {"Lvl 1": [], "Lvl 2": [], "CAAP": []} 
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Server Crash: {str(e)}")

@app.post("/api/modules/discover-topics", dependencies=[Depends(require_role(["ADMIN", "FACULTY"]))])
def discover_topics(req: TopicDiscoveryRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == req.user_id).first()
    jurisdiction = "ALL_SUBJECTS_AUTHORIZED" if (user and user.role == "HEAD_ADMIN") or req.user_id == "h20041811" else (user.subjects if user else "")
    
    result = ai_engine.discover_available_topics(req.context, jurisdiction)
    
    if not result or result.get("status") == "error":
        error_msg = result.get("message", "Failed to scan topics.") if result else "No result from AI."
        raise HTTPException(status_code=400, detail=error_msg)
        
    return result

@app.post("/api/modules/generate-single", dependencies=[Depends(require_role(["ADMIN", "FACULTY"]))])
def generate_single(req: SingleQuestionRequest):
    return ai_engine.generate_single_question(req.context, req.type, req.level, req.topic)

@app.post("/api/modules/generate-bulk", dependencies=[Depends(require_role(["ADMIN", "FACULTY"]))])
def generate_bulk(req: BulkQuestionRequest):
    return ai_engine.generate_bulk_quiz(req.context, req.level, req.topic, req.count, req.max_choices)

@app.post("/api/modules/paraphrase-topic", dependencies=[Depends(require_role(["ADMIN", "FACULTY"]))])
def paraphrase_topic(req: ParaphraseTopicRequest):
    result = ai_engine.paraphrase_specific_topic(req.context, req.topic, req.section_type)
    if not result or result.get("status") == "error":
        raise HTTPException(status_code=400, detail="Failed to extract topic from document.")
    return result

@app.post("/api/search", dependencies=[Depends(require_role(["STUDENT", "FACULTY", "ADMIN"]))])
def rag_search(req: SearchQuery):
    return ai_engine.query_rag_engine(req.query)

@app.post("/api/modules/clone-question", dependencies=[Depends(require_role(["ADMIN", "FACULTY"]))])
def clone_question(req: CloneQuestionRequest):
    result = ai_engine.clone_specific_question(req.context, req.level, req.topic, req.reference_question)
    if not result or result.get("status") == "error":
        raise HTTPException(status_code=400, detail=result.get("message", "Failed to clone question logic."))
    return result

@app.post("/api/modules/sync-pattern", dependencies=[Depends(require_role(["ADMIN", "FACULTY"]))])
def sync_pattern(req: SyncPatternRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == req.user_id).first()
    if not user and req.user_id != "h20041811":
        raise HTTPException(status_code=404, detail="User not found in system.")
    
    result = ai_engine.analyze_and_store_prof_pattern(req.user_id, req.questions)
    
    if not result or result.get("status") == "error":
        raise HTTPException(status_code=400, detail=result.get("message", "Failed to sync professor pattern."))
    
    return result

# NEW: Flashcards API Endpoint
@app.post("/api/modules/flashcards", dependencies=[Depends(require_role(["STUDENT", "FACULTY", "ADMIN", "HEAD_ADMIN"]))])
def generate_ai_flashcards(req: FlashcardRequest):
    result = ai_engine.generate_flashcards(req.topic)
    if result.get("status") == "error":
        raise HTTPException(status_code=400, detail=result.get("message"))
    return result

# THE FIX: Moved the shutdown endpoint above the uvicorn run command
@app.post("/api/ws/trigger-shutdown", dependencies=[Depends(require_role(["HEAD_ADMIN"]))])
async def trigger_shutdown():
    """Broadcasts a global shutdown signal to all connected dashboards."""
    await manager.broadcast({"event": "SYSTEM_SHUTDOWN"})
    return {"status": "success", "message": "Global shutdown initiated."}


if __name__ == "__main__":
    import uvicorn
    # This tells your computer to start the web server on port 8000
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)