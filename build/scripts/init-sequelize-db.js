"use strict";

const {
  Sequelize
} = require('sequelize');
const path = require('path');
require('dotenv').config();

// Database connection for initialization
const sequelize = new Sequelize({
  dialect: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'fb_comment_db',
  logging: false,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});
async function createDatabase() {
  try {
    // Connect without specifying database to create it
    const tempSequelize = new Sequelize({
      dialect: 'mysql',
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      username: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      logging: false
    });

    // Create database if not exists
    const dbName = process.env.DB_NAME || 'fb_comment_db';
    await tempSequelize.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log(`✅ Database '${dbName}' created or already exists.`);
    await tempSequelize.close();
  } catch (error) {
    console.error('❌ Error creating database:', error.message);
    throw error;
  }
}
async function initializeDatabase() {
  try {
    console.log('🚀 Initializing Sequelize Database...');

    // Create database
    await createDatabase();

    // Test connection
    await sequelize.authenticate();
    console.log('✅ Database connection established.');

    // Sync all models (create tables)
    await sequelize.sync({
      force: false
    });
    console.log('✅ Database tables synced.');

    // Run seeders
    console.log('🌱 Running seeders...');
    const {
      runAllSeeders
    } = require('../seeders');
    await runAllSeeders();
    console.log('🎉 Database initialization completed successfully!');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

// Run if called directly
if (require.main === module) {
  initializeDatabase().then(() => {
    console.log('✅ Database setup completed.');
    process.exit(0);
  }).catch(error => {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  });
}
module.exports = {
  initializeDatabase,
  createDatabase
};