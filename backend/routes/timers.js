// routes/timers.js — robust timer endpoints
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { Timer } = require('../models');

// Extract userId from JWT payload (supports id or userId)
function extractUserId(payload) {
  if (!payload || typeof payload !== 'object') return null;
  return payload.id || payload.userId || payload.userID || payload.uid || null;
}

// Build attribute map from model definition for flexible column names
function getAttrMap() {
  const attrs = Timer.rawAttributes || {};
  function pick(candidates) {
    for (const c of candidates) if (attrs[c]) return c;
    return null;
  }
  return {
    id: pick(['id', 'ID']),
    userId: pick(['userId', 'user_id', 'UserId', 'userid']),
    startTime: pick(['startTime', 'start_time', 'start']),
    endTime: pick(['endTime', 'end_time', 'end']),
    duration: pick(['duration', 'seconds', 'length', 'elapsed'])
  };
}

// Minimal JWT auth middleware. Expects Authorization: Bearer <token>
function auth(req, res, next) {
  try {
    const header = req.headers['authorization'] || '';
    const parts = header.split(' ');
    const token = parts.length === 2 && /^Bearer$/i.test(parts[0]) ? parts[1] : null;
    if (!token) return res.status(401).json({ ok: false, error: 'Missing token' });
    const secret = process.env.JWT_SECRET || 'secret';
    const payload = jwt.verify(token, secret);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ ok: false, error: 'Invalid token' });
  }
}

// Helper: find active timer (no endTime) for user using dynamic field names
async function findActiveTimer(userId, map) {
  const where = {};
  where[map.userId] = userId;
  where[map.endTime] = null;
  return await Timer.findOne({ where });
}

// Debug route: show server-side view (no secrets)
router.get('/debug', auth, async (req, res) => {
  try {
    const map = getAttrMap();
    const payload = req.user;
    const userId = extractUserId(payload);
    return res.json({ ok: true, attrMap: map, tokenPayloadKeys: Object.keys(payload || {}), userId });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/timers/start
router.post('/start', auth, async (req, res) => {
  try {
    const map = getAttrMap();
    const userId = extractUserId(req.user);
    if (!userId) return res.status(400).json({ ok: false, error: 'Missing user id in token payload' });

    // prevent multiple concurrent timers
    const existing = await findActiveTimer(userId, map);
    if (existing) {
      return res.status(400).json({ ok: false, error: 'A timer is already running' });
    }

    const now = new Date();
    const data = {};
    data[map.userId] = userId;
    data[map.startTime] = now;
    if (map.endTime) data[map.endTime] = null;
    if (map.duration) data[map.duration] = 0;

    const timer = await Timer.create(data);
    return res.json({ ok: true, timer });
  } catch (err) {
    console.error('start timer error:', err);
    return res.status(500).json({ ok: false, error: 'Failed to start timer' });
  }
});

// POST /api/timers/stop
router.post('/stop', auth, async (req, res) => {
  try {
    const map = getAttrMap();
    const userId = extractUserId(req.user);
    if (!userId) return res.status(400).json({ ok: false, error: 'Missing user id in token payload' });

    const t = await findActiveTimer(userId, map);
    if (!t) {
      return res.status(400).json({ ok: false, error: 'No active timer' });
    }
    const end = new Date();
    t[map.endTime] = end;
    if (map.duration) {
      const ms = end - t[map.startTime];
      t[map.duration] = Math.max(0, Math.floor(ms / 1000));
    }
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
    const map = getAttrMap();
    const userId = extractUserId(req.user);
    const t = userId ? await findActiveTimer(userId, map) : null;
    return res.json({ ok: true, active: !!t, timer: t || null });
  } catch (err) {
    console.error('active timer error:', err);
    return res.status(500).json({ ok: false, error: 'Failed to fetch active timer' });
  }
});

// GET /api/timers/mine
router.get('/mine', auth, async (req, res) => {
  try {
    const map = getAttrMap();
    const userId = extractUserId(req.user);
    if (!userId) return res.status(400).json({ ok: false, error: 'Missing user id in token payload' });

    const where = {};
    where[map.userId] = userId;

    const list = await Timer.findAll({
      where,
      order: [[map.startTime, 'DESC']],
      limit: 50
    });
    return res.json({ ok: true, timers: list });
  } catch (err) {
    console.error('list timers error:', err);
    return res.status(500).json({ ok: false, error: 'Failed to list timers' });
  }
});

module.exports = router;
