const { Sequelize } = require('sequelize');

console.log('Initializing database connection...');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set!');
  process.exit(1);
}

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  },
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

// WICHTIG: Sequelize Objekt exportieren
module.exports = sequelize;