const { CommentAnalysis } = require('../models');
const { Op } = require('sequelize');
const TextProcessingService = require('./TextProcessingService');
// const ToxicDetectionService = require('./ToxicDetectionService'); // ❌ REMOVED: No longer using toxic detection
// const ModerationService = require('./ModerationService'); // ❌ REMOVED: No longer using moderation

class SentimentAnalysisService {
  // ⚠️ DEPRECATED: Old keyword-based sentiment analysis
  // Now using GeminiSentimentService instead
  // Kept for backward compatibility only
  static async analyzeSentiment(text) {
    console.warn('⚠️ Using deprecated analyzeSentiment. Use GeminiSentimentService instead.');
    return {
      sentiment: 'neutral',
      sentimentScore: 0,
      confidenceScore: 0.5,
      keywords: [],
      matchedSentimentKeywords: [],
      positiveScore: 0,
      negativeScore: 0
    };
  }


  // Save analysis to database
  static async saveAnalysis(commentId, originalMessage, analysis, aiReason = null) {
    try {
      const cleanedMessage = TextProcessingService.cleanText(originalMessage);
      const metadata = TextProcessingService.getTextMetadata(originalMessage);
      await CommentAnalysis.upsert({
        comment_id: commentId,
        original_message: originalMessage,
        cleaned_message: cleanedMessage,
        is_spam: false,
        message_length: metadata.length,
        word_count: metadata.wordCount,
        has_emoji: metadata.hasEmoji,
        has_link: metadata.hasLink,
        has_tag: metadata.hasTag,
        language: metadata.language,
        sentiment: analysis.sentiment,
        sentiment_score: analysis.sentimentScore,
        confidence_score: analysis.confidenceScore,
        keywords: analysis.keywords,
        is_toxic: analysis.is_toxic || false,
        toxic_category: analysis.toxic_category || null,
        analyzed_at: new Date()
      });

      return { success: true };

    } catch (error) {
      console.error('Error saving analysis:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Process comment with Gemini AI sentiment analysis
  static async processComment(commentId, message, autoModerate = false) {
    try {
      const GeminiSentimentService = require('./GeminiSentimentService');

      // Use Gemini to analyze sentiment + toxic
      const geminiResult = await GeminiSentimentService.analyzeSentiment(message);

      // Prepare analysis data for saving
      const analysis = {
        sentiment: geminiResult.sentiment,
        sentimentScore: geminiResult.score,
        confidenceScore: geminiResult.confidenceScore,
        keywords: geminiResult.keywords,
        is_toxic: geminiResult.is_toxic,
        toxic_category: geminiResult.toxic_category
      };

      // Save analysis to database
      await this.saveAnalysis(commentId, message, analysis, geminiResult.reason);

      // Always reply (no toxic filtering)
      return {
        success: true,
        isToxic: geminiResult.is_toxic,
        isDuplicate: false,
        shouldReply: true,
        moderationAction: 'none',
        analysis: {
          cleanedMessage: message,
          sentiment: geminiResult.sentiment,
          sentimentScore: geminiResult.score,
          confidence: geminiResult.confidenceScore,
          keywords: geminiResult.keywords,
          is_toxic: geminiResult.is_toxic,
          toxic_category: geminiResult.toxic_category,
          reason: geminiResult.reason
        }
      };

    } catch (error) {
      console.error('Error processing comment:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }


  // Get analytics summary
  static async getAnalyticsSummary(days = 7) {
    try {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const rows = await CommentAnalysis.findAll({
        where: { analyzed_at: { [Op.gte]: since } },
        raw: true
      });
      const data = {
        total_comments: rows.length,
        positive_count: rows.filter(r => r.sentiment === 'positive').length,
        negative_count: rows.filter(r => r.sentiment === 'negative').length,
        neutral_count: rows.filter(r => r.sentiment === 'neutral').length,
        mixed_count: rows.filter(r => r.sentiment === 'mixed').length,
        avg_sentiment_score: rows.length ? (rows.reduce((a, b) => a + (Number(b.sentiment_score) || 0), 0) / rows.length) : 0,
        avg_confidence: rows.length ? (rows.reduce((a, b) => a + (Number(b.confidence_score) || 0), 0) / rows.length) : 0
      };
      return { success: true, data, period: `${days} days` };

    } catch (error) {
      console.error('Error getting analytics:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get sentiment trend
  static async getSentimentTrend(days = 30) {
    try {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const rows = await CommentAnalysis.findAll({
        where: { analyzed_at: { [Op.gte]: since } },
        attributes: ['analyzed_at', 'sentiment', 'sentiment_score'],
        raw: true
      });
      const byDate = {};
      rows.forEach(r => {
        const date = new Date(r.analyzed_at);
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        const key = `${yyyy}-${mm}-${dd}`;
        byDate[key] = byDate[key] || {};
        byDate[key][r.sentiment] = byDate[key][r.sentiment] || { count: 0, totalScore: 0 };
        byDate[key][r.sentiment].count += 1;
        byDate[key][r.sentiment].totalScore += Number(r.sentiment_score) || 0;
      });
      const results = [];
      Object.entries(byDate).forEach(([date, sentiments]) => {
        Object.entries(sentiments).forEach(([sentiment, v]) => {
          results.push({ date, sentiment, count: v.count, avg_score: v.count ? v.totalScore / v.count : 0 });
        });
      });
      return { success: true, data: results, period: `${days} days` };

    } catch (error) {
      console.error('Error getting trend:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get top keywords
  static async getTopKeywords(sentiment = null, limit = 20) {
    try {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const where = { analyzed_at: { [Op.gte]: since } };
      if (sentiment) where.sentiment = sentiment;
      const results = await CommentAnalysis.findAll({ where, attributes: ['keywords', 'sentiment'], raw: true });
      const keywordMap = {};
      results.forEach(row => {
        try {
          const keywords = Array.isArray(row.keywords) ? row.keywords : JSON.parse(row.keywords || '[]');
          keywords.forEach(keyword => {
            if (!keywordMap[keyword]) {
              keywordMap[keyword] = {
                keyword: keyword,
                frequency: 0,
                sentiments: {}
              };
            }
            keywordMap[keyword].frequency += 1;
            keywordMap[keyword].sentiments[row.sentiment] = (keywordMap[keyword].sentiments[row.sentiment] || 0) + 1;
          });
        } catch (e) {
          // Skip invalid JSON
        }
      });

      const topKeywords = Object.values(keywordMap)
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, limit);

      return {
        success: true,
        data: topKeywords
      };

    } catch (error) {
      console.error('Error getting keywords:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = SentimentAnalysisService;

