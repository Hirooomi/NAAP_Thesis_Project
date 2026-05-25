from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
import uuid
from socket_manager import manager
import models
from database import get_db
from dependencies import get_current_user, require_role

# THE FIX: Import the WebSocket manager to broadcast live score updates
from socket_manager import manager

router = APIRouter(prefix="/api/analytics", tags=["Global Analytics"])

@router.get("/global", dependencies=[Depends(require_role(["ADMIN", "FACULTY"]))])
def get_global_metrics(db: Session = Depends(get_db)):
    # 1. Count Active Users
    total_students = db.query(models.User).filter(models.User.role == "STUDENT", models.User.is_active == True).count()
    total_faculty = db.query(models.User).filter(models.User.role == "FACULTY", models.User.is_active == True).count()
    
    # 2. Count Active Sessions (Logged in within the last 30 minutes)
    thirty_mins_ago = datetime.utcnow() - timedelta(minutes=30)
    active_sessions = db.query(models.User).filter(models.User.last_login >= thirty_mins_ago).count()
    active_sessions += 1

    # 3. Count RAG Modules in Vault
    total_modules = db.query(models.VaultAsset).filter(models.VaultAsset.type == "MODULE").count()
    
    # 4. Calculate Global Passing Rate (NOW USING SESSIONLOG)
    total_records = db.query(models.SessionLog).count()
    passed_records = db.query(models.SessionLog).filter(models.SessionLog.passed == True).count()
    global_pass_rate = round((passed_records / total_records * 100), 1) if total_records > 0 else 0.0

    # 5. Calculate Readiness by CAAP Subject
    readiness_data = []
    categories = db.query(models.SessionLog.category).distinct().all()
    
    for cat in categories:
        cat_name = cat[0]
        records = db.query(models.SessionLog).filter(models.SessionLog.category == cat_name).all()
        if records:
            avg_score = sum((r.score / r.total_items) * 100 for r in records if r.total_items > 0) / len(records)
            readiness_data.append({
                "subject": cat_name.upper(),
                "percentage": round(avg_score)
            })

    readiness_data.sort(key=lambda x: x["percentage"], reverse=True)

    # Fetch live logs for the Telemetry feed
    recent_logs = db.query(models.SessionLog).order_by(models.SessionLog.timestamp.desc()).limit(50).all()
    formatted_logs = []
    for log in recent_logs:
        student = db.query(models.User).filter(models.User.id == log.student_id).first()
        student_name = f"{student.last_name}, {student.first_name[0]}." if student else "Unknown"
        
        score_percent = f"{round((log.score / log.total_items) * 100)}%" if log.total_items > 0 else "0%"
        action_text = f"{'Passed' if log.passed else 'Failed'} {log.quiz_id}"
        
        time_str = log.timestamp.strftime("%H:%M") if log.timestamp else "Just now"

        formatted_logs.append({
            "student": f"{student_name} ({log.student_id})",
            "action": action_text,
            "score": score_percent,
            "time": time_str,
            "category": log.category.split(" ")[0].upper(), # E.g., 'TURBINE' from 'Turbine Engines'
            "quiz_id": log.quiz_id,
            "topic": log.quiz_id,
            "difficulty": log.difficulty,
            "total_items": log.total_items
        })

    return {
        "metrics": {
            "students": total_students,
            "faculty": total_faculty,
            "active_sessions": active_sessions,
            "modules": total_modules,
            "pass_rate": global_pass_rate
        },
        "readiness": readiness_data,
        "logs": formatted_logs
    }


