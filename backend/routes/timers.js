// routes/timers.js — adds /current and /status aliases to /active
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { Timer } = require('../models');

function extractUserId(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const direct = payload.id || payload.userId || payload.userID || payload.uid || payload.sub || null;
  if (direct) return direct;
  const nested = (payload.user && (payload.user.id || payload.user.userId)) ||
                 (payload.data && (payload.data.id || payload.data.userId)) ||
                 null;
  return nested;
}

function getAttrMap() {
  const attrs = Timer.rawAttributes || {};
  function pick(candidates) { for (const c of candidates) if (attrs[c]) return c; return null; }
  return {
    id: pick(['id','ID']),
    userId: pick(['userId','user_id','UserId','userid']),
    startTime: pick(['startTime','start_time','start']),
    endTime: pick(['endTime','end_time','end']),
    duration: pick(['duration','seconds','length','elapsed'])
  };
}

function verifyTokenFromHeader(req) {
  const header = req.headers['authorization'] || '';
  const parts = header.split(' ');
  const token = parts.length === 2 && /^Bearer$/i.test(parts[0]) ? parts[1] : null;
  if (!token) return { ok: false, error: 'Missing token' };
  const secret = process.env.JWT_SECRET || 'secret';
  try { return { ok: true, payload: jwt.verify(token, secret) }; }
  catch (e) { return { ok: false, error: 'Invalid token (signature)' }; }
}

// Helper
async function findActiveTimer(userId, map) {
  const where = {}; where[map.userId] = userId; where[map.endTime] = null;
  return await Timer.findOne({ where });
}

// Aliases for active
router.get(['/active', '/current', '/status'], async (req, res) => {
  try {
    const v = verifyTokenFromHeader(req);
    const payload = v.ok ? v.payload : null;
    const map = getAttrMap();
    const userId = extractUserId(payload);
    const t = userId ? await findActiveTimer(userId, map) : null;
    return res.json({ ok: true, active: !!t, timer: t || null, auth: v.ok });
  } catch (err) {
    console.error('active/current/status error:', err);
    return res.status(500).json({ ok: false, error: 'Failed to fetch active timer' });
  }
});

// Start/Stop (POST & GET for robustness)
function routeAll(path, handler) { router.get(path, handler); router.post(path, handler); }

routeAll('/start', async (req, res) => {
  try {
    const v = verifyTokenFromHeader(req);
    if (!v.ok) return res.status(401).json(v);
    const map = getAttrMap();
    const userId = extractUserId(v.payload);
    if (!userId) return res.status(400).json({ ok: false, error: 'Missing user id in token payload' });

    const existing = await findActiveTimer(userId, map);
    if (existing) return res.status(400).json({ ok: false, error: 'A timer is already running', timer: existing });

    const now = new Date();
    const data = {}; data[map.userId] = userId; data[map.startTime] = now;
    if (map.endTime) data[map.endTime] = null; if (map.duration) data[map.duration] = 0;

    const timer = await Timer.create(data);
    return res.json({ ok: true, timer });
  } catch (err) {
    console.error('start timer error:', err);
    return res.status(500).json({ ok: false, error: 'Failed to start timer', details: err.message });
  }
});

routeAll('/stop', async (req, res) => {
  try {
    const v = verifyTokenFromHeader(req);
    if (!v.ok) return res.status(401).json(v);
    const map = getAttrMap();
    const userId = extractUserId(v.payload);
    if (!userId) return res.status(400).json({ ok: false, error: 'Missing user id in token payload' });

    const t = await findActiveTimer(userId, map);
    if (!t) return res.status(400).json({ ok: false, error: 'No active timer' });

    const end = new Date(); t[map.endTime] = end;
    if (map.duration) { const ms = end - t[map.startTime]; t[map.duration] = Math.max(0, Math.floor(ms/1000)); }
    await t.save();
    return res.json({ ok: true, timer: t });
  } catch (err) {
    console.error('stop timer error:', err);
    return res.status(500).json({ ok: false, error: 'Failed to stop timer', details: err.message });
  }
});

module.exports = router;
