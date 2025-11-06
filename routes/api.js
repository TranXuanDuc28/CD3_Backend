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

