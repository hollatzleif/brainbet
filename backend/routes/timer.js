const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const authMiddleware = require('../middleware/auth');

// Import models from index
const { Timer } = require('../models/index');

// Start timer
router.post('/start', authMiddleware, async (req, res) => {
  try {
    const { hours = 0, minutes = 0, seconds = 0 } = req.body;

    // Validate timer duration
    const totalSeconds = hours * 3600 + minutes * 60 + seconds;
    if (totalSeconds <= 0 || totalSeconds > 7200) {
      return res.status(400).json({
        success: false,
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
        success: false,
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
      success: true,
      message: 'Timer started',
      timer
    });
  } catch (error) {
    console.error('Timer start error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start timer'
    });
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
      return res.json({
        success: true,
        timer: null
      });
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
      success: true,
      timer: {
        ...timer.toJSON(),
        remainingSeconds
      }
    });
  } catch (error) {
    console.error('Get timer error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get timer'
    });
  }
});

// Helper function remains the same...
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

// Other routes (pause, resume, stop) bleiben gleich, nur füge success: true zu responses hinzu

module.exports = router;