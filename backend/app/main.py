from fastapi import FastAPI
from fastapi.responses import PlainTextResponse
from .database import Base, engine
from .routers import auth

# Tabellen anlegen
Base.metadata.create_all(bind=engine)

app = FastAPI()

# Router registrieren
app.include_router(auth.router)

# Healthcheck-Route
@app.get("/api/health", response_class=PlainTextResponse)
def health():
    return "ok"
