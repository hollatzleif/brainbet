// server.js — API prefix + timers alias + temp droptables
require('dotenv').config();

const express = require('express');
const app = express();

// Optional middlewares
let morgan = null;
try { morgan = require('morgan'); } catch (_) {}
let cors = null;
try { cors = require('cors'); } catch (_) {}
if (cors) app.use(cors());
app.use(express.json());
if (morgan) app.use(morgan('tiny'));

// ✅ Single source of truth for sequelize & models
const db = require('./models');           // loads backend/models/index.js
const { sequelize } = db;

const PORT = process.env.PORT || 10000;

// Health
app.get(['/health', '/api/health'], (_req, res) => {
  res.json({ ok: true, env: process.env.NODE_ENV || 'development' });
});

// ⚠️ TEMP: einmalig nutzen, dann entfernen
app.get(['/droptables', '/api/droptables'], async (_req, res) => {
  try {
    console.log('!! /droptables called – dropping & recreating all Sequelize tables');
    await sequelize.sync({ force: true });
    return res.json({ ok: true, message: 'All Sequelize tables dropped & recreated from models.' });
  } catch (err) {
    console.error('droptables error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// Routes
const authRoutes = require('./routes/auth');
const timerRoutes = require('./routes/timers');
app.use('/api/auth', authRoutes);
app.use('/api/timers', timerRoutes);
app.use('/api/timer', timerRoutes); // alias (singular) in case frontend uses it

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
