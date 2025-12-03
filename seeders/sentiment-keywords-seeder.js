const { SentimentKeyword } = require('../models');

const sentimentKeywords = [
  // Positive keywords
  { keyword: 'tuyệt vời', sentiment: 'positive', weight: 2.0, category: 'general' },
  { keyword: 'tốt', sentiment: 'positive', weight: 1.5, category: 'general' },
  { keyword: 'đẹp', sentiment: 'positive', weight: 1.5, category: 'product' },
  { keyword: 'chất lượng', sentiment: 'positive', weight: 2.0, category: 'product' },
  { keyword: 'hài lòng', sentiment: 'positive', weight: 2.0, category: 'general' },
  { keyword: 'ok', sentiment: 'positive', weight: 1.0, category: 'general' },
  { keyword: 'oke', sentiment: 'positive', weight: 1.0, category: 'general' },
  { keyword: 'thích', sentiment: 'positive', weight: 1.5, category: 'general' },
  { keyword: 'nhanh', sentiment: 'positive', weight: 1.5, category: 'delivery' },
  { keyword: 'rẻ', sentiment: 'positive', weight: 1.0, category: 'price' },
  { keyword: 'đáng tiền', sentiment: 'positive', weight: 2.0, category: 'price' },
  { keyword: 'chính hãng', sentiment: 'positive', weight: 1.5, category: 'product' },
  { keyword: 'uy tín', sentiment: 'positive', weight: 2.0, category: 'service' },
  
  // Negative keywords
  { keyword: 'tệ', sentiment: 'negative', weight: 2.0, category: 'general' },
  { keyword: 'kém', sentiment: 'negative', weight: 1.5, category: 'general' },
  { keyword: 'không tốt', sentiment: 'negative', weight: 1.5, category: 'general' },
  { keyword: 'chậm', sentiment: 'negative', weight: 1.5, category: 'delivery' },
  { keyword: 'đắt', sentiment: 'negative', weight: 1.0, category: 'price' },
  { keyword: 'lừa đảo', sentiment: 'negative', weight: 3.0, category: 'service' },
  { keyword: 'giả', sentiment: 'negative', weight: 2.5, category: 'product' },
  { keyword: 'không đáng tiền', sentiment: 'negative', weight: 2.0, category: 'price' },
  { keyword: 'thất vọng', sentiment: 'negative', weight: 2.0, category: 'general' },
  { keyword: 'hỏng', sentiment: 'negative', weight: 2.5, category: 'product' },
  
  // Neutral keywords
  { keyword: 'bao nhiêu', sentiment: 'neutral', weight: 1.0, category: 'question' },
  { keyword: 'giá', sentiment: 'neutral', weight: 1.0, category: 'question' },
  { keyword: 'còn hàng', sentiment: 'neutral', weight: 1.0, category: 'question' },
  { keyword: 'ship', sentiment: 'neutral', weight: 1.0, category: 'question' },
  { keyword: 'bảo hành', sentiment: 'neutral', weight: 1.0, category: 'question' }
];

async function seedSentimentKeywords() {
  try {
    console.log('🌱 Seeding Sentiment Keywords...');
    
    for (const keyword of sentimentKeywords) {
      await SentimentKeyword.upsert({
        keyword: keyword.keyword,
        sentiment: keyword.sentiment,
        weight: keyword.weight,
        category: keyword.category,
        created_at: new Date()
      });
    }
    
    console.log(`✅ Seeded ${sentimentKeywords.length} sentiment keywords.`);
  } catch (error) {
    console.error('❌ Error seeding sentiment keywords:', error);
    throw error;
  }
}

module.exports = seedSentimentKeywords;
