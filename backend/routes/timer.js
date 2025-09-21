const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const Timer = require('../models/Timer');
const authMiddleware = require('../middleware/auth');

// Start timer
router.post('/start', authMiddleware, async (req, res) => {
  try {
    const { hours = 0, minutes = 0, seconds = 0 } = req.body;

    // Validate timer duration
    const totalSeconds = hours * 3600 + minutes * 60 + seconds;
    if (totalSeconds <= 0 || totalSeconds > 7200) {
      return res.status(400).json({
        error: 'Timer duration must be between 1 second and 2 hours'
      });
    }

    // Check for existing active timer
    const existingTimer = await Timer.findOne({
      where: {
        userId: req.user.id,
        status: ['active', 'paused']
      }
    });

    if (existingTimer) {
      return res.status(400).json({
        error: 'You already have an active timer'
      });
    }

    // Create new timer
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + totalSeconds * 1000);

    const timer = await Timer.create({
      userId: req.user.id,
      startTime,
      endTime,
      status: 'active'
    });

    res.status(201).json({
      message: 'Timer started',
      timer
    });
  } catch (error) {
    console.error('Timer start error:', error);
    res.status(500).json({ error: 'Failed to start timer' });
  }
});

// Get current timer
router.get('/current', authMiddleware, async (req, res) => {
  try {
    const timer = await Timer.findOne({
      where: {
        userId: req.user.id,
        status: ['active', 'paused']
      }
    });

    if (!timer) {
      return res.json({ timer: null });
    }

    // Calculate remaining time
    const now = new Date();
    let remainingSeconds;

    if (timer.status === 'paused') {
      const pausedDuration = Math.floor((now - timer.pausedAt) / 1000);
      const totalDuration = Math.floor((timer.endTime - timer.startTime) / 1000);
      const elapsedBeforePause = Math.floor((timer.pausedAt - timer.startTime) / 1000) - timer.totalPausedTime;
      remainingSeconds = totalDuration - elapsedBeforePause;
    } else {
      const elapsed = Math.floor((now - timer.startTime) / 1000) - timer.totalPausedTime;
      const totalDuration = Math.floor((timer.endTime - timer.startTime) / 1000);
      remainingSeconds = Math.max(0, totalDuration - elapsed);

      // Auto-complete if time is up
      if (remainingSeconds === 0 && timer.status === 'active') {
        await completeTimer(timer, req.user);
        timer.status = 'completed';
      }
    }

    res.json({
      timer: {
        ...timer.toJSON(),
        remainingSeconds
      }
    });
  } catch (error) {
    console.error('Get timer error:', error);
    res.status(500).json({ error: 'Failed to get timer' });
  }
});

// Pause timer
router.post('/pause', authMiddleware, async (req, res) => {
  try {
    const timer = await Timer.findOne({
      where: {
        userId: req.user.id,
        status: 'active'
      }
    });

    if (!timer) {
      return res.status(404).json({ error: 'No active timer found' });
    }

    timer.status = 'paused';
    timer.pausedAt = new Date();
    await timer.save();

    res.json({
      message: 'Timer paused',
      timer
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to pause timer' });
  }
});

// Resume timer
router.post('/resume', authMiddleware, async (req, res) => {
  try {
    const timer = await Timer.findOne({
      where: {
        userId: req.user.id,
        status: 'paused'
      }
    });

    if (!timer) {
      return res.status(404).json({ error: 'No paused timer found' });
    }

    const pauseDuration = Math.floor((new Date() - timer.pausedAt) / 1000);
    timer.totalPausedTime += pauseDuration;
    timer.status = 'active';
    timer.pausedAt = null;

    // Adjust end time
    timer.endTime = new Date(timer.endTime.getTime() + pauseDuration * 1000);
    await timer.save();

    res.json({
      message: 'Timer resumed',
      timer
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to resume timer' });
  }
});

// Stop timer
router.post('/stop', authMiddleware, async (req, res) => {
  try {
    const timer = await Timer.findOne({
      where: {
        userId: req.user.id,
        status: ['active', 'paused']
      }
    });

    if (!timer) {
      return res.status(404).json({ error: 'No active timer found' });
    }

    await completeTimer(timer, req.user);

    res.json({
      message: 'Timer completed',
      timer,
      earnedCoins: timer.earnedCoins,
      totalCoins: req.user.coins
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to stop timer' });
  }
});

// Helper function to complete timer and calculate coins
async function completeTimer(timer, user) {
  const now = new Date();
  let totalSeconds;

  if (timer.status === 'paused') {
    totalSeconds = Math.floor((timer.pausedAt - timer.startTime) / 1000) - timer.totalPausedTime;
  } else {
    totalSeconds = Math.floor((now - timer.startTime) / 1000) - timer.totalPausedTime;
  }

  // Calculate coins (1 coin per 3 minutes = 180 seconds)
  const minutes = totalSeconds / 60;
  const baseCoins = Math.floor(minutes / 3);
  const earnedCoins = parseFloat((baseCoins * user.multiplier).toFixed(2));

  timer.status = 'completed';
  timer.earnedCoins = earnedCoins;
  await timer.save();

  user.coins = parseFloat(user.coins) + earnedCoins;
  await user.save();

  return earnedCoins;
}

module.exports = router;