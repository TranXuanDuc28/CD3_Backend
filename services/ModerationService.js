const axios = require('axios');
const { ModerationLog, CommentAnalysis, FacebookComment } = require('../models');
const { Op } = require('sequelize');
const Logger = require('../utils/logger');

class ModerationService {
  // Hide comment on Facebook
  static async hideComment(commentId) {
    try {
      // Validate input
      if (!commentId) {
        throw new Error('Comment ID is required');
      }

      const accessToken = process.env.FACEBOOK_ACCESS_TOKEN;
      if (!accessToken) {
        throw new Error('Facebook access token is not configured');
      }
      
      const url = `https://graph.facebook.com/v23.0/${commentId}`;
      console.log(`Attempting to hide comment: ${commentId}`);

      // Pre-check capabilities for better diagnostics
      try {
        const capabilities = await axios.get(url, {
          params: { fields: 'can_hide,is_hidden,from,permalink_url' },
          headers: { 'Authorization': `Bearer ${accessToken}` },
          timeout: 10000
        });
        const { can_hide, is_hidden, from, permalink_url } = capabilities.data || {};
        Logger.debug('Comment capabilities', { comment_id: commentId, can_hide, is_hidden, from, permalink_url });
        if (is_hidden === true) {
          Logger.info('Comment already hidden', { comment_id: commentId });
          return { success: true, message: 'Comment already hidden' };
        }
        if (can_hide === false) {
          Logger.warning('Comment cannot be hidden by this token/page', { comment_id: commentId, from, permalink_url });
        }
      } catch (capErr) {
        console.warn('Failed to fetch comment capabilities:', capErr.message);
      }

      // Send is_hidden as query params (Graph API friendly)
      const response = await axios.post(url, null, {
        params: { is_hidden: true },
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        timeout: 10000 // 10 second timeout
      });

      console.log(`Facebook API response:`, response.status, response.data);

      // Log moderation action
      try {
        await this.logModeration(commentId, 'hide', 'Spam detected', true);
      } catch (logError) {
        console.warn('Failed to log moderation action:', logError.message);
      }

      Logger.info('Comment hidden successfully', { comment_id: commentId });

      return {
        success: true,
        message: 'Comment hidden successfully',
        data: response.data
      };

    } catch (error) {
      console.error(`Failed to hide comment ${commentId}:`, error.message);
      
      // Try to log the error
      try {
        await this.logModeration(commentId, 'hide', 'Spam detected', false, error.message);
      } catch (logError) {
        console.warn('Failed to log moderation error:', logError.message);
      }
      
      Logger.error('Failed to hide comment', { 
        comment_id: commentId, 
        error: error.message,
        response: error.response?.data
      });

      return {
        success: false,
        error: error.message,
        details: error.response?.data || null
      };
    }
  }

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

  // Restore (unhide) comment
  static async restoreComment(commentId) {
    try {
      const accessToken = process.env.FACEBOOK_ACCESS_TOKEN;
      
      const url = `https://graph.facebook.com/v23.0/${commentId}`;
      const response = await axios.post(url, {
        is_hidden: false
      }, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      await this.logModeration(commentId, 'restore', 'Manual restore', true);

      Logger.info('Comment restored', { comment_id: commentId });

      return {
        success: true,
        message: 'Comment restored successfully'
      };

    } catch (error) {
      await this.logModeration(commentId, 'restore', 'Manual restore', false, error.message);
      
      Logger.error('Failed to restore comment', { 
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
      } else if (moderationAction === 'hide') {
        return await this.hideComment(commentId);
      } else {
        return {
          success: true,
          message: 'No action needed',
          action: moderationAction
        };
      }
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
          moderation_action: { [Op.in]: ['delete','hide'] },
          [Op.or]: [{ is_toxic: true }, { is_spam: true }]
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

