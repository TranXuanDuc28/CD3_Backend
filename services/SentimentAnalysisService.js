const { SentimentKeyword, CommentAnalysis } = require('../models');
const { Op } = require('sequelize');
const TextProcessingService = require('./TextProcessingService');
const ToxicDetectionService = require('./ToxicDetectionService');
const ModerationService = require('./ModerationService');

class SentimentAnalysisService {
  // Analyze sentiment using keyword-based approach
  static async analyzeSentiment(text) {
    try {
      const cleanedText = TextProcessingService.cleanText(text);
      
      // Load sentiment keywords từ database
      const keywords = await SentimentKeyword.findAll({ attributes: ['keyword','sentiment','weight'], raw: true });

      let positiveScore = 0;
      let negativeScore = 0;
      let matchedKeywords = [];

      const lowerText = cleanedText.toLowerCase();

      // Calculate sentiment scores
      keywords.forEach(kw => {
        if (lowerText.includes(kw.keyword.toLowerCase())) {
          matchedKeywords.push(kw.keyword);
          
          if (kw.sentiment === 'positive') {
            positiveScore += parseFloat(kw.weight);
          } else if (kw.sentiment === 'negative') {
            negativeScore += parseFloat(kw.weight);
          }
        }
      });

      // Calculate final sentiment
      const totalScore = positiveScore - negativeScore;
      let sentiment = 'neutral';
      let sentimentScore = 0;
      let confidence = 0.5;

      if (totalScore > 1) {
        sentiment = 'positive';
        sentimentScore = Math.min(totalScore / 10, 1);
        confidence = Math.min(0.5 + (totalScore / 20), 1);
      } else if (totalScore < -1) {
        sentiment = 'negative';
        sentimentScore = Math.max(totalScore / 10, -1);
        confidence = Math.min(0.5 + (Math.abs(totalScore) / 20), 1);
      } else if (Math.abs(totalScore) > 0) {
        sentiment = 'mixed';
        sentimentScore = totalScore / 10;
        confidence = 0.6;
      }

      // Extract keywords from text
      const textKeywords = TextProcessingService.extractKeywords(cleanedText);

      return {
        sentiment: sentiment,
        sentimentScore: parseFloat(sentimentScore.toFixed(2)),
        confidenceScore: parseFloat(confidence.toFixed(2)),
        keywords: textKeywords,
        matchedSentimentKeywords: matchedKeywords.slice(0, 5),
        positiveScore: positiveScore,
        negativeScore: negativeScore
      };

    } catch (error) {
      console.error('Error analyzing sentiment:', error.message);
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
  }

  // Save analysis to database
  static async saveAnalysis(commentId, originalMessage, analysis) {
    try {
      const cleanedMessage = TextProcessingService.cleanText(originalMessage);
      const metadata = TextProcessingService.getTextMetadata(originalMessage);
      const isSpam = await TextProcessingService.isSpam(originalMessage);

      await CommentAnalysis.upsert({
        comment_id: commentId,
        original_message: originalMessage,
        cleaned_message: cleanedMessage,
        is_spam: isSpam,
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
        analyzed_at: new Date()
      });

      return {
        success: true,
        isSpam: isSpam
      };

    } catch (error) {
      console.error('Error saving analysis:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Process comment with full pipeline
  static async processComment(commentId, message, autoModerate = true) {
    try {
      // Step 1: Check toxic content
      const toxicResult = await ToxicDetectionService.detectToxic(message);
      
      if (toxicResult.isToxic) {
        await this.saveAnalysis(commentId, message, {
          sentiment: 'negative',
          sentimentScore: -toxicResult.toxicScore,
          confidenceScore: 0.9,
          keywords: toxicResult.matchedKeywords
        });

        // Save toxic analysis
        await ToxicDetectionService.saveToxicAnalysis(commentId, toxicResult);

        // Auto-moderate if enabled
        if (autoModerate && toxicResult.moderationAction !== 'none') {
          await ModerationService.autoModerate(commentId, toxicResult.moderationAction);
        }

        return {
          success: true,
          isToxic: true,
          isSpam: false,
          isDuplicate: false,
          shouldReply: false,
          moderationAction: toxicResult.moderationAction,
          analysis: {
            toxicCategory: toxicResult.toxicCategory,
            toxicScore: toxicResult.toxicScore
          }
        };
      }

      // Step 2: Check spam
      const isSpam = await TextProcessingService.isSpam(message);
      
      if (isSpam) {
        await this.saveAnalysis(commentId, message, {
          sentiment: 'neutral',
          sentimentScore: 0,
          confidenceScore: 0,
          keywords: []
        });

        return {
          success: true,
          isToxic: false,
          isSpam: true,
          isDuplicate: false,
          shouldReply: false,
          moderationAction: 'none',
          analysis: null
        };
      }

      // Step 3: (removed) Duplicate check
      const cleanedMessage = TextProcessingService.cleanText(message);

      // Step 4: Analyze sentiment
      const analysis = await this.analyzeSentiment(message);

      // Step 5: Save to database
      await this.saveAnalysis(commentId, message, analysis);

      return {
        success: true,
        isToxic: false,
        isSpam: false,
        isDuplicate: false,
        shouldReply: true,
        moderationAction: 'none',
        analysis: {
          cleanedMessage: cleanedMessage,
          sentiment: analysis.sentiment,
          sentimentScore: analysis.sentimentScore,
          confidence: analysis.confidenceScore,
          keywords: analysis.keywords
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
        spam_count: rows.filter(r => r.is_spam).length,
        positive_count: rows.filter(r => r.sentiment === 'positive').length,
        negative_count: rows.filter(r => r.sentiment === 'negative').length,
        neutral_count: rows.filter(r => r.sentiment === 'neutral').length,
        mixed_count: rows.filter(r => r.sentiment === 'mixed').length,
        avg_sentiment_score: rows.length ? (rows.reduce((a,b)=>a + (Number(b.sentiment_score)||0),0)/rows.length) : 0,
        avg_confidence: rows.length ? (rows.reduce((a,b)=>a + (Number(b.confidence_score)||0),0)/rows.length) : 0
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
        attributes: ['analyzed_at','sentiment','sentiment_score'],
        raw: true
      });
      const byDate = {};
      rows.forEach(r => {
        const date = new Date(r.analyzed_at);
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth()+1).padStart(2,'0');
        const dd = String(date.getDate()).padStart(2,'0');
        const key = `${yyyy}-${mm}-${dd}`;
        byDate[key] = byDate[key] || {};
        byDate[key][r.sentiment] = byDate[key][r.sentiment] || { count: 0, totalScore: 0 };
        byDate[key][r.sentiment].count += 1;
        byDate[key][r.sentiment].totalScore += Number(r.sentiment_score)||0;
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
      const results = await CommentAnalysis.findAll({ where, attributes: ['keywords','sentiment'], raw: true });
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

