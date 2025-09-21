
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from . import utils
from .. import database, models

router = APIRouter(prefix="/users", tags=["Users"])

@router.get("/me")
def me(db: Session = Depends(database.get_db), email: str = Depends(utils.get_current_user_email)):
    user = utils.get_user_by_email(db, email)
    ul = utils.get_or_create_user_level(db, user.id)
    w = utils.get_or_create_wallet(db, user.id)
    multiplier = utils.level_to_multiplier(ul.level)
    return {
        "username": user.username,
        "email": user.email,
        "level": ul.level,
        "multiplier": multiplier,
        "coins": w.coins,
    }
