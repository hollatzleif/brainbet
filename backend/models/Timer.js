const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const User = require('./User');

const Timer = sequelize.define('Timer', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id'
    }
  },
  startTime: {
    type: DataTypes.DATE,
    allowNull: false
  },
  endTime: {
    type: DataTypes.DATE,
    allowNull: false
  },
  pausedTime: {
    type: DataTypes.INTEGER,
    defaultValue: 0 // Paused time in seconds
  },
  remainingTime: {
    type: DataTypes.INTEGER,
    allowNull: false // Remaining time in seconds
  },
  totalDuration: {
    type: DataTypes.INTEGER,
    allowNull: false // Total duration in seconds
  },
  status: {
    type: DataTypes.ENUM('active', 'paused', 'completed', 'cancelled'),
    defaultValue: 'active'
  },
  completedDuration: {
    type: DataTypes.INTEGER,
    defaultValue: 0 // Completed duration in seconds
  },
  earnedCoins: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00
  }
}, {
  timestamps: true
});

// Associations
User.hasMany(Timer, { foreignKey: 'userId', as: 'timers' });
Timer.belongsTo(User, { foreignKey: 'userId', as: 'user' });

module.exports = Timer;