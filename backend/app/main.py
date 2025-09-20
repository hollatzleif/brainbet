from fastapi import FastAPI
from fastapi.responses import PlainTextResponse
from .database import Base, engine
from .routers import auth

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI()

# Register routers
app.include_router(auth.router)

# Health check route
@app.get("/api/health", response_class=PlainTextResponse)
def health():
    return "ok"
