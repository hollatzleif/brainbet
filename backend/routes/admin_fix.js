// backend/routes/admin_fix.js — quick DDL to allow NULL on Timers.endTime
const express = require('express');
const router = express.Router();
const { sequelize } = require('../models');

// Makes Timers.endTime nullable (DROP NOT NULL)
router.get('/relax-endtime', async (_req, res) => {
  try {
    await sequelize.query('ALTER TABLE "Timers" ALTER COLUMN "endTime" DROP NOT NULL;');
    res.json({ ok: true, changed: 'Timers.endTime is now NULLABLE' });
  } catch (e) {
    console.error('relax-endtime error:', e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Inspect columns (Users & Timers)
router.get('/describe', async (_req, res) => {
  try {
    const qi = sequelize.getQueryInterface();
    const users  = await qi.describeTable('Users');
    const timers = await qi.describeTable('Timers');
    res.json({ ok: true, users, timers });
  } catch (e) {
    console.error('describe error:', e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;
