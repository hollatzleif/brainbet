
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

# idempotent startup migrations (no model changes required)
@app.on_event("startup")
def _auto_migrate_columns():
    try:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE IF EXISTS timers ADD COLUMN IF NOT EXISTS pending_check_started_at TIMESTAMPTZ"))
            conn.execute(text("ALTER TABLE IF EXISTS timers ADD COLUMN IF NOT EXISTS pending_check_deadline TIMESTAMPTZ"))
            conn.execute(text("ALTER TABLE IF EXISTS timers ADD COLUMN IF NOT EXISTS invalidated BOOLEAN NOT NULL DEFAULT FALSE"))
            conn.execute(text("ALTER TABLE IF EXISTS timers ADD COLUMN IF NOT EXISTS target_seconds INTEGER"))
            conn.execute(text("ALTER TABLE IF EXISTS timers ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ"))
            conn.execute(text("ALTER TABLE IF EXISTS timers ADD COLUMN IF NOT EXISTS remaining_seconds INTEGER"))
    except Exception as e:
        print("Startup migration warning:", e)
