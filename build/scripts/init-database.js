"use strict";

const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();
async function initDatabase() {
  let connection;
  try {
    console.log('🔧 Initializing database...\n');

    // Connect without database selection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      port: process.env.DB_PORT || 3306,
      multipleStatements: true
    });
    console.log('✅ Connected to MySQL server');

    // Read and execute schema file
    const schemaPath = path.join(__dirname, '../../database/schema.sql');
    const schemaSql = await fs.readFile(schemaPath, 'utf8');
    console.log('📄 Executing schema.sql...');
    await connection.query(schemaSql);
    console.log('✅ Database schema created successfully');

    // Verify tables
    const dbName = process.env.DB_NAME || 'fb_comment_db';
    const [tables] = await connection.query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = ?
    `, [dbName]);
    console.log('\n📊 Created tables:');
    tables.forEach(table => {
      console.log(`   ✓ ${table.TABLE_NAME}`);
    });
    console.log('\n🎉 Database initialization completed successfully!');
  } catch (error) {
    console.error('\n❌ Database initialization failed:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run if called directly
if (require.main === module) {
  initDatabase();
}
module.exports = initDatabase;