"use strict";

const mysql = require('mysql2/promise');
require('dotenv').config();
async function removeDuplicateIndexes() {
  let connection;
  try {
    // Connect to database
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'fb_comment_db',
      port: process.env.DB_PORT || 3306
    });
    console.log('🧹 Removing duplicate indexes...\n');

    // Tables with duplicate indexes
    const tablesToFix = ['facebook_comments', 'facebook_posts', 'sentiment_keywords', 'toxic_keywords', 'ai_prompts', 'chatai_users'];
    for (const tableName of tablesToFix) {
      console.log(`🔧 Fixing ${tableName}...`);

      // Get all indexes for this table
      const [indexes] = await connection.execute(`
        SELECT INDEX_NAME, COLUMN_NAME, NON_UNIQUE
        FROM INFORMATION_SCHEMA.STATISTICS 
        WHERE TABLE_SCHEMA = ? 
        AND TABLE_NAME = ?
        ORDER BY INDEX_NAME, SEQ_IN_INDEX
      `, [process.env.DB_NAME || 'fb_comment_db', tableName]);

      // Group by column name to find duplicates
      const columnIndexes = {};
      indexes.forEach(idx => {
        if (!columnIndexes[idx.COLUMN_NAME]) {
          columnIndexes[idx.COLUMN_NAME] = [];
        }
        columnIndexes[idx.COLUMN_NAME].push({
          name: idx.INDEX_NAME,
          unique: idx.NON_UNIQUE === 0
        });
      });

      // Find and remove duplicate indexes (keep only the first one)
      for (const [column, indexList] of Object.entries(columnIndexes)) {
        if (indexList.length > 1) {
          console.log(`   📝 Column '${column}' has ${indexList.length} indexes`);

          // Keep the first index, remove the rest
          const indexesToRemove = indexList.slice(1);
          for (const idx of indexesToRemove) {
            try {
              // Skip PRIMARY key
              if (idx.name === 'PRIMARY') continue;
              console.log(`   🗑️  Dropping index: ${idx.name}`);
              await connection.execute(`DROP INDEX \`${idx.name}\` ON \`${tableName}\``);
            } catch (error) {
              console.log(`   ⚠️  Could not drop ${idx.name}: ${error.message}`);
            }
          }
        }
      }
      console.log(`   ✅ ${tableName} cleaned\n`);
    }
    console.log('🎉 Duplicate indexes removal completed!');

    // Verify the fix
    console.log('\n🔍 Verifying fix...');
    for (const tableName of tablesToFix) {
      const [indexes] = await connection.execute(`
        SELECT COUNT(*) as count
        FROM INFORMATION_SCHEMA.STATISTICS 
        WHERE TABLE_SCHEMA = ? 
        AND TABLE_NAME = ?
      `, [process.env.DB_NAME || 'fb_comment_db', tableName]);
      console.log(`   ${tableName}: ${indexes[0].count} indexes`);
    }
  } catch (error) {
    console.error('❌ Error removing duplicate indexes:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
    process.exit(0);
  }
}
removeDuplicateIndexes();