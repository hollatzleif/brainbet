from fastapi import FastAPI
from fastapi.responses import PlainTextResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from .database import Base, engine
from .routers import auth

# Create database tables
Base.metadata.create_all(bind=engine)

# Initialize FastAPI app
app = FastAPI()

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

# ---------- TEMPORARY RESET ROUTE ----------
@app.get("/api/reset-users")
def reset_users():
    """
    TEMPORARY: Drops the users table so SQLAlchemy can recreate it
    with the correct structure.
    """
    with engine.connect() as conn:
        conn.execute(text("DROP TABLE IF EXISTS users CASCADE;"))
        conn.commit()
    return {"message": "Users table dropped. Restart the server now."}
# -------------------------------------------
