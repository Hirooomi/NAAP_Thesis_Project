from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel
import uuid
import json

from dependencies import get_current_user, require_role 
import models
import email_service
import ai_engine
from database import get_db
from database import SessionLocal 

from socket_manager import manager

router = APIRouter(prefix="/api/tickets", tags=["Ticket Triage"])

class TicketSubmitRequest(BaseModel):
    issue_type: str = "General Support" 
    issue_text: str

class TicketResolveRequest(BaseModel):
    resolution_text: str
    clearance_level: int

async def process_ticket_background(ticket_id: str, issue_text: str, user_id: str, issue_type: str):
    """The Asynchronous AI Worker (Upgraded with Phase 5 Auto-Adjudication)"""
    db = SessionLocal() 
    try:
        # PHASE 5: INTERCEPT SCORE DISPUTES
        if issue_type == "Incorrect Quiz Evaluation":
            adjudication = ai_engine.evaluate_score_dispute(issue_text)
            ticket = db.query(models.SupportTicket).filter(models.SupportTicket.id == ticket_id).first()
            
            if adjudication.get("is_valid_dispute"):
                points = adjudication.get("points_to_add", 0)
                
                # Fetch the student's most recent quiz log to correct
                recent_log = db.query(models.SessionLog).filter(models.SessionLog.student_id == user_id).order_by(models.SessionLog.timestamp.desc()).first()
                
                if recent_log:
                    recent_log.score += points
                    if recent_log.score > recent_log.total_items:
                        recent_log.score = recent_log.total_items # Prevent scores over 100%
                    recent_log.passed = (recent_log.score / recent_log.total_items) >= 0.75 if recent_log.total_items > 0 else False
                    
                    # Flip the AI Tracking Flags!
                    recent_log.is_ai_reviewed = True
                    recent_log.score_disputed = True
                    
                    # Auto-Resolve the Ticket
                    ticket.status = "RESOLVED"
                    ticket.assigned_to = "AI_ADJUDICATOR"
                    ticket.ai_triage_folder = "IMPORTANT"
                    db.commit()

                    # Trigger Phase 4 Double WebSockets to sync the Matrix AND the Triage Board!
                    await manager.broadcast({
                        "event": "NEW_TELEMETRY",
                        "message": f"AI corrected score for student {user_id}."
                    })
                    await manager.broadcast({
                        "event": "TICKET_UPDATE",
                        "message": f"AI Auto-Resolved grading dispute {ticket_id}."
                    })

                    # Email the student the good news
                    user = db.query(models.User).filter(models.User.id == user_id).first()
                    if user and user.email:
                        email_service.dispatch_global_announcement(
                            header="NAAP AMT: Grade Dispute Auto-Resolved",
                            message=adjudication.get("email_draft", "Your score has been updated."),
                            severity="LOW",
                            recipient_emails=[user.email]
                        )
                    return # Exit worker successfully

        # PHASE 3: STANDARD TICKET TRIAGE (If not a score dispute, or if AI denied the dispute)
        triage_result = ai_engine.triage_support_ticket(issue_text)
        folder = triage_result.get("folder", "MODERATE")
        subject = triage_result.get("subject")
        auto_reply = triage_result.get("auto_reply", "Ticket received. Admin review pending.")

        ticket = db.query(models.SupportTicket).filter(models.SupportTicket.id == ticket_id).first()
        if ticket and ticket.status != "RESOLVED":
            ticket.ai_triage_folder = folder
            ticket.status = "OPEN" 
            db.commit()

            await manager.broadcast({
                "event": "TICKET_UPDATE",
                "message": f"AI Worker routed a new ticket into {folder}"
            })

        user = db.query(models.User).filter(models.User.id == user_id).first()
        if user and user.email:
            email_service.dispatch_global_announcement(
                header=f"NAAP IT Support: Ticket {ticket_id} Received",
                message=auto_reply,
                severity="LOW",
                recipient_emails=[user.email]
            )
            
        if folder in ["IMPORTANT", "MODERATE"] and subject:
            profs = db.query(models.User).filter(models.User.role == "FACULTY").all()
            target_profs = [p.email for p in profs if p.email and p.subjects and subject in p.subjects]
            
            if target_profs:
                email_service.dispatch_global_announcement(
                    header=f"AUTOMATED ALERT: Action Required for {subject}",
                    message=f"A student reported an issue categorized as {folder}:\n\n'{issue_text}'\n\nPlease check your Command Center.",
                    severity=folder,
                    recipient_emails=target_profs
                )
    except Exception as e:
        print(f"[BACKGROUND WORKER ERROR] {str(e)}")
    finally:
        db.close() 

