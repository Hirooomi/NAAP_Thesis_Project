from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
import random
import datetime
import re

import models
import security
import email_service
from database import get_db
from dependencies import get_current_user # THE FIX: Centralized Security

router = APIRouter(prefix="/api/auth", tags=["Core Authentication"])

class LoginPayload(BaseModel):
    user_id: str
    password: str

class PasswordResetRequestPayload(BaseModel):
    email: str

class OTPVerifyPayload(BaseModel):
    email: str
    otp: str
    new_password: str

class AuthOTPRequestPayload(BaseModel):
    user_id: str

class AuthPasswordUpdatePayload(BaseModel):
    user_id: str
    old_password: str
    otp: str
    new_password: str

# THE FIX: Enterprise Password Validation Engine
def validate_password_strength(password: str):
    if len(password) < 7 or len(password) > 16:
        raise HTTPException(status_code=400, detail="Password must be exactly 7 to 16 characters in length.")
    if not re.search(r"[A-Z]", password):
        raise HTTPException(status_code=400, detail="Password must contain at least one uppercase letter.")
    if not re.search(r"[a-z]", password):
        raise HTTPException(status_code=400, detail="Password must contain at least one lowercase letter.")
    if not re.search(r"\d", password):
        raise HTTPException(status_code=400, detail="Password must contain at least one number.")
    if not re.search(r"[^A-Za-z0-9]", password):
        raise HTTPException(status_code=400, detail="Password must contain at least one special character or space.")

