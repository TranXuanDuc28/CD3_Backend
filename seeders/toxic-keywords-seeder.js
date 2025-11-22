const { ToxicKeyword } = require('../models');

const toxicKeywords = [
  // Profanity (Ngôn từ tục tĩu)
  { keyword: 'đm', category: 'profanity', severity: 3.0 },
  { keyword: 'dm', category: 'profanity', severity: 3.0 },
  { keyword: 'đ*', category: 'profanity', severity: 3.0 },
  { keyword: 'địt', category: 'profanity', severity: 4.0 },
  { keyword: 'đ!t', category: 'profanity', severity: 4.0 },
  { keyword: 'cc', category: 'profanity', severity: 3.0 },
  { keyword: 'lồn', category: 'profanity', severity: 4.0 },
  { keyword: 'l*n', category: 'profanity', severity: 4.0 },
  { keyword: 'vcl', category: 'profanity', severity: 2.5 },
  { keyword: 'vl', category: 'profanity', severity: 2.0 },
  { keyword: 'cl', category: 'profanity', severity: 2.5 },
  
  // Insults (Xúc phạm)
  { keyword: 'ngu', category: 'insult', severity: 2.0 },
  { keyword: 'ngu như', category: 'insult', severity: 2.5 },
  { keyword: 'đần', category: 'insult', severity: 2.0 },
  { keyword: 'khùng', category: 'insult', severity: 2.0 },
  { keyword: 'điên', category: 'insult', severity: 2.0 },
  { keyword: 'đồ ngu', category: 'insult', severity: 2.5 },
  { keyword: 'thằng ngu', category: 'insult', severity: 3.0 },
  { keyword: 'con ngu', category: 'insult', severity: 3.0 },
  { keyword: 'đồ khốn', category: 'insult', severity: 2.5 },
  
  // Hate speech (Phát ngôn thù địch)
  { keyword: 'chết đi', category: 'hate_speech', severity: 4.0 },
  { keyword: 'đi chết', category: 'hate_speech', severity: 4.0 },
  { keyword: 'đồ rác', category: 'hate_speech', severity: 2.5 },
  { keyword: 'đồ phản bội', category: 'hate_speech', severity: 3.0 },
  
  // Violence (Bạo lực)
  { keyword: 'đánh chết', category: 'violence', severity: 4.0 },
  { keyword: 'giết', category: 'violence', severity: 4.0 },
  { keyword: 'cho ăn đòn', category: 'violence', severity: 3.0 }
];

async function seedToxicKeywords() {
  try {
    console.log('🌱 Seeding Toxic Keywords...');
    
    for (const keyword of toxicKeywords) {
      await ToxicKeyword.upsert({
        keyword: keyword.keyword,
        category: keyword.category,
        severity: keyword.severity,
        is_active: true,
        created_at: new Date()
      });
    }
    
    console.log(`✅ Seeded ${toxicKeywords.length} toxic keywords.`);
  } catch (error) {
    console.error('❌ Error seeding toxic keywords:', error);
    throw error;
  }
}

module.exports = seedToxicKeywords;
