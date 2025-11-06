const { sequelize } = require('../models');

// Import all seeders
const seedAIPrompts = require('./ai-prompts-seeder');
const seedSpamPatterns = require('./spam-patterns-seeder');
const seedSentimentKeywords = require('./sentiment-keywords-seeder');
const seedToxicKeywords = require('./toxic-keywords-seeder');
const seedChatAIResponses = require('./chatai-responses-seeder');

async function runAllSeeders() {
  try {
    console.log('🌱 Starting database seeding...');
    
    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connection established.');
    
    // Sync database (create tables if not exist)
    await sequelize.sync({ force: false });
    console.log('✅ Database tables synced.');
    
    // Run seeders in order
    await seedAIPrompts();
    console.log('✅ AI Prompts seeded.');
    
    await seedSpamPatterns();
    console.log('✅ Spam Patterns seeded.');
    
    await seedSentimentKeywords();
    console.log('✅ Sentiment Keywords seeded.');
    
    await seedToxicKeywords();
    console.log('✅ Toxic Keywords seeded.');
    
    await seedChatAIResponses();
    console.log('✅ ChatAI Responses seeded.');
    
    console.log('🎉 All seeders completed successfully!');
    
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  } finally {
    // Don't close connection - let the app manage it
    // await sequelize.close();
  }
}

// Run if called directly
if (require.main === module) {
  runAllSeeders()
    .then(() => {
      console.log('✅ Seeding completed.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Seeding failed:', error);
      process.exit(1);
    });
}

module.exports = {
  runAllSeeders,
  seedAIPrompts,
  seedSpamPatterns,
  seedSentimentKeywords,
  seedToxicKeywords,
  seedChatAIResponses
};
