const express = require('express');
const router = express.Router();
const postsController = require('../controllers/postsController');
const tokensController = require('../controllers/tokensController');
const uploadController = require('../controllers/uploadController');
const socialController = require('../controllers/socialController');
const engagementController = require('../controllers/engagementController');
const mailController = require('../controllers/mailController');
// Example route
router.get('/status', (req, res) => {
  res.json({ status: 'API is running' });
});
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Backend is running',
    timestamp: new Date().toISOString()
  });
});
//--------------------------------------Xuan Duc----------------------------
router.post('/generate-content-gemini', postsController.generateContentWithGemini);
router.get('/posts/:postId', postsController.getPostById);
router.get('/get-all-posts', postsController.getAllPosts);
router.post('/posts/update-status', postsController.updatePostStatus);
router.post('/list-to-check', postsController.getPostsToCheck);
router.get('/unpublished-post', postsController.getUnpublishedPosts);
router.post('/schedule-post', postsController.schedulePost);
router.get('/tokens/active', tokensController.getActiveTokens);
router.post('/tokens/create', tokensController.createToken);
router.post('/generate', generateController.generateContent);
router.post('/upload-cloudinary', uploadController.uploadToCloudinary);
router.post('/post-to-facebook', socialController.postToFacebook);
router.post('/post-to-instagram', socialController.postToInstagram);
router.post('/get-engagement', engagementController.getEngagement);
router.post('/send-mail', mailController.sendMail);
router.post("/embed", postsController.createEmbeddings);

module.exports = router;

