
from fastapi import Header, HTTPException
from jose import jwt
from sqlalchemy.orm import Session

from . import models, database

def get_current_user_email(authorization: str | None = Header(default=None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, key='', options={'verify_signature': False})
        email = payload.get("sub")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
    if not email:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    return email

def get_user_by_email(db: Session, email: str) -> models.User:
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

def get_or_create_user_level(db: Session, user_id: int) -> models.UserLevel:
    ul = db.query(models.UserLevel).filter(models.UserLevel.user_id == user_id).first()
    if not ul:
        ul = models.UserLevel(user_id=user_id, level=1)
        db.add(ul); db.commit(); db.refresh(ul)
    return ul

def get_or_create_wallet(db: Session, user_id: int) -> models.UserWallet:
    w = db.query(models.UserWallet).filter(models.UserWallet.user_id == user_id).first()
    if not w:
        w = models.UserWallet(user_id=user_id, coins=0.0)
        db.add(w); db.commit(); db.refresh(w)
    return w

def level_to_multiplier(level: int) -> float:
    if level <= 1:
        return 1.0
    if level == 2:
        return 1.2
    # Level 3 -> 1.3, ab dann +0.1 pro Level
    return 1.3 + 0.1 * max(0, level - 3)
