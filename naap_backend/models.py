from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, Text
from sqlalchemy.sql import func
from database import Base
from datetime import datetime

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True) 
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    first_name = Column(String)
    last_name = Column(String)
    
    role = Column(String, nullable=False) # HEAD_ADMIN, ADMIN, FACULTY, STUDENT
    
    # Admin Specific
    admin_clearance = Column(String, nullable=True) 
    functional_roles = Column(String, nullable=True) 
    
    # Faculty Specific
    honorific = Column(String, nullable=True)
    suffix = Column(String, nullable=True)
    subjects = Column(String, nullable=True) 
    
    # Student Specific
    year_level = Column(String, nullable=True)
    section = Column(String, nullable=True)
    
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Live Telemetry Tracking
    last_login = Column(DateTime(timezone=True), nullable=True)

class PendingApproval(Base):
    __tablename__ = "pending_approvals"
    
    id = Column(String, primary_key=True, index=True)
    entity_type = Column(String) 
    requested_by = Column(String) 
    payload_data = Column(Text) 
    created_at = Column(DateTime(timezone=True), server_default=func.now())

# ==========================================
# PHASE 1 FIX: UPGRADED AI SUPPORT TICKETS
# ==========================================
class SupportTicket(Base):
    __tablename__ = "support_tickets"
    
    id = Column(String, primary_key=True, index=True) # e.g., TKT-10293
    requester_id = Column(String, ForeignKey("users.id"), index=True)
    requester_role = Column(String, nullable=False) # e.g., STUDENT or FACULTY
    
    issue_type = Column(String, nullable=False) # e.g., 'Password Reset', 'Module Not Loading'
    issue_text = Column(Text, nullable=False)
    
    # AI Automation Fields
    ai_triage_folder = Column(String, nullable=True) # URGENT, MODERATE, IMPORTANT
    priority_level = Column(String, default="NORMAL") # Automatically set to URGENT if Faculty
    status = Column(String, default="OPEN") # OPEN, PROCESSING, RESOLVED
    assigned_to = Column(String, nullable=True) # ID of specific Admin handling it
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

# ==========================================
# PHASE 1 FIX: SECURE OTP TOKEN TRACKING
# ==========================================
class OTP_Token(Base):
    __tablename__ = "otp_tokens"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    hashed_token = Column(String, nullable=False)
    expiration_timestamp = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    action = Column(String) 
    target_id = Column(String) 
    performed_by = Column(String)
    reason = Column(Text, nullable=True) 
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

# Global Communications Table with RBAC Tracking
class Announcement(Base):
    __tablename__ = "announcements"

    id = Column(String, primary_key=True, index=True)
    header = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    severity = Column(String, nullable=False)
    schedule_date = Column(String, nullable=True)
    author = Column(String, nullable=False)
    dispatched_via_email = Column(Boolean, default=False)
    
    # --- RBAC MAKER-CHECKER FIELDS ---
    status = Column(String, default="APPROVED") # Options: PENDING, APPROVED, REJECTED
    requested_by_id = Column(String, nullable=True) # ID of Tier 3/2 Admin who drafted it
    approved_by_id = Column(String, nullable=True) # ID of Tier 1/0 Admin who authorized it

    created_at = Column(DateTime(timezone=True), server_default=func.now())

# UI Editor Version Control Table
class UICommit(Base):
    __tablename__ = "ui_commits"

    id = Column(String, primary_key=True, index=True)
    author = Column(String, nullable=False)
    file_name = Column(String, nullable=False)
    code_snapshot = Column(Text, nullable=False)
    
    # RBAC Status: PENDING_REVIEW (Tier 3/2), AWAITING_HEAD_ADMIN (Tier 1), DEPLOYED (Tier 0)
    status = Column(String, default="PENDING_REVIEW") 
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

# Pre-approved Whitelist for Self-Registration
class WhitelistedStudent(Base):
    __tablename__ = "whitelisted_students"

    id = Column(String, primary_key=True, index=True) # The Student ID (e.g. 12324MN-000480)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    is_claimed = Column(Boolean, default=False) # Flips to True once they register
    year_level = Column(String) 
    section = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

# Database Vault Assets (Modules & Quizzes)
class VaultAsset(Base):
    __tablename__ = "vault_assets"

    id = Column(String, primary_key=True, index=True) # e.g., MOD-1234 or QZ-5678
    type = Column(String, nullable=False) # 'MODULE' or 'QUIZ'
    title = Column(String, nullable=False)
    author = Column(String, nullable=False)
    category = Column(String, nullable=False) # The 7 CAAP Subjects
    
    # RBAC Status: ACTIVE, GHOSTED (Soft Purged), ARCHIVED
    status = Column(String, default="ACTIVE") 
    
    questions = Column(Integer, default=0) # Only used if type is 'QUIZ'
    content_payload = Column(Text, nullable=True) # The raw RAG chunks or Quiz JSON
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

# ==========================================
# PHASE 1 FIX: UPGRADED SESSION LOG
# ==========================================
class SessionLog(Base):
    __tablename__ = "session_logs"

    id = Column(String, primary_key=True, index=True) 
    student_id = Column(String, nullable=False)
    quiz_id = Column(String, nullable=False) 
    category = Column(String, nullable=False) 
    difficulty = Column(String, nullable=False) # Captures 'Lvl 1: Pre-Test', 'CAAP', etc.
    
    score = Column(Integer, nullable=False)
    total_items = Column(Integer, nullable=False)
    passed = Column(Boolean, nullable=False) 
    
    # AI Automation Triggers
    is_ai_reviewed = Column(Boolean, default=False)
    score_disputed = Column(Boolean, default=False)
    
    timestamp = Column(DateTime(timezone=True), server_default=func.now())