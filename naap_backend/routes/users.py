from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from typing import Optional
import uuid
import json
import pandas as pd
import io
import random
import string

from dependencies import get_current_user, require_role
import models
import security
import email_service
import ai_engine 
from database import get_db

from socket_manager import manager

router = APIRouter(prefix="/api/users", tags=["User Architect"])

# ==========================================
# PYDANTIC SCHEMAS
# ==========================================
class UserCreateRequest(BaseModel):
    role: str
    first_name: str
    last_name: str
    email: str
    user_id: str
    admin_clearance: Optional[str] = None
    honorific: Optional[str] = None
    suffix: Optional[str] = None
    subjects: Optional[str] = None
    year_level: Optional[str] = None
    section: Optional[str] = None
    requester_id: Optional[str] = "SYSTEM"

class WhitelistVerifyRequest(BaseModel):
    student_id: str
    first_name: str
    last_name: str

class UnifiedRegisterRequest(BaseModel):
    student_id: str
    email: str
    first_name: str
    last_name: str
    year_level: str
    section: str

class AIRejectionDraftRequest(BaseModel):
    student_name: str
    reason: str

class FinalizeRejectionRequest(BaseModel):
    student_email: str
    email_body: str

class UpdateSectionRequest(BaseModel):
    section: str

class UpdateSubjectsRequest(BaseModel):
    subjects: str

def generate_temp_password():
    chars = string.ascii_uppercase + string.digits
    random_str = ''.join(random.choice(chars) for _ in range(6))
    return f"NAAP-{random_str}"

# ==========================================
# PROTECTED ADMIN & FACULTY ROUTES
# ==========================================

@router.get("/roster", dependencies=[Depends(require_role(["ADMIN", "FACULTY", "HEAD_ADMIN"]))])
def get_rosters(db: Session = Depends(get_db)):
    try:
        users = db.query(models.User).all()
        admins = []
        profs = []
        students = []

        for u in users:
            if u.role == "ADMIN":
                admins.append({"id": u.id, "name": f"{u.first_name} {u.last_name}", "email": u.email, "level": u.admin_clearance})
            elif u.role == "FACULTY":
                profs.append({"id": u.id, "name": f"{u.first_name} {u.last_name}", "email": u.email, "honorific": u.honorific, "suffix": u.suffix, "subjects": u.subjects})
            elif u.role in ["STUDENT", "TESTER", "ALUMNI"]:
                students.append({"id": u.id, "name": f"{u.last_name}, {u.first_name}", "email": u.email, "year": u.year_level, "section": u.section, "role": u.role})

        return {"status": "success", "admins": admins, "profs": profs, "students": students}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))     

@router.get("/pending", dependencies=[Depends(require_role(["ADMIN", "HEAD_ADMIN"]))])
def get_pending_requests(db: Session = Depends(get_db)):
    try:
        reqs = db.query(models.PendingApproval).filter(models.PendingApproval.entity_type.like("NEW_%")).all()
        formatted = []
        for r in reqs:
            data = json.loads(r.payload_data)
            
            uid = data.get('user_id', 'UNKNOWN_ID')
            email = data.get('email', 'NO_EMAIL')
            yr = data.get('year_level', '')
            sec = data.get('section', '')
            
            spec_details = f"ID: {uid} | {email}"
            if yr and sec:
                spec_details += f" | {yr}, {sec}"

            formatted.append({
                "id": r.id,
                "type": r.entity_type.replace('_', ' '),
                "name": f"{data.get('first_name')} {data.get('last_name')}",
                "spec": spec_details,
                "email": email, 
                "requestedBy": r.requested_by
            })
        return {"status": "success", "pending": formatted}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/create", dependencies=[Depends(require_role(["ADMIN"]))])
