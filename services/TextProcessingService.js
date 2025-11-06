const { SpamPattern, CommentAnalysis } = require('../models');
const { Op } = require('sequelize');

class TextProcessingService {
  // Remove emojis
  static removeEmojis(text) {
    return text.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');
  }

  // Remove links
  static removeLinks(text) {
    return text.replace(/(https?:\/\/[^\s]+)/g, '')
               .replace(/(www\.[^\s]+)/g, '')
               .replace(/([a-z0-9]+\.(com|vn|net|org|io)[^\s]*)/gi, '');
  }

  // Remove mentions/tags
  static removeTags(text) {
    return text.replace(/@\w+/g, '').replace(/#\w+/g, '');
  }

  // Remove phone numbers
  static removePhoneNumbers(text) {
    return text.replace(/(\+84|0)[0-9]{9,10}/g, '')
               .replace(/[0-9]{10,11}/g, '');
  }

  // Remove special characters (giữ tiếng Việt)
  static removeSpecialChars(text) {
    return text.replace(/[^\w\sàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ]/g, ' ')
               .replace(/\s+/g, ' ')
               .trim();
  }

  // Normalize text
  static normalize(text) {
    return text.toLowerCase()
               .replace(/\s+/g, ' ')
               .trim();
  }

  // Check if text contains emoji
  static hasEmoji(text) {
    return /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu.test(text);
  }

  // Check if text contains link
  static hasLink(text) {
    return /(https?:\/\/|www\.)/i.test(text);
  }

  // Check if text contains tag
  static hasTag(text) {
    return /[@#]\w+/.test(text);
  }

  // Full clean pipeline
  static cleanText(text) {
    let cleaned = text;
    cleaned = this.removeLinks(cleaned);
    cleaned = this.removePhoneNumbers(cleaned);
    cleaned = this.removeTags(cleaned);
    cleaned = this.removeEmojis(cleaned);
    cleaned = this.removeSpecialChars(cleaned);
    cleaned = this.normalize(cleaned);
    return cleaned;
  }

  // Check if message is spam
  static async isSpam(text) {
    try {
      // Load spam patterns từ database
      const patterns = await SpamPattern.findAll({ where: { is_active: true }, attributes: ['pattern_type','pattern_value'], raw: true });

      const lowerText = text.toLowerCase();

      for (const pattern of patterns) {
        switch (pattern.pattern_type) {
          case 'keyword':
            if (lowerText.includes(pattern.pattern_value.toLowerCase())) {
              return true;
            }
            break;

          case 'regex':
            const regex = new RegExp(pattern.pattern_value, 'i');
            if (regex.test(text)) {
              return true;
            }
            break;

          case 'domain':
            if (lowerText.includes(pattern.pattern_value.toLowerCase())) {
              return true;
            }
            break;

          case 'phone':
            const phoneRegex = new RegExp(pattern.pattern_value);
            if (phoneRegex.test(text)) {
              return true;
            }
            break;
        }
      }

      // Additional heuristics
      // Too many uppercase letters
      const uppercaseRatio = (text.match(/[A-Z]/g) || []).length / text.length;
      if (uppercaseRatio > 0.7 && text.length > 10) {
        return true;
      }

      // Too many repeated characters
      if (/(.)\1{5,}/.test(text)) {
        return true;
      }

      // Too short (likely spam)
      if (text.trim().length < 3) {
        return true;
      }

      return false;

    } catch (error) {
      console.error('Error checking spam:', error.message);
      return false;
    }
  }

  // Check if duplicate
  static async isDuplicate(text, commentId) {
    try {
      const cleanedText = this.cleanText(text);
      
      // Check exact match
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const results = await CommentAnalysis.findAll({
        where: {
          cleaned_message: cleanedText,
          comment_id: { [Op.ne]: commentId },
          analyzed_at: { [Op.gte]: since }
        },
        attributes: ['comment_id','original_message'],
        limit: 1,
        raw: true
      });
      if (results.length > 0) {
        return {
          isDuplicate: true,
          duplicateOf: results[0].comment_id
        };
      }

      return {
        isDuplicate: false,
        duplicateOf: null
      };

    } catch (error) {
      console.error('Error checking duplicate:', error.message);
      return { isDuplicate: false, duplicateOf: null };
    }
  }

  // Extract keywords
  static extractKeywords(text) {
    const stopWords = new Set([
      'là', 'của', 'và', 'có', 'này', 'được', 'với', 'trong', 'cho', 
      'để', 'các', 'một', 'những', 'đã', 'sẽ', 'không', 'thì', 'rất',
      'về', 'đang', 'như', 'từ', 'khi', 'do', 'vì', 'nếu', 'hoặc',
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for'
    ]);

    const words = text.toLowerCase().split(/\s+/);
    const wordFreq = {};

    words.forEach(word => {
      if (word.length > 3 && !stopWords.has(word)) {
        wordFreq[word] = (wordFreq[word] || 0) + 1;
      }
    });

    // Sort by frequency
    const keywords = Object.entries(wordFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);

    return keywords;
  }

  // Get text metadata
  static getTextMetadata(text) {
    return {
      length: text.length,
      wordCount: text.split(/\s+/).filter(w => w.length > 0).length,
      hasEmoji: this.hasEmoji(text),
      hasLink: this.hasLink(text),
      hasTag: this.hasTag(text),
      language: this.detectLanguage(text)
    };
  }

  // Simple language detection
  static detectLanguage(text) {
    // Check if contains Vietnamese characters
    const vietnameseChars = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
    if (vietnameseChars.test(text)) {
      return 'vi';
    }
    return 'en';
  }
}

module.exports = TextProcessingService;

