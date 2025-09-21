from sqlalchemy import Column, Integer, String
from .database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)


# --- Timer model ---
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.sql import func

class Timer(Base):
    __tablename__ = "timers"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    start_time = Column(DateTime, nullable=True)
    elapsed_seconds = Column(Integer, default=0, nullable=False)
    status = Column(String, nullable=False, default="stopped")  # running | paused | stopped
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


# --- User level & wallet models ---
from sqlalchemy import ForeignKey, Float

class UserLevel(Base):
    __tablename__ = "user_levels"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False, unique=True)
    level = Column(Integer, nullable=False, default=1)

class UserWallet(Base):
    __tablename__ = "user_wallets"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False, unique=True)
    coins = Column(Float, nullable=False, default=0.0)


from sqlalchemy import Boolean

# extend Timer with attention-check state
setattr(Timer, "pending_check_started_at", Column(DateTime, nullable=True))
setattr(Timer, "pending_check_deadline", Column(DateTime, nullable=True))
setattr(Timer, "invalidated", Column(Boolean, nullable=False, default=False))
