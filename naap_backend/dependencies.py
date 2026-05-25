from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from jose import jwt, JWTError
import os

import models
import security
from database import get_db

# Intercepts the Authorization: Bearer <token> header
security_scheme = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security_scheme), db: Session = Depends(get_db)):
    token = credentials.credentials
    try:
        # Assumes your security.py exports SECRET_KEY and ALGORITHM
        secret = getattr(security, "SECRET_KEY", os.getenv("SECRET_KEY", "your-super-secret-naap-key"))
        algo = getattr(security, "ALGORITHM", "HS256")
        
        payload = jwt.decode(token, secret, algorithms=[algo])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid authentication token payload.")
    except JWTError:
        raise HTTPException(status_code=401, detail="Session expired or token invalid. Please log in again.")
        
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User account missing or deleted from registry.")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is suspended.")
        
    return user

def require_role(allowed_roles: list):
    """Factory dependency to enforce strict Role-Based Access Control (RBAC)"""
    def role_checker(user: models.User = Depends(get_current_user)):
        # HEAD_ADMIN acts as Tier 0 System Override
        if user.role not in allowed_roles and user.role != "HEAD_ADMIN":
            raise HTTPException(status_code=403, detail=f"Clearance Denied. Operation requires roles: {allowed_roles}")
        return user
    return role_checker