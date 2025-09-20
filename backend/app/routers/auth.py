from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from jose import jwt
from datetime import datetime, timedelta

from .. import models, database

router = APIRouter(
    prefix="/auth",
    tags=["Auth"]
)

# Passwort Hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT Settings
SECRET_KEY = "mein_geheimes_token"  # später als ENV-Variable setzen!
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30


def hash_password(password: str):
    return pwd_context.hash(password)


def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


# ---------- ROUTES ----------

@router.post("/signup")
def signup(username: str, email: str, password: str, db: Session = Depends(database.get_db)):
    # E-Mail prüfen
    if db.query(models.User).filter(models.User.email == email).first():
        raise HTTPException(status_code=400, detail="Email bereits registriert, bitte einloggen.")

    # Username prüfen
    if db.query(models.User).filter(models.User.username == username).first():
        raise HTTPException(status_code=400, detail="Benutzername bereits vergeben.")

    hashed_pw = hash_password(password)
    new_user = models.User(username=username, email=email, hashed_password=hashed_pw)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": "User erfolgreich erstellt. Bitte einloggen."}


@router.post("/login")
def login(email: str, password: str, db: Session = Depends(database.get_db)):
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        raise HTTPException(status_code=400, detail="Email nicht gefunden. Bitte registrieren.")
    if not verify_password(password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Passwort stimmt nicht.")

    token = create_access_token({"sub": user.email})
    return {"access_token": token, "token_type": "bearer"}
