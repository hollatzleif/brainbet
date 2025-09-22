// routes/timers.js — start/stop/active/list timer endpoints
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

const { Timer } = require('../models');

// Minimal JWT auth middleware. Expects Authorization: Bearer <token>
function auth(req, res, next) {
  try {
    const header = req.headers['authorization'] || '';
    const parts = header.split(' ');
    const token = parts.length === 2 && /^Bearer$/i.test(parts[0]) ? parts[1] : null;
    if (!token) return res.status(401).json({ ok: false, error: 'Missing token' });
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'changeme');
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ ok: false, error: 'Invalid token' });
  }
}

// Helper: find active timer (no endTime) for user
async function findActiveTimer(userId) {
  return await Timer.findOne({ where: { userId, endTime: null } });
}

// POST /api/timers/start
router.post('/start', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    // prevent multiple concurrent timers
    const existing = await findActiveTimer(userId);
    if (existing) {
      return res.status(400).json({ ok: false, error: 'A timer is already running' });
    }
    const now = new Date();
    const timer = await Timer.create({
      userId,
      startTime: now,
      endTime: null,
      duration: 0
    });
    return res.json({ ok: true, timer });
  } catch (err) {
    console.error('start timer error:', err);
    return res.status(500).json({ ok: false, error: 'Failed to start timer' });
  }
});

// POST /api/timers/stop
router.post('/stop', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const t = await findActiveTimer(userId);
    if (!t) {
      return res.status(400).json({ ok: false, error: 'No active timer' });
    }
    const end = new Date();
    t.endTime = end;
    // duration in seconds
    t.duration = Math.max(0, Math.floor((end - t.startTime) / 1000));
    await t.save();
    return res.json({ ok: true, timer: t });
  } catch (err) {
    console.error('stop timer error:', err);
    return res.status(500).json({ ok: false, error: 'Failed to stop timer' });
  }
});

// GET /api/timers/active
router.get('/active', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const t = await findActiveTimer(userId);
    return res.json({ ok: true, active: !!t, timer: t || null });
  } catch (err) {
    console.error('active timer error:', err);
    return res.status(500).json({ ok: false, error: 'Failed to fetch active timer' });
  }
});

// GET /api/timers/mine — list my timers (latest first)
router.get('/mine', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const list = await Timer.findAll({
      where: { userId },
      order: [['startTime', 'DESC']],
      limit: 50
    });
    return res.json({ ok: true, timers: list });
  } catch (err) {
    console.error('list timers error:', err);
    return res.status(500).json({ ok: false, error: 'Failed to list timers' });
  }
});

module.exports = router;
