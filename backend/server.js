require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { sequelize } = require('./models');


// Debug environment
console.log('Starting server initialization...');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
console.log('PORT:', process.env.PORT || 5000);

// Import database and models
const { sequelize, User, Timer } = require('./models/index');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const timerRoutes = require('./routes/timer');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      'http://localhost:3000',
      'https://brainbet.netlify.app',
      process.env.FRONTEND_URL
    ].filter(Boolean);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/timer', timerRoutes);

// Health check
app.get('/', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Learning Timer API',
    timestamp: new Date()
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// ⚠️ TEMPORÄR! Danach wieder entfernen.
app.get('/droptables', async (req, res) => {
  try {
    console.log('!! /droptables called – dropping & recreating all Sequelize tables');
    await sequelize.sync({ force: true }); // droppt ALLE Sequelize-Tabellen und erstellt sie neu
    return res.json({ ok: true, message: 'All Sequelize tables dropped and recreated from models.' });
  } catch (err) {
    console.error('droptables error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});


// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Something went wrong!', details: err.message });
});

// Database sync and server start
const startServer = async () => {
  try {
    console.log('Testing database connection...');
    await sequelize.authenticate();
    console.log('Database connection established successfully.');

    console.log('Syncing database models...');
    await sequelize.sync({ alter: true });
    console.log('Database synced successfully.');

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`Health check available at http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('Unable to start server:', error);
    process.exit(1);
  }
};

startServer();