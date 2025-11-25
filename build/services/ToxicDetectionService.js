"use strict";

const {
  ToxicKeyword,
  CommentAnalysis
} = require('../models');
const {
  Op
} = require('sequelize');
const TextProcessingService = require('./TextProcessingService');
class ToxicDetectionService {
  // Detect toxic content
  static async detectToxic(text) {
    try {
      const cleanedText = TextProcessingService.cleanText(text);

      // Load toxic keywords từ database
      const keywords = await ToxicKeyword.findAll({
        where: {
          is_active: true
        },
        attributes: ['keyword', 'category', 'severity'],
        raw: true
      });
      let toxicScore = 0;
      let toxicCategories = new Set();
      let matchedKeywords = [];
      let maxSeverity = 0;
      const lowerText = cleanedText.toLowerCase();

      // Check each toxic keyword
      keywords.forEach(kw => {
        if (lowerText.includes(kw.keyword.toLowerCase())) {
          matchedKeywords.push(kw.keyword);
          toxicCategories.add(kw.category);
          toxicScore += parseFloat(kw.severity);
          maxSeverity = Math.max(maxSeverity, parseFloat(kw.severity));
        }
      });
      const isToxic = toxicScore > 0;
      const normalizedScore = Math.min(toxicScore / 10, 1); // Normalize to 0-1

      // Determine primary category (highest severity)
      let primaryCategory = null;
      if (toxicCategories.size > 0) {
        const categoryArray = Array.from(toxicCategories);
        primaryCategory = categoryArray[0]; // First matched category
      }

      // Determine moderation action based on severity
      let moderationAction = 'none';
      if (maxSeverity >= 4.0) {
        // Very toxic → Delete
        moderationAction = 'delete';
      } else if (maxSeverity >= 1.5) {
        // Potentially toxic → Manual review
        moderationAction = 'manual_review';
      }
      return {
        isToxic: isToxic,
        toxicScore: parseFloat(normalizedScore.toFixed(2)),
        toxicCategory: primaryCategory,
        matchedKeywords: matchedKeywords,
        moderationAction: moderationAction,
        severity: maxSeverity
      };
    } catch (error) {
      console.error('Error detecting toxic:', error.message);
      return {
        isToxic: false,
        toxicScore: 0,
        toxicCategory: null,
        matchedKeywords: [],
        moderationAction: 'none',
        severity: 0
      };
    }
  }

  // Save toxic analysis
  static async saveToxicAnalysis(commentId, toxicResult) {
    try {
      await CommentAnalysis.update({
        is_toxic: toxicResult.isToxic,
        toxic_category: toxicResult.toxicCategory,
        toxic_score: toxicResult.toxicScore,
        moderation_action: toxicResult.moderationAction
      }, {
        where: {
          comment_id: commentId
        }
      });
      return {
        success: true
      };
    } catch (error) {
      console.error('Error saving toxic analysis:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get toxic comments for moderation
  static async getToxicCommentsForReview(minSeverity = 2.0) {
    try {
      const {
        FacebookComment
      } = require('../models');
      const results = await CommentAnalysis.findAll({
        where: {
          is_toxic: true,
          toxic_score: {
            [Op.gte]: minSeverity / 5
          },
          moderation_action: {
            [Op.in]: ['none', 'manual_review']
          }
        },
        include: [{
          model: FacebookComment,
          as: 'facebookComment',
          attributes: ['comment_id', 'from_id', 'from_name', 'message', 'created_time']
        }],
        order: [['toxic_score', 'DESC']],
        limit: 50
      });
      const data = results.map(r => ({
        comment_id: r.comment_id,
        from_id: r.facebookComment?.from_id,
        from_name: r.facebookComment?.from_name,
        message: r.facebookComment?.message,
        toxic_category: r.toxic_category,
        toxic_score: r.toxic_score,
        moderation_action: r.moderation_action,
        created_time: r.facebookComment?.created_time
      }));
      return {
        success: true,
        data,
        count: data.length
      };
    } catch (error) {
      console.error('Error getting toxic comments:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get moderation statistics
  static async getModerationStats(days = 7) {
    try {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const rows = await CommentAnalysis.findAll({
        where: {
          is_toxic: true,
          analyzed_at: {
            [Op.gte]: since
          }
        },
        raw: true
      });
      const data = {
        total_toxic: rows.length,
        deleted: rows.filter(r => r.moderation_action === 'delete').length,
        pending_review: rows.filter(r => r.moderation_action === 'manual_review').length,
        profanity_count: rows.filter(r => r.toxic_category === 'profanity').length,
        hate_speech_count: rows.filter(r => r.toxic_category === 'hate_speech').length,
        insult_count: rows.filter(r => r.toxic_category === 'insult').length,
        violence_count: rows.filter(r => r.toxic_category === 'violence').length,
        avg_toxic_score: rows.length ? rows.reduce((a, b) => a + (Number(b.toxic_score) || 0), 0) / rows.length : 0
      };
      return {
        success: true,
        data,
        period: `${days} days`
      };
    } catch (error) {
      console.error('Error getting moderation stats:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }
}
module.exports = ToxicDetectionService;