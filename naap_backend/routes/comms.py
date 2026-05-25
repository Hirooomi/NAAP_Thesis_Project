from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import uuid
from datetime import datetime

import models
import ai_engine
import email_service
from database import get_db

router = APIRouter(prefix="/api/comms", tags=["Global Communications"])

class AIDraftRequest(BaseModel):
    topic: str
    date: str
    severity: str

class DeployBroadcastRequest(BaseModel):
    header: str
    message: str
    severity: str
    schedule_date: Optional[str] = ""
    dispatch_email: bool
    author: str
    author_id: Optional[str] = "SYSTEM"
    clearance_level: Optional[int] = 0

class ApprovalRequest(BaseModel):
    approved_by_id: str

@router.post("/ai-draft")
def generate_ai_draft(req: AIDraftRequest):
    result = ai_engine.draft_announcement(req.topic, req.date, req.severity)
    if not result or result.get("status") == "error":
        raise HTTPException(status_code=400, detail="Failed to draft message.")
    return result

@router.post("/deploy")
def deploy_broadcast(req: DeployBroadcastRequest, db: Session = Depends(get_db)):
    try:
        is_restricted = (req.clearance_level == 3) or (req.clearance_level == 2 and req.severity == "CRITICAL")
        final_status = "PENDING" if is_restricted else "APPROVED"

        new_announcement = models.Announcement(
            id=f"ANN-{uuid.uuid4().hex[:8].upper()}",
            header=req.header,
            message=req.message,
            severity=req.severity,
            schedule_date=req.schedule_date,
            author=req.author,
            dispatched_via_email=req.dispatch_email,
            status=final_status,
            requested_by_id=req.author_id if final_status == "PENDING" else None
        )
        db.add(new_announcement)
        db.commit()

        if final_status == "APPROVED" and req.dispatch_email:
            users = db.query(models.User.email).filter(models.User.email != None).all()
            recipient_emails = [u[0] for u in users if u[0]]
            if not recipient_emails:
                recipient_emails = ["test_student@naap.edu.ph", "test_prof@naap.edu.ph"]
            
            email_service.dispatch_global_announcement(
                header=req.header,
                message=req.message,
                severity=req.severity,
                recipient_emails=recipient_emails
            )

        msg = "Broadcast deployed successfully." if final_status == "APPROVED" else "Draft submitted to Maker-Checker queue for authorization."
        return {"status": "success", "message": msg, "record_status": final_status}
    
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database/Dispatch Error: {str(e)}")


@router.get("/announcements")
def get_active_announcements(db: Session = Depends(get_db)):
    """Fetches only APPROVED announcements, strictly hiding future scheduled ones."""
    try:
        announcements = db.query(models.Announcement).filter(models.Announcement.status == "APPROVED").order_by(models.Announcement.created_at.desc()).all()
        formatted_data = []
        now = datetime.now()

        for ann in announcements:
            if ann.schedule_date:
                try:
                    sched_dt = datetime.fromisoformat(ann.schedule_date)
                    if now < sched_dt:
                        continue 
                except Exception:
                    pass 
            
            formatted_data.append({
                "id": ann.id, 
                "header": ann.header, 
                "message": ann.message, 
                "severity": ann.severity, 
                # THE FIX: Removed the hyphen so React new Date() can parse it successfully for the popups!
                "date": ann.created_at.strftime("%b %d, %Y %I:%M %p"), 
                "author": ann.author
            })
            if len(formatted_data) >= 10: break 

        return {"status": "success", "announcements": formatted_data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/pending")
def get_pending_announcements(db: Session = Depends(get_db)):
    try:
        pending = db.query(models.Announcement).filter(models.Announcement.status == "PENDING").all()
        formatted_data = [{
            "id": p.id, "admin": p.requested_by_id or p.author, "date": p.schedule_date or "Immediate", 
            "reason": f"[{p.severity}] {p.header}", "message": p.message, "dispatch_email": p.dispatched_via_email
        } for p in pending]
        return {"status": "success", "pending": formatted_data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/approve/{announcement_id}")
def approve_announcement(announcement_id: str, req: ApprovalRequest, db: Session = Depends(get_db)):
    announcement = db.query(models.Announcement).filter(models.Announcement.id == announcement_id).first()
    if not announcement:
        raise HTTPException(status_code=404, detail="Announcement not found.")
    
    if announcement.status == "APPROVED":
        return {"status": "error", "message": "Already approved."}

    try:
        announcement.status = "APPROVED"
        announcement.approved_by_id = req.approved_by_id
        db.commit()

        if announcement.dispatched_via_email:
            users = db.query(models.User.email).filter(models.User.email != None).all()
            recipient_emails = [u[0] for u in users if u[0]]
            if not recipient_emails: recipient_emails = ["test_student@naap.edu.ph", "test_prof@naap.edu.ph"]
            
            email_service.dispatch_global_announcement(
                header=announcement.header, message=announcement.message,
                severity=announcement.severity, recipient_emails=recipient_emails
            )

        return {"status": "success", "message": "Broadcast Authorized and Released."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/reject/{announcement_id}")
def reject_announcement(announcement_id: str, db: Session = Depends(get_db)):
    announcement = db.query(models.Announcement).filter(models.Announcement.id == announcement_id).first()
    if announcement:
        db.delete(announcement)
        db.commit()
    return {"status": "success"}