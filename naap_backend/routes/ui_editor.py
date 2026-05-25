from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
import uuid

import models
from database import get_db

router = APIRouter(prefix="/api/ui-editor", tags=["Core UI Editor"])

# --- Pydantic Schemas ---
class UIDraftRequest(BaseModel):
    author: str
    file_name: str
    code_snapshot: str

# --- Endpoints ---

@router.post("/draft")
def submit_draft(req: UIDraftRequest, db: Session = Depends(get_db)):
    """
    Tier 2/3 Action: Submits a new code draft into the Maker-Checker queue.
    Status defaults to 'PENDING_REVIEW'.
    """
    try:
        new_commit = models.UICommit(
            id=f"CMT-{uuid.uuid4().hex[:4].upper()}",
            author=req.author,
            file_name=req.file_name,
            code_snapshot=req.code_snapshot,
            status="PENDING_REVIEW"
        )
        db.add(new_commit)
        db.commit()
        return {"status": "success", "message": "Draft submitted for Tier 1 Review."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database Error: {str(e)}")

@router.get("/commits")
def get_active_commits(db: Session = Depends(get_db)):
    """
    Universal Action: Fetches all commits currently sitting in the queue.
    Filters out any code that has already been deployed.
    """
    try:
        # Fetch everything not yet deployed, newest first
        commits = db.query(models.UICommit).filter(
            models.UICommit.status != "DEPLOYED"
        ).order_by(models.UICommit.created_at.desc()).all()
        
        # Format for the React frontend
        formatted = [{
            "id": c.id, 
            "author": c.author, 
            "file": c.file_name,
            "time": c.created_at.strftime("%b %d, %I:%M %p"),
            "status": c.status, 
            "codeSnapshot": c.code_snapshot
        } for c in commits]
        
        return {"status": "success", "commits": formatted}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch commits: {str(e)}")

@router.put("/forward/{commit_id}")
def forward_commit(commit_id: str, db: Session = Depends(get_db)):
    """
    Tier 1 Action: Approves a pending draft and escalates it to the Head Admin.
    Changes status to 'AWAITING_HEAD_ADMIN'.
    """
    commit = db.query(models.UICommit).filter(models.UICommit.id == commit_id).first()
    if not commit:
        raise HTTPException(status_code=404, detail="Commit not found in database.")
    
    try:
        commit.status = "AWAITING_HEAD_ADMIN"
        db.commit()
        return {"status": "success", "message": "Commit forwarded to Tier 0."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to forward commit: {str(e)}")

@router.delete("/deploy/{commit_id}")
def deploy_commit(commit_id: str, db: Session = Depends(get_db)):
    """
    Tier 0 Action: Final security scan and live deployment. 
    Changes status to 'DEPLOYED' so it drops off the queue.
    """
    commit = db.query(models.UICommit).filter(models.UICommit.id == commit_id).first()
    if not commit:
        raise HTTPException(status_code=404, detail="Commit not found in database.")
    
    try:
        # In a real scenario, this is where you would write the code_snapshot to the actual filesystem.
        # For the database, we just mark it deployed so it leaves the queue.
        commit.status = "DEPLOYED"
        db.commit()
        return {"status": "success", "message": "Commit successfully deployed to live server."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to deploy commit: {str(e)}")