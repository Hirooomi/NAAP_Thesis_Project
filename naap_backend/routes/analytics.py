from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
import uuid
import json

import models
from database import get_db
from dependencies import get_current_user, require_role
from socket_manager import manager
from pydantic import BaseModel

router = APIRouter(prefix="/api/analytics", tags=["Global Analytics"])

# ==========================================
# 1. GLOBAL METRICS & LIVE TELEMETRY MATRIX
# ==========================================
@router.get("/global", dependencies=[Depends(require_role(["ADMIN", "FACULTY"]))])
def get_global_metrics(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # 1. Active vs Total Populations
    total_students = db.query(models.User).filter(models.User.role.in_(["STUDENT", "ALUMNI", "TESTER"])).count()
    total_faculty = db.query(models.User).filter(models.User.role == "FACULTY").count()

    live_threshold = datetime.utcnow() - timedelta(minutes=15)
    
    active_students_count = db.query(models.User).filter(
        models.User.role.in_(["STUDENT", "ALUMNI", "TESTER"]),
        models.User.last_login >= live_threshold
    ).count()

    online_faculty_query = db.query(models.User).filter(
        models.User.role == "FACULTY",
        models.User.last_login >= live_threshold
    ).all()
    
    active_faculty_count = len(online_faculty_query)
    
    online_profs_payload = [{
        "id": prof.id,
        "name": f"{prof.honorific or 'Prof.'} {prof.last_name}",
        "subjects": prof.subjects or "General Aviation",
        "last_active": prof.last_login.strftime("%H:%M") if prof.last_login else "Online"
    } for prof in online_faculty_query]

    # 2. Vault Modules & Passing Rate
    total_modules = db.query(models.VaultAsset).filter(models.VaultAsset.type == "MODULE").count()
    
    total_records = db.query(models.SessionLog).count()
    passed_records = db.query(models.SessionLog).filter(models.SessionLog.passed == True).count()
    global_pass_rate = round((passed_records / total_records * 100), 1) if total_records > 0 else 0.0

    # 3. CAAP Licensure Readiness
    readiness_data = []
    categories = db.query(models.SessionLog.category).distinct().all()
    
    for cat in categories:
        cat_name = cat[0]
        if not cat_name:
            continue
        records = db.query(models.SessionLog).filter(models.SessionLog.category == cat_name).all()
        if records:
            avg_score = sum((r.score / r.total_items) * 100 for r in records if r.total_items > 0) / len(records)
            readiness_data.append({
                "subject": cat_name.upper(),
                "percentage": round(avg_score)
            })

    readiness_data.sort(key=lambda x: x["percentage"], reverse=True)

    # 4. Cohort Academic Breakdown
    cohort_breakdown = {}
    years = ["1st Year", "2nd Year", "3rd Year", "4th Year"]
    for y in years:
        cohort_students = db.query(models.User).filter(models.User.year_level == y, models.User.role == "STUDENT").all()
        cohort_ids = [s.id for s in cohort_students]
        
        cohort_logs = db.query(models.SessionLog).filter(models.SessionLog.student_id.in_(cohort_ids)).all() if cohort_ids else []
        cohort_passed = [l for l in cohort_logs if l.passed]
        
        rate = round((len(cohort_passed) / len(cohort_logs) * 100), 1) if cohort_logs else 0.0
        
        sections_map = {}
        for s in cohort_students:
            sec = s.section or "Unassigned"
            if sec not in sections_map:
                sections_map[sec] = {"total_students": 0, "logs": []}
            sections_map[sec]["total_students"] += 1
            
        for l in cohort_logs:
            student = next((s for s in cohort_students if s.id == l.student_id), None)
            sec = student.section if student and student.section else "Unassigned"
            if sec in sections_map:
                sections_map[sec]["logs"].append(l)

        final_sections = {}
        for sec, data in sections_map.items():
            sec_passed = [l for l in data["logs"] if l.passed]
            sec_rate = round((len(sec_passed) / len(data["logs"]) * 100), 1) if data["logs"] else 0.0
            final_sections[sec] = {
                "passing_rate": sec_rate,
                "student_count": data["total_students"],
                "total_attempts": len(data["logs"])
            }

        cohort_breakdown[y] = {
            "passing_rate": rate,
            "student_count": len(cohort_students),
            "sections": final_sections
        }

    # 5. Decode Alumni
    alumni_users = db.query(models.User).filter(models.User.role == "ALUMNI").all()
    alumni_data = []
    for a in alumni_users:
        try: extra = json.loads(a.suffix) if a.suffix else {}
        except: extra = {}
        alumni_data.append({
            "id": a.id, "name": f"{a.first_name} {a.last_name}",
            "batch": a.subjects or "Unknown Batch",
            "degree": extra.get("degree", "BSAMT"), "employment": extra.get("employment", "Unemployed"),
            "company": extra.get("company", "N/A"), "email": a.email
        })

    # 6. Decode Testers
    tester_users = db.query(models.User).filter(models.User.role == "TESTER").all()
    tester_data = []
    current_date = datetime.utcnow().date()
    for t in tester_users:
        try: extra = json.loads(t.suffix) if t.suffix else {}
        except: extra = {}
        end_str = extra.get("end", "")
        is_expired = False
        if end_str:
            try:
                if current_date > datetime.strptime(end_str, "%Y-%m-%d").date(): is_expired = True
            except: pass
        tester_data.append({
            "id": t.id, "name": f"{t.first_name} {t.last_name}",
            "institute": extra.get("institute", "Unknown"),
            "start": extra.get("start", "N/A"), "end": end_str or "N/A",
            "expired": is_expired, "email": t.email
        })

    # 7. Role-Filtered Telemetry
    log_query = db.query(models.SessionLog).order_by(models.SessionLog.timestamp.desc())
    if current_user.role == "FACULTY":
        assigned_subjects = [s.strip() for s in (current_user.subjects or "").split(",") if s.strip()]
        if assigned_subjects:
            log_query = log_query.filter(models.SessionLog.category.in_(assigned_subjects))
            
    recent_logs = log_query.limit(50).all()
    formatted_logs = []
    for log in recent_logs:
        student = db.query(models.User).filter(models.User.id == log.student_id).first()
        student_name = f"{student.last_name}, {student.first_name[0]}." if student else "Unknown"
        score_percent = f"{round((log.score / log.total_items) * 100)}%" if log.total_items > 0 else "0%"
        action_text = f"{'Passed' if log.passed else 'Failed'} {log.quiz_id}"
        time_str = log.timestamp.strftime("%H:%M") if log.timestamp else "Just now"

        formatted_logs.append({
            "student": f"{student_name} ({log.student_id})",
            "student_id": log.student_id,
            "student_name": student_name,
            "action": action_text,
            "score": score_percent,
            "time": time_str,
            "category": log.category or "GENERAL",
            "quiz_id": log.quiz_id
        })

    return {
        "metrics": {
            "active_students": active_students_count,
            "total_students": total_students,
            "active_faculty": active_faculty_count,
            "total_faculty": total_faculty,
            "modules": total_modules,
            "pass_rate": global_pass_rate
        },
        "online_profs": online_profs_payload,
        "cohort_breakdown": cohort_breakdown,
        "readiness": readiness_data,
        "alumni": alumni_data,
        "testers": tester_data,
        "logs": formatted_logs
    }

@router.get("/jurisdictional/{prof_id}", dependencies=[Depends(require_role(["ADMIN", "FACULTY"]))])
def get_jurisdictional_analytics(prof_id: str, db: Session = Depends(get_db)):
    prof = db.query(models.User).filter(models.User.id == prof_id).first()
    if not prof or prof.role != "FACULTY":
        raise HTTPException(status_code=404, detail="Faculty member not found.")

    assigned_subjects = [s.strip() for s in (prof.subjects or "").split(",") if s.strip()]
    
    if not assigned_subjects:
        return {"years": [], "sections": {}, "students": []}

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

class QuizSubmitRequest(BaseModel):
    student_id: str
    quiz_id: str      
    category: str      
    difficulty: str   
    score: int
    total_items: int

@router.post("/submit-quiz", dependencies=[Depends(require_role(["STUDENT", "FACULTY", "ADMIN", "TESTER"]))])
async def submit_quiz(req: QuizSubmitRequest, db: Session = Depends(get_db)):
    try:
        passed = (req.score / req.total_items) >= 0.75 if req.total_items > 0 else False
        
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

        await manager.broadcast({
            "event": "NEW_TELEMETRY",
            "message": f"Student {req.student_id} completed {req.quiz_id}."
        })

        return {"status": "success", "message": "Quiz telemetry synced."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/student/{student_id}", dependencies=[Depends(require_role(["STUDENT", "FACULTY", "ADMIN", "TESTER"]))])
def get_student_analytics(student_id: str, db: Session = Depends(get_db)):
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