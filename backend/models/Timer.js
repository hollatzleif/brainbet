// backend/models/Timer.js — endTime now nullable
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
      allowNull: true, // <— wichtig: darf bei Start NULL sein
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

  Timer.associate = (models) => {
    if (models.User) {
      Timer.belongsTo(models.User, { foreignKey: 'userId' });
    }
  };

  return Timer;
};
