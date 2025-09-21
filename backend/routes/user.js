const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');

// Get current user
router.get('/me', authenticate, async (req, res) => {
  try {
    res.json({
      success: true,
      user: req.user.toJSON()
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Update coins (internal use only)
router.patch('/coins', authenticate, async (req, res) => {
  try {
    const { coins } = req.body;

    if (typeof coins !== 'number' || coins < 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid coins value'
      });
    }

    req.user.coins = parseFloat(req.user.coins) + coins;
    await req.user.save();

    res.json({
      success: true,
      coins: req.user.coins
    });
  } catch (error) {
    console.error('Update coins error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;