
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime, timezone

from .. import models, database
from ..utils import (
    get_current_user_email,
    get_user_by_email,
    get_or_create_user_level,
    get_or_create_wallet,
    level_to_multiplier,
)

router = APIRouter(prefix="/timers", tags=["timers"])

def now_utc() -> datetime:
    return datetime.now(timezone.utc)

def _fetch_countdown_fields(db: Session, timer_id: int):
    row = db.execute(text("SELECT target_seconds, end_time, remaining_seconds FROM timers WHERE id=:id"), {"id": timer_id}).mappings().first()
    if not row:
        return None, None, None
    return row["target_seconds"], row["end_time"], row["remaining_seconds"]

def _set_countdown_on_new(db: Session, timer_id: int, target_seconds: int):
    db.execute(text("UPDATE timers SET target_seconds=:t, end_time=(NOW() AT TIME ZONE 'UTC') + make_interval(secs => :t) WHERE id=:id"),
               {"t": int(target_seconds), "id": int(timer_id)})
    db.commit()

def _set_remaining_on_pause(db: Session, timer_id: int, remaining_seconds: int | None):
    db.execute(text("UPDATE timers SET remaining_seconds=:r, end_time=NULL WHERE id=:id"),
               {"r": int(remaining_seconds) if remaining_seconds is not None else None, "id": int(timer_id)})
    db.commit()

def _clear_remaining_on_resume(db: Session, timer_id: int, remaining_seconds: int | None):
    if remaining_seconds and remaining_seconds > 0:
        db.execute(text("UPDATE timers SET end_time=(NOW() AT TIME ZONE 'UTC') + make_interval(secs => :r), remaining_seconds=NULL WHERE id=:id"),
                   {"r": int(remaining_seconds), "id": int(timer_id)})
    else:
        db.execute(text("UPDATE timers SET remaining_seconds=NULL WHERE id=:id"), {"id": int(timer_id)})
    db.commit()

@router.get("/me")
def my_timer(db: Session = Depends(database.get_db), email: str = Depends(get_current_user_email)):
    user = get_user_by_email(db, email)
    timer = (
        db.query(models.Timer)
        .filter(models.Timer.user_id == user.id)
        .order_by(models.Timer.id.desc())
        .first()
    )
    if not timer:
        return {"status": "stopped", "elapsed_seconds": 0, "start_time": None, "remaining_seconds": None}

    # compute live elapsed
    elapsed = int(timer.elapsed_seconds or 0)
    if timer.status == "running" and timer.start_time:
        start = timer.start_time
        if start.tzinfo is None:
            start = start.replace(tzinfo=timezone.utc)
        elapsed += int((now_utc() - start).total_seconds())

    # check countdown via raw SQL
    target_seconds, end_time, remaining_seconds = _fetch_countdown_fields(db, timer.id)

    # autostop if expired
    if timer.status == "running" and end_time is not None:
        et = end_time
        if getattr(et, "tzinfo", None) is None:
            et = et.replace(tzinfo=timezone.utc)
        rem = max(0, int((et - now_utc()).total_seconds()))
        if rem <= 0:
            if target_seconds:
                elapsed = min(elapsed, int(target_seconds))

            timer.status = "stopped"
            timer.start_time = None
            timer.elapsed_seconds = elapsed

            ul = get_or_create_user_level(db, user.id)
            wallet = get_or_create_wallet(db, user.id)
            multiplier = level_to_multiplier(ul.level)

            full_blocks = elapsed // 180
            base_coins = float(full_blocks)
            earned = round(base_coins * float(multiplier), 2)

            wallet.coins = round(float(wallet.coins) + earned, 2)
            db.add(wallet); db.add(timer); db.commit()

            return {
                "status": "stopped",
                "elapsed_seconds": 0,
                "last_session_seconds": elapsed,
                "autostopped": True,
                "base_coins": base_coins,
                "level": ul.level,
                "multiplier": multiplier,
                "earned_coins": earned,
                "wallet_total": wallet.coins,
                "start_time": None,
                "remaining_seconds": 0
            }
        else:
            remaining_seconds = rem

    # paused: return remaining_seconds from DB
    if timer.status == "paused" and remaining_seconds is not None:
        remaining = int(remaining_seconds)
    else:
        remaining = None if end_time is None else remaining_seconds

    ui_elapsed = 0 if timer.status == "stopped" else elapsed
    return {
        "status": timer.status,
        "elapsed_seconds": ui_elapsed,
        "last_session_seconds": elapsed,
        "start_time": timer.start_time.isoformat() if timer.start_time else None,
        "remaining_seconds": int(remaining) if remaining is not None else None
    }

