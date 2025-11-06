const models = require('../models');

async function checkIndexes() {
  try {
    console.log('🔍 Analyzing indexes in all models...\n');
    
    let totalIndexes = 0;
    const modelIndexes = {};
    
    // Get all model names
    const modelNames = Object.keys(models).filter(key => key !== 'sequelize');
    
    for (const modelName of modelNames) {
      const model = models[modelName];
      const tableName = model.getTableName();
      
      
      // Get indexes from model definition
      const indexes = model.options.indexes || [];
      const foreignKeys = [];
      
      // Count foreign key associations
      const associations = model.associations || {};
      Object.values(associations).forEach(assoc => {
        if (assoc.foreignKey) {
          foreignKeys.push(assoc.foreignKey);
        }
      });
      
      const modelIndexCount = indexes.length + foreignKeys.length;
      totalIndexes += modelIndexCount;
      
      modelIndexes[modelName] = {
        tableName,
        indexes: indexes.length,
        foreignKeys: foreignKeys.length,
        total: modelIndexCount,
        indexDetails: indexes.map(idx => ({
          fields: idx.fields,
          unique: idx.unique || false
        })),
        foreignKeyDetails: foreignKeys
      };
      
      console.log(`📊 ${modelName} (${tableName}):`);
      console.log(`   - Custom indexes: ${indexes.length}`);
      console.log(`   - Foreign key indexes: ${foreignKeys.length}`);
      console.log(`   - Total: ${modelIndexCount}`);
      if (indexes.length > 0) {
        console.log(`   - Index details:`, indexes.map(idx => idx.fields).join(', '));
      }
      if (foreignKeys.length > 0) {
        console.log(`   - Foreign keys:`, foreignKeys.join(', '));
      }
      console.log('');
    }
    
    console.log('='.repeat(60));
    console.log(`📈 SUMMARY:`);
    console.log(`   - Total models: ${modelNames.length}`);
    console.log(`   - Total indexes: ${totalIndexes}`);
    console.log(`   - MySQL limit: 64 indexes per table`);
    console.log(`   - Status: ${totalIndexes > 64 ? '❌ EXCEEDS LIMIT' : '✅ WITHIN LIMIT'}`);
    
    if (totalIndexes > 64) {
      console.log('\n🚨 PROBLEM IDENTIFIED:');
      console.log('   Too many indexes across all models!');
      console.log('   MySQL has a limit of 64 indexes per table.');
      console.log('\n💡 SOLUTIONS:');
      console.log('   1. Remove unnecessary indexes');
      console.log('   2. Combine indexes where possible');
      console.log('   3. Use composite indexes instead of multiple single-field indexes');
      console.log('   4. Disable auto-sync and use manual migrations');
    }
    
    // Show models with most indexes
    const sortedModels = Object.entries(modelIndexes)
      .sort(([,a], [,b]) => b.total - a.total)
      .slice(0, 5);
    
    console.log('\n🔝 TOP 5 MODELS WITH MOST INDEXES:');
    sortedModels.forEach(([name, data], index) => {
      console.log(`   ${index + 1}. ${name}: ${data.total} indexes`);
    });
    
  } catch (error) {
    console.error('❌ Error checking indexes:', error.message);
  } finally {
    process.exit(0);
  }
}

checkIndexes();
