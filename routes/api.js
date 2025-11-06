const express = require('express');
const router = express.Router();
const CommentController = require('../controllers/CommentController');
const AnalyticsController = require('../controllers/AnalyticsController');
const ModerationController = require('../controllers/ModerationController');

// Example route
router.get('/status', (req, res) => {
  res.json({ status: 'API is running' });
});

module.exports = router;

router.get('/comments', CommentController.list);
router.get('/comments/stats', CommentController.getStats);
router.get('/comments/recent', CommentController.getRecent);
router.post('/comments/process', CommentController.processComments);
router.post('/comments/mark-handled', CommentController.markHandled);
router.post('/comments/check-handled', CommentController.checkHandled);
router.get('/comments/unhandled', CommentController.getUnhandled);
router.get('/comments/:commentId/history', CommentController.getHistory);
router.get('/comments/:commentId', CommentController.getComment);
router.patch('/comments/:commentId/status', CommentController.updateStatus);

// Post routes
router.post('/posts/save', CommentController.savePosts);

// AI routes
router.post('/ai/generate-response', CommentController.generateResponse);
router.post('/ai/process-template', CommentController.processTemplate);

// Analytics routes
router.get('/analytics/summary', AnalyticsController.getSummary);
router.get('/analytics/sentiment-trend', AnalyticsController.getSentimentTrend);
router.get('/analytics/keywords', AnalyticsController.getTopKeywords);
router.get('/analytics/dashboard', AnalyticsController.getDashboard);

// Moderation routes
router.get('/moderation/queue', ModerationController.getQueue);
router.get('/moderation/stats', ModerationController.getStats);
router.get('/moderation/toxic-review', ModerationController.getToxicForReview);
router.post('/moderation/delete', ModerationController.deleteComment);
router.post('/moderation/batch', ModerationController.batchModerate);