@router.post("/submit", dependencies=[Depends(require_role(["STUDENT", "FACULTY", "ADMIN"]))])
def submit_ticket(req: TicketSubmitRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    try:
        priority = "URGENT" if current_user.role == "FACULTY" else "NORMAL"
        
        new_ticket = models.SupportTicket(
            id=f"TKT-{uuid.uuid4().hex[:4].upper()}",
            requester_id=current_user.id,
            requester_role=current_user.role,
            issue_type=req.issue_type,
            issue_text=req.issue_text,
            status="PROCESSING", 
            priority_level=priority
        )
        db.add(new_ticket)
        db.commit()
        
        # THE FIX: Passed issue_type into the worker so it knows to trigger Phase 5
        background_tasks.add_task(process_ticket_background, new_ticket.id, req.issue_text, current_user.id, req.issue_type)
        
        return {"status": "success", "message": "Ticket submitted. AI is currently triaging your request.", "ticket_id": new_ticket.id}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.get("/active", dependencies=[Depends(require_role(["ADMIN"]))])
def get_active_tickets(db: Session = Depends(get_db)):
    try:
        tickets = db.query(models.SupportTicket).filter(models.SupportTicket.status == "OPEN").all()
        categorized = {"URGENT": [], "IMPORTANT": [], "MODERATE": [], "INTERMEDIATE": []}
        
        for t in tickets:
            user = db.query(models.User).filter(models.User.id == t.requester_id).first()
            time_str = t.created_at.strftime("%b %d, %H:%M") if t.created_at else "Just now"
            
            if user:
                t_type = "STUDENT" if user.role == "STUDENT" else "PROF"
                t_name = f"{user.last_name}, {user.first_name[0] if user.first_name else ''}." if user.role == "STUDENT" else f"{user.honorific or 'Prof.'} {user.last_name}"
                t_email = user.email
                t_class = f"{user.year_level or 'N/A'} - Sec {user.section or 'N/A'}"
            else:
                t_type = "UNKNOWN"
                t_name = "Unregistered System User"
                t_email = "No registered email"
                t_class = "N/A"
            
            ticket_data = {
                "id": t.id,
                "type": t_type,
                "name": t_name,
                "idNumber": t.requester_id, 
                "email": t_email,
                "yearSec": t_class,
                "issue": t.issue_text,
                "time": time_str
            }
            
            cat = t.ai_triage_folder if t.ai_triage_folder in categorized else "MODERATE"
            categorized[cat].append(ticket_data)
            
        return {"status": "success", "tickets": categorized}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/resolve/{ticket_id}", dependencies=[Depends(require_role(["ADMIN"]))])
async def resolve_ticket(ticket_id: str, req: TicketResolveRequest, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    ticket = db.query(models.SupportTicket).filter(models.SupportTicket.id == ticket_id).first()
    if not ticket: raise HTTPException(status_code=404, detail="Ticket not found.")
        
    user = db.query(models.User).filter(models.User.id == ticket.requester_id).first()
    
    try:
        if req.clearance_level == 3:
            draft_payload = {
                "ticket_id": ticket_id,
                "resolution_text": req.resolution_text,
                "target_email": user.email if user else "UNKNOWN"
            }
            new_approval = models.PendingApproval(
                id=f"REQ-TKT-{uuid.uuid4().hex[:4].upper()}",
                entity_type="TICKET_RESOLUTION",
                requested_by=current_user.id,
                payload_data=json.dumps(draft_payload)
            )
            db.add(new_approval)
            db.commit()

            await manager.broadcast({
                "event": "TICKET_UPDATE",
                "message": f"Draft resolution submitted for {ticket_id}."
            })
            return {"status": "success", "message": "Draft submitted to Tier 2 for approval."}
            
        ticket.status = "RESOLVED"
        ticket.assigned_to = current_user.id
        
        if user and user.email:
            email_service.dispatch_global_announcement(
                header=f"NAAP IT Support: Ticket {ticket.id} Resolved",
                message=req.resolution_text,
                severity="LOW", 
                recipient_emails=[user.email]
            )
            
        db.commit()

        await manager.broadcast({
            "event": "TICKET_UPDATE",
            "message": f"Ticket {ticket_id} resolved by admin."
        })

        return {"status": "success", "message": "Ticket resolved and email dispatched."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))