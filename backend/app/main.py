
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from .database import engine
from .routers import auth, users, timers

app = FastAPI(title="brainbet")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(timers.router)

@app.get("/")
def root():
    return {"status": "ok"}

# Idempotent, lightweight startup migrations for columns referenced by ORM/routers
@app.on_event("startup")
def _auto_migrate_columns():
    try:
        with engine.begin() as conn:
            # Use correct PostgreSQL syntax: ALTER TABLE <name> ADD COLUMN IF NOT EXISTS ...
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()"))
            conn.execute(text("ALTER TABLE wallets ADD COLUMN IF NOT EXISTS coins DOUBLE PRECISION DEFAULT 0"))
            conn.execute(text("ALTER TABLE user_levels ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1"))
            conn.execute(text("ALTER TABLE timers ADD COLUMN IF NOT EXISTS pending_check_started_at TIMESTAMPTZ"))
            conn.execute(text("ALTER TABLE timers ADD COLUMN IF NOT EXISTS pending_check_deadline TIMESTAMPTZ"))
            conn.execute(text("ALTER TABLE timers ADD COLUMN IF NOT EXISTS invalidated BOOLEAN NOT NULL DEFAULT FALSE"))
            conn.execute(text("ALTER TABLE timers ADD COLUMN IF NOT EXISTS target_seconds INTEGER"))
            conn.execute(text("ALTER TABLE timers ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ"))
            conn.execute(text("ALTER TABLE timers ADD COLUMN IF NOT EXISTS remaining_seconds INTEGER"))
    except Exception as e:
        print("Startup migration warning:", e)
