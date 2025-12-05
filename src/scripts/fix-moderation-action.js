const db = require('../config/database');

async function fixModerationAction() {
    try {
        console.log('🔍 Checking for invalid moderation_action values...');

        // First, let's see what values exist
        const rows = await db.query(
            "SELECT id, comment_id, moderation_action FROM comment_analysis WHERE moderation_action NOT IN ('none', 'delete', 'manual_review') OR moderation_action IS NULL"
        );

        console.log(`Found ${rows.length} rows with invalid moderation_action values:`);
        rows.forEach(row => {
            console.log(`  - ID: ${row.id}, comment_id: ${row.comment_id}, moderation_action: '${row.moderation_action}'`);
        });

        if (rows.length > 0) {
            console.log('\n🔧 Fixing invalid values by setting them to "none"...');

            const result = await db.query(
                "UPDATE comment_analysis SET moderation_action = 'none' WHERE moderation_action NOT IN ('none', 'delete', 'manual_review') OR moderation_action IS NULL"
            );

            console.log(`✅ Updated ${result.affectedRows || rows.length} rows`);
        } else {
            console.log('✅ No invalid values found!');
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

fixModerationAction();
