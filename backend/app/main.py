from fastapi import FastAPI
from .database import Base, engine
from .routers import auth

# Tabellen anlegen
Base.metadata.create_all(bind=engine)

app = FastAPI()

# Router registrieren
app.include_router(auth.router)
