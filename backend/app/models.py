
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime, timezone

from .database import Base

def utcnow():
    return datetime.now(timezone.utc)

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime, default=utcnow)

    timers = relationship("Timer", back_populates="user", cascade="all, delete-orphan")
    wallet = relationship("Wallet", back_populates="user", uselist=False, cascade="all, delete-orphan")
    level = relationship("UserLevel", back_populates="user", uselist=False, cascade="all, delete-orphan")

class Wallet(Base):
    __tablename__ = "wallets"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    coins = Column(Float, default=0.0, nullable=False)

    user = relationship("User", back_populates="wallet")

class UserLevel(Base):
    __tablename__ = "user_levels"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    level = Column(Integer, default=1, nullable=False)

    user = relationship("User", back_populates="level")

class Timer(Base):
    __tablename__ = "timers"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    start_time = Column(DateTime, nullable=True)
    elapsed_seconds = Column(Integer, default=0, nullable=False)
    status = Column(String, default="stopped", nullable=False)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    # Optional attention-check fields (added via startup migrations)
    pending_check_started_at = Column(DateTime, nullable=True)
    pending_check_deadline = Column(DateTime, nullable=True)
    invalidated = Column(Boolean, default=False, nullable=False)

    # Optional countdown fields (added via startup migrations)
    target_seconds = Column(Integer, nullable=True)
    end_time = Column(DateTime, nullable=True)           # stored in UTC
    remaining_seconds = Column(Integer, nullable=True)

    user = relationship("User", back_populates="timers")
