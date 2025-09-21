
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta

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

    # remaining countdown + autostop
    remaining = None
    if timer.status == "running" and timer.end_time:
        et = timer.end_time
        if et.tzinfo is None:
            et = et.replace(tzinfo=timezone.utc)
        remaining = max(0, int((et - now_utc()).total_seconds()))
        if remaining <= 0:
            # clamp to target, stop and pay out
            if timer.target_seconds:
                elapsed = min(elapsed, int(timer.target_seconds))
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
                "remaining_seconds": 0,
            }

    # paused remaining
    if timer.status == "paused" and timer.remaining_seconds is not None:
        remaining = int(timer.remaining_seconds)

    ui_elapsed = 0 if timer.status == "stopped" else elapsed
    return {
        "status": timer.status,
        "elapsed_seconds": ui_elapsed,
        "last_session_seconds": elapsed,
        "start_time": timer.start_time.isoformat() if timer.start_time else None,
        "remaining_seconds": remaining,
    }

@router.post("/start")
def start_timer(
    duration_minutes: int | None = None,
    db: Session = Depends(database.get_db),
    email: str = Depends(get_current_user_email),
):
    user = get_user_by_email(db, email)

    running = (
        db.query(models.Timer)
        .filter(models.Timer.user_id == user.id, models.Timer.status == "running")
        .first()
    )
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
        rem = paused.remaining_seconds if paused.remaining_seconds is not None else (
            (paused.target_seconds or 0) - paused.elapsed_seconds
        )
        rem = max(0, int(rem))
        paused.end_time = now_utc() + timedelta(seconds=rem) if rem > 0 else None
        paused.remaining_seconds = None
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
    timer = models.Timer(
        user_id=user.id,
        status="running",
        start_time=now_utc(),
        elapsed_seconds=0,
        target_seconds=target,
        end_time=now_utc() + timedelta(seconds=target),
        remaining_seconds=None,
    )
    db.add(timer); db.commit(); db.refresh(timer)
    return {"message": "Timer started", "status": "running"}

@router.post("/pause")
def pause_timer(db: Session = Depends(database.get_db), email: str = Depends(get_current_user_email)):
    user = get_user_by_email(db, email)
    timer = (
        db.query(models.Timer)
        .filter(models.Timer.user_id == user.id, models.Timer.status == "running")
        .first()
    )
    if not timer:
        raise HTTPException(status_code=400, detail="No running timer")

    if timer.start_time:
        start = timer.start_time
        if start.tzinfo is None:
            start = start.replace(tzinfo=timezone.utc)
        add = int((now_utc() - start).total_seconds())
        timer.elapsed_seconds += add

    # compute remaining from end_time/target
    rem = None
    if timer.end_time:
        et = timer.end_time
        if et.tzinfo is None:
            et = et.replace(tzinfo=timezone.utc)
        rem = max(0, int((et - now_utc()).total_seconds()))
    elif timer.target_seconds:
        rem = max(0, int(timer.target_seconds - timer.elapsed_seconds))

    timer.remaining_seconds = rem
    timer.end_time = None
    timer.start_time = None
    timer.status = "paused"

    db.add(timer); db.commit()
    return {"message": "Timer paused", "status": "paused", "elapsed_seconds": int(timer.elapsed_seconds or 0), "remaining_seconds": rem}

@router.post("/stop")
def stop_timer(db: Session = Depends(database.get_db), email: str = Depends(get_current_user_email)):
    user = get_user_by_email(db, email)
    timer = (
        db.query(models.Timer)
        .filter(models.Timer.user_id == user.id)
        .order_by(models.Timer.id.desc())
        .first()
    )
    if not timer or timer.status not in ("running", "paused"):
        raise HTTPException(status_code=400, detail="No active timer")

    if timer.status == "running" and timer.start_time:
        start = timer.start_time
        if start.tzinfo is None:
            start = start.replace(tzinfo=timezone.utc)
        timer.elapsed_seconds += int((now_utc() - start).total_seconds())

    # clamp to target
    if timer.target_seconds:
        timer.elapsed_seconds = min(int(timer.elapsed_seconds or 0), int(timer.target_seconds))

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
