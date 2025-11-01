const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const db = require('./config/database');
// Import Sequelize models (this will initialize Sequelize)
const models = require('./models');
const apiRoutes = require('./routes/api');
const Logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  Logger.info(`${req.method} ${req.path}`, { 
    source: 'express',
    ip: req.ip 
  });
  next();
});

// Routes
app.use('/api', apiRoutes);

// Root endpoint

// Error handling
app.use((err, req, res, next) => {
  Logger.error('Express error', { error: err.message, stack: err.stack });
  res.status(500).json({
    success: false,
    error: err.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Start server
async function startServer() {
  try {
    // Test database connection (pool)
    const dbConnected = await db.testConnection();
    if (!dbConnected) {
      console.error('❌ Cannot start server: Database connection failed');
      process.exit(1);
    }

    // Optionally sync Sequelize models to create/update tables in development
    // Set AUTO_SYNC=true in your .env to enable. In production prefer migrations.
    if (process.env.AUTO_SYNC === 'true') {
      try {
        console.log('🔁 AUTO_SYNC enabled — syncing Sequelize models (this may alter tables)');
        await models.sequelize.sync({ alter: true });
        console.log('✅ Sequelize models synced');
      } catch (err) {
        console.error('❌ Failed to sync Sequelize models:', err.message);
        process.exit(1);
      }
    }

    // Start listening
    app.listen(PORT, () => {
      console.log('\n🚀 ========================================');
      console.log(`✅ Server is running on port ${PORT}`);
      console.log(`📡 API endpoint: http://localhost:${PORT}/api`);
      console.log(`🏥 Health check: http://localhost:${PORT}/api/health`);
      console.log('🔗 ========================================\n');
      
      Logger.info('Server started successfully', { port: PORT });
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    Logger.error('Server startup failed', { error: error.message });
    process.exit(1);
  }
}

// Handle shutdown gracefully
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down server...');
  Logger.info('Server shutting down');
  process.exit(0);
});

// Start the server
startServer();

