import os
from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# THE FIX: We MUST use NullPool for SQLite when using WebSockets. 
# QueuePool causes SQLite to lock up during 'db.commit()' writes (like logins).
from sqlalchemy.pool import NullPool 

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "naap_persistent.db")

SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_PATH}"

# THE FIX: NullPool ensures connections are instantly closed and returned to the OS.
# timeout=15 ensures it fails fast rather than making you wait 30 seconds.
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, 
    connect_args={
        "check_same_thread": False, 
        "timeout": 15
    },
    poolclass=NullPool
)

@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.execute("PRAGMA mmap_size=3000000000") # Keeps extreme read speeds
    cursor.execute("PRAGMA busy_timeout=5000") # Don't wait longer than 5 seconds for a lock
    cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()