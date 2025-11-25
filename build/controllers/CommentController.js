"use strict";

const CommentService = require('../services/CommentService');
const Logger = require('../utils/logger');
class CommentController {
  // POST /api/comments/process
  // Process new comments and generate AI responses
  static async processComments(req, res) {
    try {
      const {
        comments,
        session_id
      } = req.body;
      if (!comments || !Array.isArray(comments)) {
        return res.status(400).json({
          success: false,
          error: 'Comments array is required'
        });
      }
      const sessionId = session_id || `session_${Date.now()}`;
      const result = await CommentService.processComments(comments, sessionId);
      res.json(result);
    } catch (error) {
      Logger.error('ProcessComments controller error', {
        error: error.message
      });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // POST /api/comments/mark-handled
  // Mark comments as handled after replying
  static async markHandled(req, res) {
    try {
      const {
        handled_comments
      } = req.body;
      if (!handled_comments || !Array.isArray(handled_comments)) {
        return res.status(400).json({
          success: false,
          error: 'handled_comments array is required'
        });
      }
      const result = await CommentService.markCommentsHandled(handled_comments);
      res.json(result);
    } catch (error) {
      Logger.error('MarkHandled controller error', {
        error: error.message
      });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // POST /api/comments/check-handled
  // Check if a single comment is already handled
  static async checkHandled(req, res) {
    try {
      const {
        comment_id,
        session_id
      } = req.body;
      if (!comment_id) {
        return res.status(400).json({
          success: false,
          error: 'comment_id is required'
        });
      }
      const result = await CommentService.checkSingleCommentHandled(comment_id, session_id);
      res.json(result);
    } catch (error) {
      Logger.error('CheckHandled controller error', {
        error: error.message
      });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // GET /api/comments/unhandled
  // Get all unhandled comments
  static async getUnhandled(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 100;
      const result = await CommentService.getUnhandledComments(limit);
      res.json(result);
    } catch (error) {
      Logger.error('GetUnhandled controller error', {
        error: error.message
      });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // POST /api/posts/save
  // Save Facebook posts to database
  static async savePosts(req, res) {
    try {
      const {
        posts
      } = req.body;
      if (!posts || !Array.isArray(posts)) {
        return res.status(400).json({
          success: false,
          error: 'posts array is required'
        });
      }
      const result = await CommentService.savePosts(posts);
      res.json(result);
    } catch (error) {
      Logger.error('SavePosts controller error', {
        error: error.message
      });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // POST /api/ai/generate-response
  // Generate AI response for a single message
  static async generateResponse(req, res) {
    try {
      const {
        message,
        user_name,
        user_id,
        post_id,
        session_id,
        workflow_data
      } = req.body;
      if (!message) {
        return res.status(400).json({
          success: false,
          error: 'message is required'
        });
      }
      const sessionId = session_id || `session_${Date.now()}`;
      const result = await CommentService.generateAIResponse(message, user_name || 'User', user_id || 'unknown', post_id || '', sessionId, workflow_data || {});
      res.json(result);
    } catch (error) {
      Logger.error('GenerateResponse controller error', {
        error: error.message
      });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // POST /api/ai/process-template
  // Process template with workflow data
  static async processTemplate(req, res) {
    try {
      const {
        prompt_name,
        workflow_data
      } = req.body;
      if (!prompt_name) {
        return res.status(400).json({
          success: false,
          error: 'prompt_name is required'
        });
      }
      const processedPrompt = await AIPrompt.getProcessedPrompt(prompt_name, workflow_data || {});
      res.json({
        success: true,
        processed_prompt: processedPrompt,
        original_data: workflow_data
      });
    } catch (error) {
      Logger.error('ProcessTemplate controller error', {
        error: error.message
      });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}
module.exports = CommentController;