from fastapi import FastAPI
from fastapi.responses import PlainTextResponse
from fastapi.middleware.cors import CORSMiddleware
from .database import Base, engine
from .routers import auth

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI()

# ---------- CORS CONFIGURATION ----------
# During development, allow all origins:
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # You can replace "*" with your Netlify URL later
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
