const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkMySQLIndexes() {
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
   
    
    console.log('🔍 Checking actual MySQL indexes...\n');
    
    // Get all tables
    const [tables] = await connection.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_TYPE = 'BASE TABLE'
    `, [process.env.DB_NAME || 'fb_comment_db']);
    
    let totalIndexes = 0;
    const tableIndexes = {};
    
    for (const table of tables) {
      const tableName = table.TABLE_NAME;
      
      // Get indexes for this table
      const [indexes] = await connection.execute(`
        SELECT 
          INDEX_NAME,
          COLUMN_NAME,
          NON_UNIQUE,
          INDEX_TYPE,
          CARDINALITY
        FROM INFORMATION_SCHEMA.STATISTICS 
        WHERE TABLE_SCHEMA = ? 
        AND TABLE_NAME = ?
        ORDER BY INDEX_NAME, SEQ_IN_INDEX
      `, [process.env.DB_NAME || 'fb_comment_db', tableName]);
      
      // Group by index name
      const indexGroups = {};
      indexes.forEach(idx => {
        if (!indexGroups[idx.INDEX_NAME]) {
          indexGroups[idx.INDEX_NAME] = {
            columns: [],
            unique: idx.NON_UNIQUE === 0,
            type: idx.INDEX_TYPE
          };
        }
        indexGroups[idx.INDEX_NAME].columns.push(idx.COLUMN_NAME);
      });
      
      const indexCount = Object.keys(indexGroups).length;
      totalIndexes += indexCount;
      
      tableIndexes[tableName] = {
        count: indexCount,
        indexes: indexGroups
      };
      
      console.log(`📊 ${tableName}: ${indexCount} indexes`);
      Object.entries(indexGroups).forEach(([name, details]) => {
        const uniqueStr = details.unique ? 'UNIQUE' : 'INDEX';
        console.log(`   - ${name}: ${details.columns.join(', ')} (${uniqueStr})`);
      });
      console.log('');
    }
    
    console.log('='.repeat(60));
    console.log(`📈 SUMMARY:`);
    console.log(`   - Total tables: ${tables.length}`);
    console.log(`   - Total indexes: ${totalIndexes}`);
    console.log(`   - MySQL limit: 64 indexes per table`);
    
    // Find tables with most indexes
    const sortedTables = Object.entries(tableIndexes)
      .sort(([,a], [,b]) => b.count - a.count)
      .slice(0, 5);
    
    console.log('\n🔝 TOP 5 TABLES WITH MOST INDEXES:');
    sortedTables.forEach(([name, data], index) => {
      console.log(`   ${index + 1}. ${name}: ${data.count} indexes`);
    });
    
    // Check if any table exceeds limit
    const exceededTables = Object.entries(tableIndexes)
      .filter(([, data]) => data.count > 64);
    
    if (exceededTables.length > 0) {
      console.log('\n🚨 TABLES EXCEEDING 64 INDEX LIMIT:');
      exceededTables.forEach(([name, data]) => {
        console.log(`   - ${name}: ${data.count} indexes`);
      });
    } else {
      console.log('\n✅ All tables are within the 64 index limit');
    }
    
  } catch (error) {
    console.error('❌ Error checking MySQL indexes:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
    process.exit(0);
  }
}

checkMySQLIndexes();
