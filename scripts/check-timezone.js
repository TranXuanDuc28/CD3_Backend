const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkTimezone() {
  let connection;
  try {
    // Create connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'fb_comment_db',
      port: process.env.DB_PORT || 3306
    });

    console.log('🔍 Checking MySQL timezone configuration...\n');

    // Check current timezone settings
    const [globalTz] = await connection.execute("SELECT @@global.time_zone as global_timezone");
    const [sessionTz] = await connection.execute("SELECT @@session.time_zone as session_timezone");
    const [systemTz] = await connection.execute("SELECT @@system_time_zone as system_timezone");

    console.log('📊 Current timezone settings:');
    console.log(`   Global timezone: ${globalTz[0].global_timezone}`);
    console.log(`   Session timezone: ${sessionTz[0].session_timezone}`);
    console.log(`   System timezone: ${systemTz[0].system_timezone}\n`);

    // Check current time
    const [currentTime] = await connection.execute("SELECT NOW() as current_time, UTC_TIMESTAMP() as utc_time");
    console.log('⏰ Current times:');
    console.log(`   MySQL NOW(): ${currentTime[0].current_time}`);
    console.log(`   MySQL UTC: ${currentTime[0].utc_time}`);
    console.log(`   Node.js now: ${new Date()}\n`);

    // Set session timezone to Vietnam
    await connection.execute("SET time_zone = '+07:00'");
    console.log('✅ Set session timezone to +07:00 (Vietnam)\n');

    // Check time again
    const [newTime] = await connection.execute("SELECT NOW() as vietnam_time");
    console.log('🇻🇳 Time after setting Vietnam timezone:');
    console.log(`   Vietnam time: ${newTime[0].vietnam_time}\n`);

    // Check if we can set global timezone (requires SUPER privilege)
    try {
      await connection.execute("SET GLOBAL time_zone = '+07:00'");
      console.log('✅ Successfully set global timezone to +07:00');
    } catch (error) {
      console.log('⚠️  Cannot set global timezone (requires SUPER privilege)');
      console.log('   You may need to run: SET GLOBAL time_zone = \'+07:00\';');
      console.log('   Or restart MySQL with timezone configuration\n');
    }

    // Show recommendations
    console.log('💡 Recommendations:');
    console.log('   1. Set timezone in MySQL config file (my.cnf):');
    console.log('      [mysqld]');
    console.log('      default-time-zone = \'+07:00\'');
    console.log('   2. Restart MySQL service after config change');
    console.log('   3. Or set session timezone in each connection (already done in code)\n');

    // Test with a sample insert/select
    console.log('🧪 Testing with sample data...');
    
    const testTime = new Date();
    const testData = {
      vietnam_time: testTime,
      formatted_time: testTime.toISOString()
    };

    console.log(`   Inserting time: ${testData.vietnam_time}`);
    console.log(`   Formatted time: ${testData.formatted_time}`);

    // Show how dates are stored and retrieved
    const [selectResult] = await connection.execute("SELECT ? as test_date", [testData.vietnam_time]);
    console.log(`   Retrieved from DB: ${selectResult[0].test_date}\n`);

    console.log('✅ Timezone check completed successfully!');

  } catch (error) {
    console.error('❌ Error checking timezone:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the check
if (require.main === module) {
  checkTimezone();
}

module.exports = { checkTimezone };
