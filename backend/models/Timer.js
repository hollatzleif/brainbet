const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Debug
console.log('Timer model loading, sequelize is:', typeof sequelize);

const Timer = sequelize.define('Timer', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  startTime: {
    type: DataTypes.DATE,
    allowNull: false
  },
  endTime: {
    type: DataTypes.DATE,
    allowNull: false
  },
  pausedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  totalPausedTime: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  status: {
    type: DataTypes.ENUM('active', 'paused', 'completed', 'cancelled'),
    defaultValue: 'active'
  },
  earnedCoins: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  }
});

module.exports = Timer;