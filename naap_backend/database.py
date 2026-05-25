import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# 1. Lock the database strictly to the absolute path of your backend folder
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "naap_persistent.db")

# 2. The Local Persistent Engine
SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_PATH}"

# ==========================================
# PRODUCTION POSTGRESQL UPGRADE (When you are ready)
# SQLALCHEMY_DATABASE_URL = "postgresql://postgres:yourpassword@localhost:5432/naap_db"
# ==========================================

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Dependency to get the database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()