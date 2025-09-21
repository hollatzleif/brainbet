
# Patch snippet expected to be appended to your existing models.py

try:
    from sqlalchemy import Column, Integer, DateTime
    from .models import Timer  # if this fails, the code is being read standalone; in your repo Timer already exists
except Exception:
    # Fallback import path for when this file is placed as full replacement
    from sqlalchemy import Column, Integer, DateTime
    from . import models as _models
    Timer = _models.Timer

try:
    setattr(Timer, "target_seconds", Column(Integer, nullable=True))
    setattr(Timer, "end_time", Column(DateTime, nullable=True))
    setattr(Timer, "remaining_seconds", Column(Integer, nullable=True))
except Exception:
    pass
