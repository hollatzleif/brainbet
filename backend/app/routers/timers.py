
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from .. import database, models, utils

router = APIRouter(prefix="/timers", tags=["timers"])

def now_utc() -> datetime:
    return datetime.now(timezone.utc)

@router.get("/me")
def my_timer(db: Session = Depends(database.get_db), email: str = Depends(utils.get_current_user_email)):
    user = utils.get_user_by_email(db, email)
    timer = db.query(models.Timer).filter(models.Timer.user_id == user.id).order_by(models.Timer.id.desc()).first()
    if not timer:
        return {'status': 'stopped', 'elapsed_seconds': 0, 'start_time': None}

    # calc elapsed live if running
    elapsed = int(timer.elapsed_seconds or 0)
    if timer.status == "running" and timer.start_time:
        start = timer.start_time
        if start.tzinfo is None:
            start = start.replace(tzinfo=timezone.utc)
        elapsed += int((now_utc() - start).total_seconds())
    return {
        'status': timer.status,
        'elapsed_seconds': elapsed,
        'start_time': timer.start_time.isoformat() if timer.start_time else None
    }

@router.post("/start")
def start_timer(db: Session = Depends(database.get_db), email: str = Depends(utils.get_current_user_email)):
    user = utils.get_user_by_email(db, email)
    # Prevent two running timers
    running = db.query(models.Timer).filter(models.Timer.user_id==user.id, models.Timer.status=="running").first()
    if running:
        raise HTTPException(status_code=400, detail="Timer is already running")
    paused = db.query(models.Timer).filter(models.Timer.user_id==user.id, models.Timer.status=="paused").order_by(models.Timer.id.desc()).first()
    if paused:
        paused.status = "running"
        paused.start_time = now_utc()
        db.add(paused); db.commit(); db.refresh(paused)
        return {'message': 'Timer resumed', 'status': 'running'}

    timer = models.Timer(user_id=user.id, status="running", start_time=now_utc(), elapsed_seconds=0)
    db.add(timer); db.commit(); db.refresh(timer)
    return {'message': 'Timer started', 'status': 'running'}

@router.post("/pause")
def pause_timer(db: Session = Depends(database.get_db), email: str = Depends(utils.get_current_user_email)):
    user = utils.get_user_by_email(db, email)
    timer = db.query(models.Timer).filter(models.Timer.user_id==user.id, models.Timer.status=="running").first()
    if not timer:
        raise HTTPException(status_code=400, detail="No running timer")
    if timer.start_time:
        start = timer.start_time
        if start.tzinfo is None:
            start = start.replace(tzinfo=timezone.utc)
        timer.elapsed_seconds += int((now_utc() - start).total_seconds())
    timer.start_time = None
    timer.status = "paused"
    db.add(timer); db.commit()
    return {'message': 'Timer paused', 'status': 'paused', 'elapsed_seconds': timer.elapsed_seconds}

@router.post("/stop")
def stop_timer(cap_seconds: int | None = None, db: Session = Depends(database.get_db), email: str = Depends(utils.get_current_user_email)):
    user = utils.get_user_by_email(db, email)
    timer = db.query(models.Timer).filter(models.Timer.user_id==user.id).order_by(models.Timer.id.desc()).first()
    if not timer or timer.status not in ("running","paused"):
        raise HTTPException(status_code=400, detail="No active timer")
    # finalize
    if timer.status == "running" and timer.start_time:
        start = timer.start_time
        if start.tzinfo is None:
            start = start.replace(tzinfo=timezone.utc)
        timer.elapsed_seconds += int((now_utc() - start).total_seconds())
    # optional cap (client-driven countdown)
    if cap_seconds is not None:
        try:
            cap = int(cap_seconds)
        except Exception:
            raise HTTPException(status_code=400, detail="invalid cap_seconds")
        # hard upper bound (2h) to avoid abuse via client param
        cap = max(60, min(7200, cap))
        timer.elapsed_seconds = min(timer.elapsed_seconds, cap)

    timer.status = "stopped"
    timer.start_time = None
    elapsed = int(timer.elapsed_seconds or 0)

    # Coins
    ul = utils.get_or_create_user_level(db, user.id)
    wallet = utils.get_or_create_wallet(db, user.id)
    multiplier = utils.level_to_multiplier(ul.level)

    full_blocks = elapsed // 180
    base_coins = float(full_blocks)
    earned = round(base_coins * float(multiplier), 2)
    wallet.coins = round(float(wallet.coins) + earned, 2)

    db.add(wallet); db.add(timer); db.commit(); db.refresh(timer)

    return {
        'message': 'Timer stopped',
        'status': 'stopped',
        'elapsed_seconds': elapsed,
        'base_coins': base_coins,
        'level': ul.level,
        'multiplier': multiplier,
        'earned_coins': earned,
        'wallet_total': wallet.coins
    }

# Keep compatibility endpoints for attention check (no-ops if you don't use them)
@router.post("/check/start")
def start_attention_check(window_seconds: int = 120, db: Session = Depends(database.get_db), email: str = Depends(utils.get_current_user_email)):
    return {'message': 'check_started', 'deadline': int(window_seconds)}

@router.post("/check/confirm")
def confirm_attention_check(db: Session = Depends(database.get_db), email: str = Depends(utils.get_current_user_email)):
    return {'message': 'check_confirmed', 'invalidated': False}
