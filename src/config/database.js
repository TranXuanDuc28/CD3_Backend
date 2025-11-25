const mysql = require('mysql2/promise');
require('dotenv').config();

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'communication_db',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
  timezone: '+07:00', // Vietnam timezone (UTC+7)
  acquireTimeout: 60000,
  timeout: 60000,
  reconnect: true
};

// Create connection pool
const pool = mysql.createPool(dbConfig);

// Test connection
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    
    // Set timezone to Vietnam time
    await connection.query("SET time_zone = '+07:00'");
    
    console.log('✅ Database connected successfully with Vietnam timezone (+07:00)');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}

// Execute query with error handling
async function query(sql, params = []) {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // Set timezone to Vietnam time for this connection
    await connection.query("SET time_zone = '+07:00'");
    
    // Use pool.query instead of pool.execute to avoid prepared statement issues
    const [results] = await connection.query(sql, params);
    return results;
  } catch (error) {
    console.error('❌ Query error:', error.message);
    console.error('SQL:', sql);
    console.error('Params:', params);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

// Transaction helper
async function transaction(callback) {
  const connection = await pool.getConnection();
  
  try {
    // Set timezone to Vietnam time for this connection
    await connection.query("SET time_zone = '+07:00'");
    await connection.beginTransaction();
    
    const result = await callback(connection);
    await connection.commit();
    connection.release();
    return result;
  } catch (error) {
    await connection.rollback();
    connection.release();
    throw error;
  }
}

module.exports = {
  pool,
  query,
  transaction,
  testConnection
};