@router.get("/jurisdictional/{prof_id}", dependencies=[Depends(require_role(["ADMIN", "FACULTY"]))])
def get_jurisdictional_analytics(prof_id: str, db: Session = Depends(get_db)):
    """Fetches analytics strictly limited to the subjects assigned to this specific Professor"""
    prof = db.query(models.User).filter(models.User.id == prof_id).first()
    if not prof or prof.role != "FACULTY":
        raise HTTPException(status_code=404, detail="Faculty member not found.")

    assigned_subjects = [s.strip() for s in (prof.subjects or "").split(",") if s.strip()]
    
    if not assigned_subjects:
        return {"years": [], "sections": {}, "students": []}

    # Fetch ALL quiz records belonging to this Prof's jurisdiction (NOW USING SESSIONLOG)
    records = db.query(models.SessionLog).filter(models.SessionLog.category.in_(assigned_subjects)).all()
    student_ids = list(set(r.student_id for r in records))
    
    students = db.query(models.User).filter(models.User.id.in_(student_ids), models.User.role == "STUDENT").all()

    raw_students = []
    years_set = set()
    sections_dict = {}

    for s in students:
        s_records = [r for r in records if r.student_id == s.id]
        if not s_records: continue

        total_percent = sum((r.score / r.total_items) * 100 for r in s_records if r.total_items > 0)
        avg = total_percent / len(s_records)

        if avg >= 90: status = "EXCELLENT"
        elif avg >= 80: status = "GOOD"
        elif avg >= 70: status = "AT RISK"
        else: status = "CRITICAL"

        year_label = s.year_level or "Unknown Year"
        sec_label = s.section or "Unknown Section"
        
        years_set.add(year_label)
        if year_label not in sections_dict:
            sections_dict[year_label] = set()
        sections_dict[year_label].add(sec_label)

        logs = []
        for sub in assigned_subjects:
            sub_recs = [r for r in s_records if r.category == sub]
            if not sub_recs: continue
            
            sub_recs_sorted = sorted(sub_recs, key=lambda x: x.timestamp)
            
            pre_test = (sub_recs_sorted[0].score / sub_recs_sorted[0].total_items) * 100 if sub_recs_sorted[0].total_items > 0 else 0
            post_test = (sub_recs_sorted[-1].score / sub_recs_sorted[-1].total_items) * 100 if sub_recs_sorted[-1].total_items > 0 else 0
            
            weak_points = []
            if post_test < 75:
                weak_points.append(f"{sub} Fundamentals")
            if len(sub_recs_sorted) > 1 and pre_test > post_test:
                weak_points.append(f"{sub} Knowledge Regression")

            logs.append({
                "module": sub,
                "preTest": round(pre_test),
                "postTest": round(post_test),
                "tries": len(sub_recs),
                "weakPoints": weak_points
            })

        raw_students.append({
            "id": s.id,
            "name": f"{s.last_name}, {s.first_name}",
            "sy": year_label,
            "section": sec_label,
            "avg": round(avg),
            "status": status,
            "logs": logs
        })

    formatted_years = list(years_set)
    formatted_sections = {y: list(sections_dict[y]) for y in sections_dict}

    return {
        "years": formatted_years,
        "sections": formatted_sections,
        "students": raw_students
    }


from pydantic import BaseModel

class QuizSubmitRequest(BaseModel):
    student_id: str
    quiz_id: str      
    category: str     
    difficulty: str   
    score: int
    total_items: int

# ==========================================
# STUDENT TELEMETRY & QUIZ SUBMISSION
# ==========================================
@router.post("/submit-quiz", dependencies=[Depends(require_role(["STUDENT", "FACULTY", "ADMIN"]))])
async def submit_quiz(req: QuizSubmitRequest, db: Session = Depends(get_db)):
    """Saves the student's live quiz attempt and broadcasts via WebSocket"""
    try:
        passed = (req.score / req.total_items) >= 0.75 if req.total_items > 0 else False
        
        # THE FIX: Adapted mapping to the Phase 1 SessionLog format
        new_record = models.SessionLog(
            id=f"REC-{uuid.uuid4().hex[:8].upper()}",
            student_id=req.student_id,
            quiz_id=req.quiz_id,
            category=req.category,
            difficulty=req.difficulty,
            score=req.score,
            total_items=req.total_items,
            passed=passed
        )
        db.add(new_record)
        db.commit()

        # THE FIX: Push a live JSON broadcast to all connected dashboards!
        await manager.broadcast({
            "event": "NEW_TELEMETRY",
            "message": f"Student {req.student_id} submitted {req.quiz_id}."
        })

        return {"status": "success", "message": "Quiz telemetry synced."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/student/{student_id}", dependencies=[Depends(require_role(["STUDENT", "FACULTY", "ADMIN"]))])
def get_student_analytics(student_id: str, db: Session = Depends(get_db)):
    """Fetches all quiz attempts for a specific student"""
    records = db.query(models.SessionLog).filter(models.SessionLog.student_id == student_id).order_by(models.SessionLog.timestamp.desc()).all()
    
    logs = []
    for r in records:
        base_level = "CAAP" if "CAAP" in r.difficulty else "Lvl 2" if "Lvl 2" in r.difficulty else "Lvl 1"
        test_type = "Pre" if "Pre" in r.difficulty else "Post" if "Post" in r.difficulty else "Exam"
        percent = round((r.score / r.total_items) * 100) if r.total_items > 0 else 0

        logs.append({
            "topic": r.quiz_id,
            "category": r.category,
            "baseLevel": base_level,
            "type": test_type,
            "score": percent
        })
        
    return {"status": "success", "logs": logs}