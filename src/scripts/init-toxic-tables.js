const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

async function initToxicTables() {
  let connection;

  try {
    console.log('🔧 Initializing toxic detection tables...\n');

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
    const sqlPath = path.join(__dirname, '../../database/toxic_detection_update.sql');
    const sql = await fs.readFile(sqlPath, 'utf8');

    console.log('📄 Executing toxic_detection_update.sql...');
    await connection.query(sql);

    console.log('✅ Toxic detection tables updated successfully\n');

    // Verify tables
    const [tables] = await connection.query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME IN ('toxic_keywords', 'moderation_log')
    `, [process.env.DB_NAME || 'fb_comment_db']);

    console.log('📊 Verified tables:');
    tables.forEach(table => {
      console.log(`   ✓ ${table.TABLE_NAME}`);
    });

    // Check data
    const [keywordCount] = await connection.query('SELECT COUNT(*) as count FROM toxic_keywords');

    console.log('\n📈 Data inserted:');
    console.log(`   ✓ Toxic keywords: ${keywordCount[0].count}`);

    console.log('\n🎉 Toxic detection initialization completed successfully!');

  } catch (error) {
    console.error('\n❌ Toxic tables initialization failed:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run if called directly
if (require.main === module) {
  initToxicTables();
}

module.exports = initToxicTables;

