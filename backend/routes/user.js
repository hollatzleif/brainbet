const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');

// Get current user profile
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    res.json({
      success: true,
      user: req.user.toJSON()
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch profile'
    });
  }
});

// Update coins (internal use)
router.patch('/coins', authMiddleware, async (req, res) => {
  try {
    const { coins } = req.body;

    if (typeof coins !== 'number' || coins < 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid coins value'
      });
    }

    req.user.coins = parseFloat(req.user.coins) + coins;
    await req.user.save();

    res.json({
      success: true,
      message: 'Coins updated',
      newBalance: req.user.coins
    });
  } catch (error) {
    console.error('Coins update error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update coins'
    });
  }
});

module.exports = router;