@router.post("/start")
def start_timer(
    duration_minutes: int | None = None,
    db: Session = Depends(database.get_db),
    email: str = Depends(get_current_user_email),
):
    user = get_user_by_email(db, email)

    running = db.query(models.Timer).filter(models.Timer.user_id == user.id, models.Timer.status == "running").first()
    if running:
        raise HTTPException(status_code=400, detail="Timer is already running")

    paused = (
        db.query(models.Timer)
        .filter(models.Timer.user_id == user.id, models.Timer.status == "paused")
        .order_by(models.Timer.id.desc())
        .first()
    )
    if paused:
        paused.status = "running"
        paused.start_time = now_utc()
        _, _, remaining = _fetch_countdown_fields(db, paused.id)
        _clear_remaining_on_resume(db, paused.id, remaining)
        db.add(paused); db.commit(); db.refresh(paused)
        return {"message": "Timer resumed", "status": "running"}

    if duration_minutes is None:
        raise HTTPException(status_code=400, detail="duration_minutes is required (1-120)")
    try:
        dm = int(duration_minutes)
    except Exception:
        raise HTTPException(status_code=400, detail="invalid duration")
    if dm < 1 or dm > 120:
        raise HTTPException(status_code=400, detail="duration must be between 1 and 120 minutes")

    target = dm * 60
    timer = models.Timer(user_id=user.id, status="running", start_time=now_utc(), elapsed_seconds=0)
    db.add(timer); db.commit(); db.refresh(timer)

    _set_countdown_on_new(db, timer.id, target)

    return {"message": "Timer started", "status": "running"}

@router.post("/pause")
def pause_timer(db: Session = Depends(database.get_db), email: str = Depends(get_current_user_email)):
    user = get_user_by_email(db, email)
    timer = db.query(models.Timer).filter(models.Timer.user_id == user.id, models.Timer.status == "running").first()
    if not timer:
        raise HTTPException(status_code=400, detail="No running timer")

    if timer.start_time:
        start = timer.start_time
        if start.tzinfo is None:
            start = start.replace(tzinfo=timezone.utc)
        timer.elapsed_seconds += int((now_utc() - start).total_seconds())

    target, end_time, _ = _fetch_countdown_fields(db, timer.id)
    remaining = None
    if end_time is not None:
        et = end_time
        if getattr(et, "tzinfo", None) is None:
            et = et.replace(tzinfo=timezone.utc)
        remaining = max(0, int((et - now_utc()).total_seconds()))
    elif target:
        remaining = max(0, int(target) - int(timer.elapsed_seconds or 0))

    _set_remaining_on_pause(db, timer.id, remaining)

    timer.start_time = None
    timer.status = "paused"
    db.add(timer); db.commit()

    return {"message": "Timer paused", "status": "paused", "elapsed_seconds": int(timer.elapsed_seconds or 0), "remaining_seconds": remaining}

@router.post("/stop")
def stop_timer(db: Session = Depends(database.get_db), email: str = Depends(get_current_user_email)):
    user = get_user_by_email(db, email)
    timer = db.query(models.Timer).filter(models.Timer.user_id == user.id).order_by(models.Timer.id.desc()).first()
    if not timer or timer.status not in ("running", "paused"):
        raise HTTPException(status_code=400, detail="No active timer")

    if timer.status == "running" and timer.start_time:
        start = timer.start_time
        if start.tzinfo is None:
            start = start.replace(tzinfo=timezone.utc)
        timer.elapsed_seconds += int((now_utc() - start).total_seconds())

    target_seconds, _, _ = _fetch_countdown_fields(db, timer.id)
    if target_seconds:
        timer.elapsed_seconds = min(int(timer.elapsed_seconds or 0), int(target_seconds))

    timer.status = "stopped"
    timer.start_time = None
    elapsed = int(timer.elapsed_seconds or 0)

    ul = get_or_create_user_level(db, user.id)
    wallet = get_or_create_wallet(db, user.id)
    multiplier = level_to_multiplier(ul.level)

    full_blocks = elapsed // 180
    base_coins = float(full_blocks)
    earned = round(base_coins * float(multiplier), 2)
    wallet.coins = round(float(wallet.coins) + earned, 2)

    db.add(wallet); db.add(timer); db.commit(); db.refresh(timer)

    return {
        "message": "Timer stopped",
        "status": "stopped",
        "elapsed_seconds": elapsed,
        "base_coins": base_coins,
        "level": ul.level,
        "multiplier": multiplier,
        "earned_coins": earned,
        "wallet_total": wallet.coins,
    }
