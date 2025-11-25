"use strict";

const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();
async function initSentimentTables() {
  let connection;
  try {
    console.log('🔧 Initializing sentiment analysis tables...\n');

    // Connect to database
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'fb_comment_db',
      port: process.env.DB_PORT || 3306,
      multipleStatements: true
    });
    console.log('✅ Connected to database');

    // Read and execute SQL file
    const sqlPath = path.join(__dirname, '../../database/sentiment_analysis_update.sql');
    const sql = await fs.readFile(sqlPath, 'utf8');
    console.log('📄 Executing sentiment_analysis_update.sql...');
    await connection.query(sql);
    console.log('✅ Sentiment analysis tables created successfully\n');

    // Verify tables
    const [tables] = await connection.query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME IN ('comment_analysis', 'spam_patterns', 'sentiment_keywords')
    `, [process.env.DB_NAME || 'fb_comment_db']);
    console.log('📊 Verified tables:');
    tables.forEach(table => {
      console.log(`   ✓ ${table.TABLE_NAME}`);
    });

    // Check data
    const [spamCount] = await connection.query('SELECT COUNT(*) as count FROM spam_patterns');
    const [keywordCount] = await connection.query('SELECT COUNT(*) as count FROM sentiment_keywords');
    console.log('\n📈 Data inserted:');
    console.log(`   ✓ Spam patterns: ${spamCount[0].count}`);
    console.log(`   ✓ Sentiment keywords: ${keywordCount[0].count}`);
    console.log('\n🎉 Sentiment analysis initialization completed successfully!');
  } catch (error) {
    console.error('\n❌ Sentiment tables initialization failed:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run if called directly
if (require.main === module) {
  initSentimentTables();
}
module.exports = initSentimentTables;