const express = require('express');
const router = express.Router();

// Example route
router.get('/status', (req, res) => {
  res.json({ status: 'API is running' });
});

module.exports = router;

//--------------------------------------Van Bao ----------------------------
// ChatAI routes
const chatAIController = new ChatAIController();
router.post('/chatai/ai-reply', (req, res) => chatAIController.aiReply(req, res));
router.get('/chatai/users', (req, res) => chatAIController.getUsers(req, res));
router.get('/chatai/users/:userId/conversations', (req, res) => chatAIController.getUserConversations(req, res));
router.get('/chatai/responses', (req, res) => chatAIController.getResponses(req, res));
router.post('/chatai/responses', (req, res) => chatAIController.addResponse(req, res));
router.get('/chatai/analytics', (req, res) => chatAIController.getAnalytics(req, res));
router.get('/chatai/stats', (req, res) => chatAIController.getStats(req, res));
router.post('/chatai/test-ai', (req, res) => chatAIController.testAI(req, res));
router.post('/chatai/refresh-dynamic-content', (req, res) => chatAIController.refreshDynamicContent(req, res));
router.get('/chatai/posts-analysis', (req, res) => chatAIController.getPostsForAnalysis(req, res));

module.exports = router;
