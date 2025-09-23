// backend/models/Timer.js — endTime nullable; association optional via .associate
module.exports = (sequelize, DataTypes) => {
  const Timer = sequelize.define('Timer', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    startTime: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    endTime: {
      type: DataTypes.DATE,
      allowNull: true, // darf bei Start NULL sein
    },
    pausedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    totalPausedTime: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    status: {
      type: DataTypes.ENUM('active', 'paused', 'completed', 'cancelled'),
      allowNull: true,
      defaultValue: 'active',
    },
    earnedCoins: {
      type: DataTypes.DECIMAL,
      allowNull: true,
      defaultValue: 0,
    },
  }, {
    tableName: 'Timers',
  });

  // Define associations here OR in models/index.js (but not both)
  Timer.associate = (models) => {
    if (models.User) {
      Timer.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
    }
  };

  return Timer;
};
