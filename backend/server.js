// server.js — adds /api/current alias to active timer; keeps /api/timers/*
// (manual CORS fallback included)
require('dotenv').config();
const express = require('express');
const app = express();

// Optional middlewares
let morgan = null;
try { morgan = require('morgan'); } catch (_) {}
let cors = null;
try { cors = require('cors'); } catch (_) {}
if (cors) app.use(cors());

// Manual CORS fallback
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.json());
if (morgan) app.use(morgan('tiny'));

// ✅ Single source of truth for sequelize & models
const db = require('./models');           // loads backend/models/index.js
const { sequelize, Timer } = db;

const PORT = process.env.PORT || 10000;

// Health
app.get(['/health', '/api/health'], (_req, res) => {
  res.json({ ok: true, env: process.env.NODE_ENV || 'development' });
});


// TEMP: DB-Inspektor – zeigt die Spaltentypen von Users/Timers
app.get('/api/admin/describe', async (_req, res) => {
  try {
    const qi = sequelize.getQueryInterface();
    const users  = await qi.describeTable('Users');
    const timers = await qi.describeTable('Timers');
    res.json({ ok: true, users, timers });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Routes
const authRoutes = require('./routes/auth');
const timerRoutes = require('./routes/timers');
app.use('/api/auth', authRoutes);
app.use('/api/timers', timerRoutes);
app.use('/api/timer', timerRoutes); // alias

// 🔧 Alias: /api/current → same as GET /api/timers/active (soft-auth)
const jwt = require('jsonwebtoken');
function extractUserId(payload) {
  if (!payload || typeof payload !== 'object') return null;
  return payload.id || payload.userId || payload.userID || payload.uid || payload.sub ||
         (payload.user && (payload.user.id || payload.user.userId)) ||
         (payload.data && (payload.data.id || payload.data.userId)) || null;
}
app.get('/api/current', async (req, res) => {
  try {
    const header = req.headers['authorization'] || '';
    const parts = header.split(' ');
    const token = parts.length === 2 && /^Bearer$/i.test(parts[0]) ? parts[1] : null;
    let payload = null;
    if (token) {
      try { payload = jwt.verify(token, process.env.JWT_SECRET || 'secret'); } catch (_) {}
    }
    const userId = extractUserId(payload);
    // map fields from model
    const attrs = Timer.rawAttributes || {};
    const userIdKey = attrs.userId ? 'userId' : (attrs.user_id ? 'user_id' : 'UserId');
    const endKey = attrs.endTime ? 'endTime' : (attrs.end_time ? 'end_time' : 'end');
    let timer = null;
    if (userId) {
      const where = {};
      where[userIdKey] = userId;
      where[endKey] = null;
      timer = await Timer.findOne({ where });
    }
    return res.json({ ok: true, active: !!timer, timer });
  } catch (err) {
    console.error('alias /api/current error:', err);
    return res.status(500).json({ ok: false, error: 'Failed to fetch current timer' });
  }
});

// 404 handler for API
app.use('/api', (req, res) => res.status(404).json({ ok: false, error: 'API route not found', path: req.path }));

// Boot
(async () => {
  try {
    console.log('Starting server initialization...');
    console.log('NODE_ENV:', process.env.NODE_ENV || 'development');
    console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
    console.log('PORT:', PORT);

    await sequelize.authenticate();
    console.log('Database connection established successfully.');

    await sequelize.sync({ alter: true });
    console.log('Database synced successfully.');

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`Health check available at http://localhost:${PORT}/health`);
    });
  } catch (err) {
    console.error('Fatal startup error:', err);
    process.exit(1);
  }
})();

module.exports = app;
