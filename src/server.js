const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const db = require('./config/database');
const models = require('./models');
const apiRoutes = require('./routes/api');
const Logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;

// ======================
// CORS giới hạn domain
// ======================
const allowedOrigin = process.env.CLIENT_URL;

app.use(
  cors({
    origin: allowedOrigin,               // chỉ chấp nhận 1 domain
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true                    // cho phép cookies, token qua header
  })
);

// Body parser
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Logging
app.use((req, res, next) => {
  Logger.info(`${req.method} ${req.path}`, { source: 'express', ip: req.ip });
  next();
});

// Routes
app.use('/api', apiRoutes);

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Facebook Comment Auto-Reply Backend API',
    version: '1.0.0'
  });
});

// Error handler
app.use((err, req, res, next) => {
  Logger.error('Express error', { error: err.message, stack: err.stack });
  res.status(500).json({ success: false, error: err.message });
});

// 404
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint not found' });
});

// Start server
async function startServer() {
  try {
    const dbConnected = await db.testConnection();
    if (!dbConnected) {
      console.error('❌ Cannot start server: Database connection failed');
      process.exit(1);
    }

    if (process.env.AUTO_SYNC === 'true') {
      console.log('🔁 AUTO_SYNC enabled — syncing models...');
      await models.sequelize.sync({ alter: true });
      console.log('✅ Sequelize models synced');
    }

    app.listen(PORT, () => {
      console.log('\n🚀 ========================================');
      console.log(`✅ Server chạy tại http://localhost:${PORT}`);
      console.log(`🔐 CORS chỉ cho phép: ${allowedOrigin}`);
      console.log('🔗 ========================================\n');
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
}

startServer();
