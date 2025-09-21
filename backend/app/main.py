from fastapi import FastAPI
from fastapi.responses import PlainTextResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from .database import Base, engine
from .routers import auth, timers, users

# Create database tables
Base.metadata.create_all(bind=engine)

# Initialize FastAPI app
app = FastAPI()

app.include_router(auth.router)
app.include_router(timers.router)
app.include_router(users.router)

# ---------- CORS CONFIGURATION ----------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Temporarily allow all origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# ---------------------------------------

# Register routers
app.include_router(auth.router)

# Health check route
@app.get("/api/health", response_class=PlainTextResponse)
def health():
    return "ok"


# --- lightweight startup migration for timers attention-check columns ---
@app.on_event("startup")
def _auto_migrate_attention_checks():
    try:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE timers ADD COLUMN IF NOT EXISTS pending_check_started_at TIMESTAMPTZ"))
            conn.execute(text("ALTER TABLE timers ADD COLUMN IF NOT EXISTS pending_check_deadline TIMESTAMPTZ"))
            conn.execute(text("ALTER TABLE timers ADD COLUMN IF NOT EXISTS invalidated BOOLEAN NOT NULL DEFAULT FALSE"))
    except Exception as e:
        # Don't crash app on migration issues; logs on Render will show the error
        print("Startup migration warning:", e)
