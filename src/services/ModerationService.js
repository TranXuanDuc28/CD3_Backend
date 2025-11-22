const axios = require('axios');
const { ModerationLog, CommentAnalysis, FacebookComment } = require('../models');
const { Op } = require('sequelize');
const Logger = require('../utils/logger');

class ModerationService {
  // Delete comment on Facebook
  static async deleteComment(commentId) {
    try {
      const accessToken = process.env.FACEBOOK_ACCESS_TOKEN;
      
      const url = `https://graph.facebook.com/v23.0/${commentId}`;
      const response = await axios.delete(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      // Log moderation action
      await this.logModeration(commentId, 'delete', 'Toxic content detected', true);

      Logger.info('Comment deleted', { comment_id: commentId });

      return {
        success: true,
        message: 'Comment deleted successfully'
      };

    } catch (error) {
      await this.logModeration(commentId, 'delete', 'Toxic content detected', false, error.message);
      
      Logger.error('Failed to delete comment', { 
        comment_id: commentId, 
        error: error.message 
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  // Log moderation action
  static async logModeration(commentId, action, reason, success, errorMessage = null) {
    try {
      // Create moderation log
      await ModerationLog.create({ 
        comment_id: commentId, 
        action, 
        reason, 
        success, 
        error_message: errorMessage, 
        performed_at: new Date() 
      });
      
      // Update comment analysis if successful
      if (success) {
        await CommentAnalysis.update(
          { 
            moderation_action: action, 
            moderated_at: new Date() 
          }, 
          { 
            where: { comment_id: commentId } 
          }
        );
      }

    } catch (error) {
      console.error('Error logging moderation:', error.message);
      // Don't throw error to avoid breaking the main flow
    }
  }

  // Auto-moderate based on analysis
  static async autoModerate(commentId, moderationAction) {
    try {
      if (moderationAction === 'delete') {
        return await this.deleteComment(commentId);
      }

      if (moderationAction === 'manual_review') {
        return {
          success: true,
          message: 'Manual review required',
          action: moderationAction
        };
      }

      return {
        success: true,
        message: 'No action needed',
        action: moderationAction
      };
    } catch (error) {
      Logger.error('Auto-moderation error', { 
        comment_id: commentId, 
        error: error.message 
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Batch moderation
  static async batchModerate(comments) {
    const results = {
      success: [],
      failed: []
    };

    for (const comment of comments) {
      const result = await this.autoModerate(
        comment.comment_id, 
        comment.moderation_action
      );

      if (result.success) {
        results.success.push(comment.comment_id);
      } else {
        results.failed.push({
          comment_id: comment.comment_id,
          error: result.error
        });
      }

      // Rate limiting - wait 100ms between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return {
      success: true,
      data: results,
      summary: {
        total: comments.length,
        success_count: results.success.length,
        failed_count: results.failed.length
      }
    };
  }

  // Get moderation queue
  static async getModerationQueue() {
    try {
      const results = await CommentAnalysis.findAll({
        where: {
          moderated_at: null,
          moderation_action: { [Op.in]: ['delete', 'manual_review'] },
          is_toxic: true
        },
        include: [{ model: FacebookComment, as: 'facebookComment', attributes: ['comment_id','from_name','message','created_time'] }],
        order: [['toxic_score','DESC']],
        limit: 100
      });
      const data = results.map(r => ({
        comment_id: r.comment_id,
        from_name: r.facebookComment?.from_name,
        message: r.facebookComment?.message,
        toxic_category: r.toxic_category,
        toxic_score: r.toxic_score,
        moderation_action: r.moderation_action,
        is_spam: r.is_spam,
        created_time: r.facebookComment?.created_time
      }));
      return { success: true, data, count: data.length };

    } catch (error) {
      Logger.error('Error getting moderation queue', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = ModerationService;