@router.post("/login")
def login(payload: LoginPayload, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == payload.user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid Credentials or ID not found.")

    if not security.verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid Credentials or Password.")

    token_payload = {"sub": user.id, "role": user.role}
    token = security.create_access_token(data=token_payload)

    user.last_login = datetime.datetime.utcnow()
    db.commit()

    full_name = f"{user.first_name} {user.last_name}"
    if user.role == "FACULTY" and user.honorific:
        full_name = f"{user.honorific} {user.last_name}, {user.first_name}"

    is_temp_pass = payload.password.startswith("NAAP-")

    return {
        "token": token,
        "role": user.role,
        "id": user.id,
        "name": full_name,
        "require_password_change": is_temp_pass
    }

@router.post("/forgot-password")
def request_password_reset(payload: PasswordResetRequestPayload, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == payload.email).first()
    if not user:
        return {"status": "success", "message": "If the email is registered, an OTP has been dispatched."}

    now = datetime.datetime.utcnow()
    
    # THE FIX: Persistent Anti-Spam Check via Database
    recent_otp = db.query(models.OTP_Token).filter(models.OTP_Token.user_id == user.id).order_by(models.OTP_Token.created_at.desc()).first()
    if recent_otp and (now - recent_otp.created_at).total_seconds() < 300: 
        raise HTTPException(status_code=429, detail="Anti-Spam active. Please wait 5 minutes before requesting a new OTP.")

    # Purge old tokens to prevent buildup
    db.query(models.OTP_Token).filter(models.OTP_Token.user_id == user.id).delete()

    otp_code = "".join(random.choices("0123456789", k=6))
    expiration = now + datetime.timedelta(minutes=10) 
    
    # THE FIX: Hash the OTP before inserting it into the persistent DB
    hashed_otp = security.get_password_hash(otp_code)
    new_token = models.OTP_Token(user_id=user.id, hashed_token=hashed_otp, expiration_timestamp=expiration)
    db.add(new_token)
    db.commit()

    try:
        email_service.dispatch_global_announcement(
            header="NAAP AMT: Secure Password Reset Request",
            message=f"Hello {user.first_name}.\n\nYou requested a password reset. Your secure 6-digit verification code is:\n\n{otp_code}\n\nThis code will expire in 10 minutes. If you did not make this request, secure your account immediately.",
            severity="MODERATE",
            recipient_emails=[user.email]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail="Mail dispatch failure. Check SMTP configurations.")

    return {"status": "success", "message": "OTP successfully dispatched."}

@router.post("/verify-reset-otp")
def verify_otp_and_reset_password(payload: OTPVerifyPayload, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User account no longer found in registry database.")

    # THE FIX: Query the DB for the token
    token_record = db.query(models.OTP_Token).filter(models.OTP_Token.user_id == user.id).first()
    if not token_record:
        raise HTTPException(status_code=400, detail="No active password reset workflow found for this email.")

    if datetime.datetime.utcnow() > token_record.expiration_timestamp:
        db.delete(token_record)
        db.commit()
        raise HTTPException(status_code=400, detail="The OTP verification window has expired. Please request a new code.")

    if not security.verify_password(payload.otp, token_record.hashed_token):
        raise HTTPException(status_code=400, detail="Invalid OTP code verification failure.")

    validate_password_strength(payload.new_password)

    user.hashed_password = security.get_password_hash(payload.new_password)
    db.delete(token_record)
    db.commit()

    return {"status": "success", "message": "Password updated successfully in database."}

# ====================================================
# AUTHENTICATED COMMAND CENTER SECURITY ROUTES
# ====================================================

@router.post("/request-auth-otp")
def request_auth_otp(payload: AuthOTPRequestPayload, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # Security: Verify the token matches the requested user ID
    if current_user.id != payload.user_id and current_user.role != "HEAD_ADMIN":
        raise HTTPException(status_code=403, detail="Unauthorized attempt to request OTP for another user.")

    user = db.query(models.User).filter(models.User.id == payload.user_id).first()
    if not user.email:
        raise HTTPException(status_code=404, detail=f"No email is registered to User ID: '{payload.user_id}'.")

    now = datetime.datetime.utcnow()
    
    recent_otp = db.query(models.OTP_Token).filter(models.OTP_Token.user_id == user.id).order_by(models.OTP_Token.created_at.desc()).first()
    if recent_otp and (now - recent_otp.created_at).total_seconds() < 300: 
        raise HTTPException(status_code=429, detail="Anti-Spam active. Please wait 5 minutes before requesting a new OTP.")

    db.query(models.OTP_Token).filter(models.OTP_Token.user_id == user.id).delete()

    otp_code = "".join(random.choices("0123456789", k=6))
    expiration = now + datetime.timedelta(minutes=10)

    new_token = models.OTP_Token(user_id=user.id, hashed_token=security.get_password_hash(otp_code), expiration_timestamp=expiration)
    db.add(new_token)
    db.commit()

    try:
        email_service.dispatch_global_announcement(
            header="NAAP AMT: Secure Profile Password Change",
            message=f"Hello {user.first_name}.\n\nYou requested to change your password from within your Command Center. Your secure verification code is:\n\n{otp_code}\n\nThis code expires in 10 minutes.",
            severity="MODERATE",
            recipient_emails=[user.email]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail="Mail dispatch failure. Check SMTP settings.")

    return {"status": "success", "message": f"OTP successfully dispatched to {user.email}"}

@router.post("/update-password")
def update_password(payload: AuthPasswordUpdatePayload, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.id != payload.user_id and current_user.role != "HEAD_ADMIN":
        raise HTTPException(status_code=403, detail="Unauthorized password change.")

    user = db.query(models.User).filter(models.User.id == payload.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    if not security.verify_password(payload.old_password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Current password verification failed.")

    token_record = db.query(models.OTP_Token).filter(models.OTP_Token.user_id == user.id).first()
    if not token_record:
        raise HTTPException(status_code=400, detail="No active OTP request found. Please request a new code.")

    if datetime.datetime.utcnow() > token_record.expiration_timestamp:
        db.delete(token_record)
        db.commit()
        raise HTTPException(status_code=400, detail="OTP expired. Please request a new code.")

    if not security.verify_password(payload.otp, token_record.hashed_token):
        raise HTTPException(status_code=400, detail="Invalid OTP code.")

    validate_password_strength(payload.new_password)

    user.hashed_password = security.get_password_hash(payload.new_password)
    db.delete(token_record)
    db.commit()

    return {"status": "success", "message": "Password secured and updated."}