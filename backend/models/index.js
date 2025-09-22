const sequelize = require('../config/database');
const User = require('./User');
const Timer = require('./Timer');

// Define associations
Timer.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(Timer, { foreignKey: 'userId' });

module.exports = {
  sequelize,
  User,
  Timer
};