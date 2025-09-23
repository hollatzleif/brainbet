// routes/timers.js — robust timer endpoints with diagnostics
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { Timer } = require('../models');

// Extract userId from JWT payload (supports nested)
function extractUserId(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const direct = payload.id || payload.userId || payload.userID || payload.uid || payload.sub || null;
  if (direct) return direct;
  const nested = (payload.user && (payload.user.id || payload.user.userId)) ||
                 (payload.data && (payload.data.id || payload.data.userId)) ||
                 null;
  return nested;
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

// Minimal JWT auth verification used inline
function verifyTokenFromHeader(req) {
  const header = req.headers['authorization'] || '';
  const parts = header.split(' ');
  const token = parts.length === 2 && /^Bearer$/i.test(parts[0]) ? parts[1] : null;
  if (!token) return { ok: false, error: 'Missing token' };
  const secret = process.env.JWT_SECRET || 'secret';
  try {
    const payload = jwt.verify(token, secret);
    return { ok: true, payload };
  } catch (e) {
    const decoded = jwt.decode(token) || {};
    console.warn('JWT verify failed:', e.message, 'decoded keys:', Object.keys(decoded));
    return { ok: false, error: 'Invalid token (signature)', decodedKeys: Object.keys(decoded) };
  }
}

// Debug route: show mapping and token keys
router.get('/debug', async (req, res) => {
  const map = getAttrMap();
  const v = verifyTokenFromHeader(req);
  const payload = v.ok ? v.payload : {};
  const userId = extractUserId(payload);
  return res.json({ ok: true, attrMap: map, tokenCheck: v, userId });
});

// Accept both GET and POST for start/stop (frontend mismatch safe)
function routeAll(path, handler) {
  router.get(path, handler);
  router.post(path, handler);
}

// /api/timers/start
routeAll('/start', async (req, res) => {
  try {
    const v = verifyTokenFromHeader(req);
    if (!v.ok) return res.status(401).json(v);

    const map = getAttrMap();
    const userId = extractUserId(v.payload);
    if (!userId) return res.status(400).json({ ok: false, error: 'Missing user id in token payload', tokenPayload: v.payload });

    // prevent multiple concurrent timers
    const whereActive = {};
    whereActive[map.userId] = userId;
    whereActive[map.endTime] = null;
    const existing = await Timer.findOne({ where: whereActive });
    if (existing) {
      return res.status(400).json({ ok: false, error: 'A timer is already running', timer: existing });
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
    return res.status(500).json({ ok: false, error: 'Failed to start timer', details: err.message });
  }
});

// /api/timers/stop
routeAll('/stop', async (req, res) => {
  try {
    const v = verifyTokenFromHeader(req);
    if (!v.ok) return res.status(401).json(v);

    const map = getAttrMap();
    const userId = extractUserId(v.payload);
    if (!userId) return res.status(400).json({ ok: false, error: 'Missing user id in token payload', tokenPayload: v.payload });

    const whereActive = {};
    whereActive[map.userId] = userId;
    whereActive[map.endTime] = null;
    const t = await Timer.findOne({ where: whereActive });
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
    return res.status(500).json({ ok: false, error: 'Failed to stop timer', details: err.message });
  }
});

// GET /api/timers/active
router.get('/active', async (req, res) => {
  try {
    const v = verifyTokenFromHeader(req);
    const payload = v.ok ? v.payload : null;
    const map = getAttrMap();
    const userId = extractUserId(payload);
    const whereActive = {};
    if (userId) {
      whereActive[map.userId] = userId;
      whereActive[map.endTime] = null;
    }
    const t = userId ? await Timer.findOne({ where: whereActive }) : null;
    return res.json({ ok: true, active: !!t, timer: t || null, auth: v.ok });
  } catch (err) {
    console.error('active timer error:', err);
    return res.status(500).json({ ok: false, error: 'Failed to fetch active timer' });
  }
});

// GET /api/timers/mine
router.get('/mine', async (req, res) => {
  try {
    const v = verifyTokenFromHeader(req);
    if (!v.ok) return res.status(401).json(v);

    const map = getAttrMap();
    const userId = extractUserId(v.payload);
    if (!userId) return res.status(400).json({ ok: false, error: 'Missing user id in token payload', tokenPayload: v.payload });

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
