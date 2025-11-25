"use strict";

const mysql = require('mysql2/promise');
require('dotenv').config();
async function fixHandledComments() {
  let connection;
  try {
    console.log('🔧 Fixing handled_comments table...\n');

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

    // Check table structure
    console.log('\n📊 Checking table structure...');
    const [columns] = await connection.query(`
      DESCRIBE handled_comments
    `);
    console.log('Current columns:');
    columns.forEach(col => {
      console.log(`   - ${col.Field}: ${col.Type} ${col.Null} ${col.Key} ${col.Extra}`);
    });

    // Check if id column has AUTO_INCREMENT
    const idColumn = columns.find(col => col.Field === 'id');
    if (!idColumn || !idColumn.Extra.includes('auto_increment')) {
      console.log('\n⚠️  ID column missing AUTO_INCREMENT! Fixing...');
      await connection.query(`
        ALTER TABLE handled_comments 
        MODIFY COLUMN id BIGINT NOT NULL AUTO_INCREMENT
      `);
      console.log('✅ Added AUTO_INCREMENT to id column');
    } else {
      console.log('\n✅ ID column has AUTO_INCREMENT');
    }

    // Check for duplicate comment_id constraint
    const [indexes] = await connection.query(`
      SHOW INDEX FROM handled_comments WHERE Key_name = 'comment_id'
    `);
    if (indexes.length === 0) {
      console.log('\n⚠️  UNIQUE constraint on comment_id missing! Adding...');
      await connection.query(`
        ALTER TABLE handled_comments 
        ADD UNIQUE KEY unique_comment_id (comment_id)
      `);
      console.log('✅ Added UNIQUE constraint');
    } else {
      console.log('✅ UNIQUE constraint exists');
    }

    // Test insert
    console.log('\n🧪 Testing insert...');
    const testCommentId = `test_${Date.now()}`;
    try {
      await connection.query(`
        INSERT INTO handled_comments (comment_id, reply_id, ai_response, session_id)
        VALUES (?, 'test_reply', 'Test response', 'test_session')
      `, [testCommentId]);
      console.log('✅ Test insert successful');

      // Verify insert
      const [rows] = await connection.query(`
        SELECT * FROM handled_comments WHERE comment_id = ?
      `, [testCommentId]);
      console.log(`✅ Found ${rows.length} test record(s)`);

      // Cleanup
      await connection.query(`
        DELETE FROM handled_comments WHERE comment_id = ?
      `, [testCommentId]);
      console.log('✅ Cleaned up test record');
    } catch (error) {
      console.error('❌ Test insert failed:', error.message);
      throw error;
    }

    // Check current data
    const [count] = await connection.query('SELECT COUNT(*) as count FROM handled_comments');
    console.log(`\n📈 Current records: ${count[0].count}`);

    // Show recent records
    const [recent] = await connection.query(`
      SELECT * FROM handled_comments 
      ORDER BY handled_at DESC 
      LIMIT 5
    `);
    if (recent.length > 0) {
      console.log('\n📋 Recent records:');
      recent.forEach(r => {
        console.log(`   - ${r.comment_id} (${r.handled_at})`);
      });
    } else {
      console.log('\n⚠️  No records found (table is empty)');
    }
    console.log('\n🎉 handled_comments table is now working correctly!');
    console.log('\n📝 Next steps:');
    console.log('   1. Restart backend: npm start');
    console.log('   2. Import new workflow: FB-Comment-Complete-v3.json');
    console.log('   3. Test by posting a comment on Facebook');
  } catch (error) {
    console.error('\n❌ Fix failed:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run if called directly
if (require.main === module) {
  fixHandledComments();
}
module.exports = fixHandledComments;