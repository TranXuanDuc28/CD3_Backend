const ModerationService = require('../services/ModerationService');
const ToxicDetectionService = require('../services/ToxicDetectionService');
const Logger = require('../utils/logger');

class ModerationController {
  // GET /api/moderation/queue
  static async getQueue(req, res) {
    try {
      const result = await ModerationService.getModerationQueue();
      res.json(result);
    } catch (error) {
      Logger.error('GetQueue error', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // GET /api/moderation/stats?days=7
  static async getStats(req, res) {
    try {
      const days = parseInt(req.query.days) || 7;
      const result = await ToxicDetectionService.getModerationStats(days);
      res.json(result);
    } catch (error) {
      Logger.error('GetStats error', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // POST /api/moderation/delete
  static async deleteComment(req, res) {
    try {
      const { comment_id } = req.body;
      
      if (!comment_id) {
        return res.status(400).json({
          success: false,
          error: 'comment_id is required'
        });
      }

      const result = await ModerationService.deleteComment(comment_id);
      res.json(result);
    } catch (error) {
      Logger.error('DeleteComment error', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // POST /api/moderation/batch
  static async batchModerate(req, res) {
    try {
      const { comments } = req.body;
      
      if (!comments || !Array.isArray(comments)) {
        return res.status(400).json({
          success: false,
          error: 'comments array is required'
        });
      }

      const result = await ModerationService.batchModerate(comments);
      res.json(result);
    } catch (error) {
      Logger.error('BatchModerate error', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // GET /api/moderation/toxic-review?min_severity=2.0
  static async getToxicForReview(req, res) {
    try {
      const minSeverity = parseFloat(req.query.min_severity) || 2.0;
      const result = await ToxicDetectionService.getToxicCommentsForReview(minSeverity);
      res.json(result);
    } catch (error) {
      Logger.error('GetToxicForReview error', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

module.exports = ModerationController;

