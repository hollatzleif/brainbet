from fastapi import FastAPI
from fastapi.responses import PlainTextResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from .database import Base, engine
from .routers import auth, timers

# Create database tables
Base.metadata.create_all(bind=engine)

# Initialize FastAPI app
app = FastAPI()

app.include_router(auth.router)
app.include_router(timers.router)

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

