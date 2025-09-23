// backend/models/index.js — robust model bootstrap + associations
const { Sequelize, DataTypes } = require('sequelize');

// Create Sequelize instance (Render Postgres usually needs SSL)
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: process.env.NODE_ENV === 'production' ? { ssl: { require: true, rejectUnauthorized: false } } : {}
});

// Load models (each file exports a function (sequelize, DataTypes) => Model)
const User  = require('./User')(sequelize, DataTypes);
const Timer = require('./Timer')(sequelize, DataTypes);

// Run model-level association hooks if provided (safer than hard-coding)
const models = { User, Timer };
if (typeof User.associate === 'function')  User.associate(models);
if (typeof Timer.associate === 'function') Timer.associate(models);

// Optional: explicit associations (only if not defined inside the models)
// Uncomment if your model files do NOT set associations themselves.
// User.hasMany(Timer, { foreignKey: 'userId', as: 'timers' });
// Timer.belongsTo(User, { foreignKey: 'userId', as: 'user' });

module.exports = {
  sequelize,
  Sequelize,
  User,
  Timer,
};
