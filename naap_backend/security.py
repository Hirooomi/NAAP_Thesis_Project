import bcrypt
from jose import jwt
from datetime import datetime, timedelta

# Core Security Settings
SECRET_KEY = "NAAP_AMT_SUPER_SECRET_KEY_THESIS_DEFENSE"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440 # 24 hours

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plain password against the stored hash using modern bcrypt."""
    try:
        # bcrypt strictly requires bytes, so we encode the strings
        return bcrypt.checkpw(
            plain_password.encode('utf-8'), 
            hashed_password.encode('utf-8')
        )
    except Exception:
        # If the hash is corrupted or invalid, safely return False
        return False

def get_password_hash(password: str) -> str:
    """Generates a secure hash using modern bcrypt."""
    # THE FIX: Lowered the bcrypt work factor (rounds) to 4 for lightning-fast execution.
    # This prevents the CPU from intentionally stalling for 3-5 seconds during login/updates.
    salt = bcrypt.gensalt(rounds=4)
    hashed_bytes = bcrypt.hashpw(password.encode('utf-8'), salt)
    
    # Decode the bytes back to a string so SQLAlchemy can save it to the database
    return hashed_bytes.decode('utf-8')

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(token: str):
    """
    Lightweight JWT validator for WebSocket connections.
    Returns the user ID (sub) if valid, or None if expired/invalid.
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload.get("sub") 
    except Exception:
        # If the token is expired or manipulated, reject it safely
        return None