def create_user(req: UserCreateRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter((models.User.email == req.email) | (models.User.id == req.user_id)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email or ID already exists.")

    try:
        temp_pass = generate_temp_password()
        hashed = security.get_password_hash(temp_pass)

        new_user = models.User(
            id=req.user_id,
            email=req.email,
            hashed_password=hashed,
            first_name=req.first_name,
            last_name=req.last_name,
            role=req.role,
            admin_clearance=req.admin_clearance,
            honorific=req.honorific,
            suffix=req.suffix,
            subjects=req.subjects,
            year_level=req.year_level,
            section=req.section
        )
        db.add(new_user)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database Insertion Failed: {str(e)}")

    if req.role == "FACULTY":
        email_body = f"Welcome {req.first_name}.\n\nYour Faculty account has been created.\nYour System Login ID is: {req.user_id}\nYour temporary password is: {temp_pass}\n\nSECURITY PROTOCOL: This temporary password will expire in 1 hour. Please log in immediately to secure your account and set a permanent password."
    else:
        email_body = f"Welcome {req.first_name}.\n\nYour account has been provisioned.\nYour Login ID is: {req.user_id}\nYour temporary password is: {temp_pass}\n\nSECURITY PROTOCOL: This temporary password will expire in 1 hour. Please log in immediately to secure your account and set a permanent password."

    background_tasks.add_task(
        email_service.dispatch_global_announcement,
        header="NAAP AMT: Your Account Has Been Provisioned",
        message=email_body,
        severity="LOW",
        recipient_emails=[req.email]
    )

    return {"status": "success", "message": "User created successfully. Email dispatching in background.", "temporary_password": temp_pass}

@router.delete("/purge/{user_id}", dependencies=[Depends(require_role(["ADMIN", "HEAD_ADMIN"]))])
def purge_user(
    user_id: str, 
    admin_id: str = Query("SYSTEM"),
    reason: str = Query("No reason provided"),
    db: Session = Depends(get_db)
):
    try:
        new_log = models.AuditLog(
            action="ACCOUNT_PURGED",
            target_id=user_id,
            performed_by=admin_id,
            reason=reason
        )
        db.add(new_log)

        rows_deleted = db.query(models.User).filter(models.User.id == user_id).delete(synchronize_session=False)
        
        if rows_deleted == 0: 
            raise HTTPException(status_code=404, detail="User not found")
        
        db.commit()
        return {"status": "success"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/approve/{req_id}", dependencies=[Depends(require_role(["ADMIN"]))])
def approve_request(req_id: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    pending = db.query(models.PendingApproval).filter(models.PendingApproval.id == req_id).first()
    if not pending: raise HTTPException(status_code=404, detail="Request not found.")
    
    data = json.loads(pending.payload_data)
    temp_pass = generate_temp_password()
    
    try:
        new_user = models.User(
            id=data.get('user_id'),
            email=data.get('email'),
            hashed_password=security.get_password_hash(temp_pass),
            first_name=data.get('first_name'),
            last_name=data.get('last_name'),
            role=data.get('role'),
            admin_clearance=data.get('admin_clearance'),
            honorific=data.get('honorific'),
            suffix=data.get('suffix'),
            subjects=data.get('subjects'),
            year_level=data.get('year_level'),
            section=data.get('section', '').replace('Sec: ', '') 
        )
        db.add(new_user)
        db.delete(pending)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database Insertion Failed: {str(e)}")

    if data.get('role') == "FACULTY":
        email_body = f"Welcome {data.get('first_name')}.\n\nYour Faculty account has been authorized and created.\nYour System Login ID is: {data.get('user_id')}\nYour temporary password is: {temp_pass}\n\nSECURITY PROTOCOL: This temporary password will expire in 1 hour. Please log in immediately to secure your account and set a permanent password."
    else:
        email_body = f"Welcome {data.get('first_name')}.\n\nYour account has been authorized and provisioned.\nYour Login ID is: {data.get('user_id')}\nYour temporary password is: {temp_pass}\n\nSECURITY PROTOCOL: This temporary password will expire in 1 hour. Please log in immediately to secure your account and set a permanent password."

    background_tasks.add_task(
        email_service.dispatch_global_announcement,
        header="NAAP AMT: Your Account Has Been Provisioned",
        message=email_body,
        severity="LOW",
        recipient_emails=[data.get('email')]
    )

    return {"status": "success", "message": "Request approved and account provisioned.", "temporary_password": temp_pass}

@router.post("/resend-passcode/{user_id}", dependencies=[Depends(require_role(["ADMIN", "HEAD_ADMIN"]))])
def resend_passcode(user_id: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    temp_pass = generate_temp_password()
    user.hashed_password = security.get_password_hash(temp_pass)
    db.commit()

    email_body = f"Hello {user.first_name}.\n\nAn administrator has reset your account password.\nYour Login ID is: {user.id}\nYour new temporary password is: {temp_pass}\n\nSECURITY PROTOCOL: Please log in immediately to secure your account and set a permanent password."

    background_tasks.add_task(
        email_service.dispatch_global_announcement,
        header="NAAP AMT: Administrator Password Reset",
        message=email_body,
        severity="URGENT",
        recipient_emails=[user.email]
    )

    return {"status": "success", "message": f"New passcode dispatched to {user.email}."}

@router.delete("/reject/{req_id}", dependencies=[Depends(require_role(["ADMIN"]))])
def reject_request(req_id: str, db: Session = Depends(get_db)):
    """Standard silent purge for duplicate requests"""
    pending = db.query(models.PendingApproval).filter(models.PendingApproval.id == req_id).first()
    if pending:
        db.delete(pending)
        db.commit()
    return {"status": "success"}

# ==========================================
# AI REJECTION ENGINE
# ==========================================
@router.post("/draft-rejection", dependencies=[Depends(require_role(["ADMIN"]))])
def draft_rejection(req: AIRejectionDraftRequest):
    """Pings the AI Engine to generate a professional rejection email"""
    topic = f"Account Registration Rejected for {req.student_name}"
    severity = "MODERATE"
    prompt_override = f"Draft a highly professional, brief, and apologetic email to a university student named {req.student_name}. Inform them that their request for a NAAP AMT system account has been denied by the Administrator. The specific reason for denial is: '{req.reason}'. Advise them to contact the registrar if they believe this is an error. Do not include placeholders, just the email body."
    
    result = ai_engine.draft_announcement(topic, "Immediate", severity, custom_prompt=prompt_override)
    if not result or result.get("status") == "error":
        raise HTTPException(status_code=400, detail="Failed to draft rejection letter.")
    
    return {"status": "success", "draft": result.get("draft")}

@router.post("/finalize-rejection/{req_id}", dependencies=[Depends(require_role(["ADMIN"]))])
def finalize_rejection(req_id: str, req: FinalizeRejectionRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Dispatches the AI email and permanently purges the request"""
    pending = db.query(models.PendingApproval).filter(models.PendingApproval.id == req_id).first()
    if not pending:
        raise HTTPException(status_code=404, detail="Request not found or already deleted.")
    
    try:
        background_tasks.add_task(
            email_service.dispatch_global_announcement,
            header="NAAP AMT: Account Registration Status",
            message=req.email_body,
            severity="MODERATE",
            recipient_emails=[req.student_email]
        )
        db.delete(pending)
        db.commit()
        return {"status": "success", "message": "Rejection letter queued and request purged."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to dispatch rejection: {str(e)}")

@router.post("/bulk-import", dependencies=[Depends(require_role(["ADMIN"]))])
async def bulk_import_whitelist(file: UploadFile = File(...), db: Session = Depends(get_db)):
    try:
        contents = await file.read()
        if file.filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(contents))
        elif file.filename.endswith(('.xls', '.xlsx')):
            df = pd.read_excel(io.BytesIO(contents))
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format.")

        added_count = 0
        for index, row in df.iterrows():
            existing = db.query(models.WhitelistedStudent).filter(models.WhitelistedStudent.id == str(row['STUDENT_ID']).strip()).first()
            if not existing:
                new_student = models.WhitelistedStudent(
                    id=str(row['STUDENT_ID']).strip(),
                    first_name=str(row['FIRST_NAME']).strip(),
                    last_name=str(row['LAST_NAME']).strip(),
                    year_level=str(row['YEAR_LEVEL']).strip(),
                    section=str(row['SECTION']).strip()
                )
                db.add(new_student)
                added_count += 1
                
        db.commit()
        return {"status": "success", "message": f"Successfully whitelisted {added_count} students from Excel."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

# ==========================================
# UNPROTECTED PUBLIC ROUTES (REGISTRATION)
# ==========================================

@router.post("/request-create")
def request_create_user(req: UserCreateRequest, db: Session = Depends(get_db)):
    try:
        payload_data = req.model_dump_json()
        new_req = models.PendingApproval(
            id=f"REQ-USR-{uuid.uuid4().hex[:4].upper()}",
            entity_type=f"NEW_{req.role}_ACCOUNT",
            requested_by=req.requester_id,
            payload_data=payload_data
        )
        db.add(new_req)
        db.commit()
        return {"status": "success", "message": "Draft submitted to queue."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/unified-register")
def unified_registration(req: UnifiedRegisterRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    existing_user = db.query(models.User).filter(models.User.email == req.email).first()
    if existing_user: raise HTTPException(status_code=400, detail="Email is already in use.")

    whitelist_entry = db.query(models.WhitelistedStudent).filter(
        models.WhitelistedStudent.id == req.student_id.strip(),
        func.lower(models.WhitelistedStudent.first_name) == req.first_name.strip().lower(),
        func.lower(models.WhitelistedStudent.last_name) == req.last_name.strip().lower()
    ).first()

    if whitelist_entry and not whitelist_entry.is_claimed:
        try:
            temp_pass = generate_temp_password()
            hashed = security.get_password_hash(temp_pass)
            new_user = models.User(
                id=req.student_id,
                email=req.email,
                hashed_password=hashed,
                first_name=whitelist_entry.first_name,
                last_name=whitelist_entry.last_name,
                role="STUDENT",
                year_level=whitelist_entry.year_level, 
                section=whitelist_entry.section
            )
            db.add(new_user)
            whitelist_entry.is_claimed = True
            db.commit()

            email_body = f"Welcome {whitelist_entry.first_name}.\n\nYour account has been instantly provisioned via the Registrar Whitelist.\nYour Login ID is: {req.student_id}\nYour temporary password is: {temp_pass}\n\nSECURITY PROTOCOL: This temporary password will expire in 1 hour. Please log in immediately to secure your account and set a permanent password."
            
            background_tasks.add_task(
                email_service.dispatch_global_announcement,
                header="NAAP AMT: Your Account Has Been Provisioned",
                message=email_body,
                severity="LOW",
                recipient_emails=[req.email]
            )
            
            return {"status": "success", "message": "Account auto-provisioned."}
        
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=str(e))

    try:
        payload_data = json.dumps({
            "role": "STUDENT",
            "first_name": req.first_name,
            "last_name": req.last_name,
            "email": req.email,
            "user_id": req.student_id,
            "year_level": req.year_level,
            "section": f"Sec: {req.section}"
        })
        
        new_req = models.PendingApproval(
            id=f"REQ-USR-{uuid.uuid4().hex[:4].upper()}",
            entity_type="NEW_STUDENT_ACCOUNT",
            requested_by="SYSTEM_SELF_REGISTRATION",
            payload_data=payload_data
        )
        db.add(new_req)
        db.commit()
        return {"status": "success", "message": "Registration received. Queued for authorization."}
    
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

# ==========================================
# NEW: COHORT & ROSTER INLINE CONTROLS
# ==========================================

@router.post("/batch-promote", dependencies=[Depends(require_role(["ADMIN", "HEAD_ADMIN"]))])
def batch_promote_students(background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    try:
        students = db.query(models.User).filter(models.User.role == "STUDENT").all()
        for student in students:
            if student.year_level == "1st Year":
                student.year_level = "2nd Year"
            elif student.year_level == "2nd Year":
                student.year_level = "3rd Year"
            elif student.year_level == "3rd Year":
                student.year_level = "4th Year"
            elif student.year_level == "4th Year":
                student.role = "ALUMNI"
                student.year_level = "Alumni"
                student.section = "Evaluator"
        
        db.commit()
        
        async def send_roster_update():
            await manager.broadcast({"event": "ROSTER_UPDATE", "message": "Academic Year Batch Promotion Executed."})
            
        background_tasks.add_task(send_roster_update)
        return {"status": "success", "message": "Batch promotion complete."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{user_id}/section", dependencies=[Depends(require_role(["ADMIN", "HEAD_ADMIN"]))])
def update_student_section(user_id: str, req: UpdateSectionRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.section = req.section.upper()
    db.commit()
    
    async def send_roster_update():
        await manager.broadcast({"event": "ROSTER_UPDATE"})
        
    background_tasks.add_task(send_roster_update)
    return {"status": "success"}

@router.put("/{user_id}/subjects", dependencies=[Depends(require_role(["ADMIN", "HEAD_ADMIN"]))])
def update_faculty_subjects(user_id: str, req: UpdateSubjectsRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.subjects = req.subjects
    db.commit()
    
    async def send_roster_update():
        await manager.broadcast({"event": "ROSTER_UPDATE"})
        
    background_tasks.add_task(send_roster_update)
    return {"status": "success"}

# ==========================================
# THE FIX: DYNAMIC WILDCARD ROUTES AT THE BOTTOM
# ==========================================
@router.get("/{user_id}")
def get_user_profile(user_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    return {
        "status": "success",
        "user": {
            "id": user.id,
            "role": user.role,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "subjects": user.subjects,
            "section": user.section,
            "year_level": user.year_level
        }
    }