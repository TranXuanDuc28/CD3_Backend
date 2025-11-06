const { SpamPattern } = require('../models');

const spamPatterns = [
  // Keywords spam
  { pattern_type: 'keyword', pattern_value: 'inbox', description: 'Từ spam phổ biến' },
  { pattern_type: 'keyword', pattern_value: 'zalo', description: 'Từ spam phổ biến' },
  { pattern_type: 'keyword', pattern_value: 'liên hệ ngay', description: 'Từ spam phổ biến' },
  { pattern_type: 'keyword', pattern_value: 'giảm giá sốc', description: 'Từ spam phổ biến' },
  { pattern_type: 'keyword', pattern_value: 'miễn phí', description: 'Từ spam phổ biến' },
  { pattern_type: 'keyword', pattern_value: 'khuyến mãi khủng', description: 'Từ spam phổ biến' },
  
  // Regex patterns
  { pattern_type: 'regex', pattern_value: '\\d{10,11}', description: 'Số điện thoại 10-11 số' },
  { pattern_type: 'regex', pattern_value: '(http|https)://[^\\s]+', description: 'URL links' },
  { pattern_type: 'regex', pattern_value: '@[a-zA-Z0-9_]+', description: 'Mention tags' },
  
  // Domains
  { pattern_type: 'domain', pattern_value: 'bit.ly', description: 'Shortened URL' },
  { pattern_type: 'domain', pattern_value: 'tinyurl.com', description: 'Shortened URL' },
  { pattern_type: 'domain', pattern_value: 'shopee.vn', description: 'Competitor link' },
  { pattern_type: 'domain', pattern_value: 'lazada.vn', description: 'Competitor link' },
  
  // Phone patterns
  { pattern_type: 'phone', pattern_value: '^(0|\\+84)', description: 'Số điện thoại Việt Nam' }
];

async function seedSpamPatterns() {
  try {
    console.log('🌱 Seeding Spam Patterns...');
    
    for (const pattern of spamPatterns) {
      await SpamPattern.upsert({
        pattern_type: pattern.pattern_type,
        pattern_value: pattern.pattern_value,
        description: pattern.description,
        is_active: true,
        created_at: new Date()
      });
    }
    
    console.log(`✅ Seeded ${spamPatterns.length} spam patterns.`);
  } catch (error) {
    console.error('❌ Error seeding spam patterns:', error);
    throw error;
  }
}

module.exports = seedSpamPatterns;
