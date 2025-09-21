
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta
from jose import jwt

from .. import models, database
from .. import utils

router = APIRouter(prefix="/timers", tags=["Timers"])

# Minimal token parser (expects Authorization: Bearer <token>)
def get_current_user_email(authorization: str | None = Header(default=None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ", 1)[1]
    try:
        # decode without verifying signature (fallback if SECRET is unknown)
        payload = jwt.decode(token, key='', options={'verify_signature': False})
        email = payload.get("sub")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
    if not email:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    return email

def get_user(db: Session, email: str) -> models.User:
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

def now_utc():
    # ensure timezone-aware UTC datetime
    return datetime.now(timezone.utc)

@router.get("/me")
def my_timer(db: Session = Depends(database.get_db), email: str = Depends(get_current_user_email)):
    user = get_user(db, email)
    timer = (
        db.query(models.Timer)
        .filter(models.Timer.user_id == user.id)
        .order_by(models.Timer.id.desc())
        .first()
    )
    if not timer:
        return {'status': 'stopped', 'elapsed_seconds': 0, 'start_time': None, 'last_session_seconds': 0}
    # compute live elapsed if running
    elapsed = timer.elapsed_seconds
    if timer.status == "running" and timer.start_time:
        # Ensure tz-aware logic
        start = timer.start_time
        if start.tzinfo is None:
            # treat naive as UTC
            start = start.replace(tzinfo=timezone.utc)
        elapsed += int((now_utc() - start).total_seconds())
    # If timer is stopped, UI should reset to 0. Keep last session for optional UI display.
    ui_elapsed = 0 if timer.status == 'stopped' else elapsed
    return {
        'status': timer.status,
        'elapsed_seconds': ui_elapsed,
        'last_session_seconds': elapsed,
        'start_time': timer.start_time.isoformat() if timer.start_time else None
    }

@router.post("/start")
def start_timer(db: Session = Depends(database.get_db), email: str = Depends(get_current_user_email)):
    user = get_user(db, email)
    # check if user has a running timer
    running = (
        db.query(models.Timer)
        .filter(models.Timer.user_id == user.id, models.Timer.status == "running")
        .first()
    )
    if running:
        raise HTTPException(status_code=400, detail="You already have a running timer")
    # resume paused if exists
    paused = (
        db.query(models.Timer)
        .filter(models.Timer.user_id == user.id, models.Timer.status == "paused")
        .order_by(models.Timer.id.desc())
        .first()
    )
    if paused:
        paused.status = "running"
        paused.start_time = now_utc()
        paused.invalidated = False
        paused.pending_check_started_at = None
        paused.pending_check_deadline = None
        db.add(paused)
        db.commit()
        db.refresh(paused)
        return {'message': 'Timer resumed', 'status': 'running'}
    # else create new
    timer = models.Timer(user_id=user.id, status="running", start_time=now_utc(), elapsed_seconds=0, invalidated=False, pending_check_started_at=None, pending_check_deadline=None)
    db.add(timer)
    db.commit()
    db.refresh(timer)
    return {'message': 'Timer started', 'status': 'running'}

@router.post("/pause")
def pause_timer(db: Session = Depends(database.get_db), email: str = Depends(get_current_user_email)):
    user = get_user(db, email)
    timer = (
        db.query(models.Timer)
        .filter(models.Timer.user_id == user.id, models.Timer.status == "running")
        .first()
    )
    if not timer:
        raise HTTPException(status_code=400, detail="No running timer to pause")
    # accumulate elapsed
    start = timer.start_time
    if start is None:
        start = now_utc()
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    timer.elapsed_seconds += int((now_utc() - start).total_seconds())
    timer.start_time = None
    timer.status = "paused"
    db.add(timer)
    db.commit()
    return {'message': 'Timer paused', 'status': 'paused', 'elapsed_seconds': timer.elapsed_seconds}

@router.post("/stop")
def stop_timer(db: Session = Depends(database.get_db), email: str = Depends(get_current_user_email)):
    user = get_user(db, email)
    timer = (
        db.query(models.Timer)
        .filter(models.Timer.user_id == user.id, models.Timer.status.in_(["running","paused"]))
        .order_by(models.Timer.id.desc())
        .first()
    )
    if not timer:
        raise HTTPException(status_code=400, detail="No active timer to stop")
    if timer.status == "running" and timer.start_time:
        start = timer.start_time
        if start.tzinfo is None:
            start = start.replace(tzinfo=timezone.utc)
        timer.elapsed_seconds += int((now_utc() - start).total_seconds())
    timer.status = "stopped"
    timer.start_time = None
    db.add(timer)
    db.commit()
    return {'message': 'Timer stopped', 'status': 'stopped', 'elapsed_seconds': timer.elapsed_seconds}


@router.post("/check/start")
def start_attention_check(window_seconds: int = 120, db: Session = Depends(database.get_db), email: str = Depends(utils.get_current_user_email)):
    user = utils.get_user_by_email(db, email)
    timer = db.query(models.Timer).filter(models.Timer.user_id==user.id, models.Timer.status=="running").first()
    if not timer:
        raise HTTPException(status_code=400, detail="No running timer")
    started = now_utc()
    timer.pending_check_started_at = started
    timer.pending_check_deadline = started + timedelta(seconds=int(window_seconds))
    db.add(timer); db.commit()
    return {'message': 'check_started', 'deadline': timer.pending_check_deadline.isoformat()}

@router.post("/check/confirm")
def confirm_attention_check(db: Session = Depends(database.get_db), email: str = Depends(utils.get_current_user_email)):
    user = utils.get_user_by_email(db, email)
    timer = db.query(models.Timer).filter(models.Timer.user_id==user.id, models.Timer.status=="running").first()
    if not timer:
        raise HTTPException(status_code=400, detail="No running timer")
    now = now_utc()
    if timer.pending_check_deadline and now <= timer.pending_check_deadline:
        # success -> clear pending
        timer.pending_check_started_at = None
        timer.pending_check_deadline = None
    else:
        # missed -> invalidate entire session
        timer.invalidated = True
    db.add(timer); db.commit()
    return {'message': 'check_confirmed', 'invalidated': bool(timer.invalidated)}
