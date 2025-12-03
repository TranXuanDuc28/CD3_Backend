const { Post } = require('../models');
const n8nService = require('../services/n8nService');
const PostsService = require('../services/postsService');
const { generateEmbedding } = require('../services/geminiService');
const TimezoneUtils = require('../utils/timezone');

class PostsController {
  async getUnpublishedPosts(req, res) {
    try {
      const posts = await PostsService.getPostsByStatus('scheduled');
      res.json(posts);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  async generateContentWithGemini(req, res) {
    try {
      const { prompt } = req.body;

      if (!prompt) {
        return res.status(400).json({ error: "Content is required" });
      }

      const result = await PostsService.generateResponse(prompt);

      res.json(result);
    } catch (err) {
      console.error("Controller error:", err);
      res.status(500).json({ error: err.message });
    }
}
  // GET /api/get-all-posts
  async getAllPosts(req, res) {
    try {
      const result = await PostsService.getAllPosts();
      res.json(result.posts || result);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  // GET /api/posts/:postId
  async getPostById(req, res) {
    try {
      const { postId } = req.params;
      
      const post = await Post.findByPk(postId);
      
      if (!post) {
        return res.status(404).json({
          success: false,
          message: 'Post not found'
        });
      }

      res.json(post);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // POST /api/posts/update-status
  async updatePostStatus(req, res) {
    try {
      const { postId, facebook_post_id, instagram_post_id, status_facebook, status_instagram} = req.body;

      const response = await PostsService.updatePostStatus(postId, facebook_post_id, instagram_post_id, status_facebook, status_instagram);
      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // GET /api/list-to-check
  async getPostsToCheck(req, res) {
    try {
      const { checkTime } = req.body; // Nhận thời gian từ FE
      console.log('checkTime', checkTime);  
      const posts = await PostsService.getPostsToCheck(checkTime);

      res.json(posts);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // POST /api/schedule-post
  async schedulePost(req, res) {
    try {
      const { title, useAI, content, topic, media, platform, scheduledAt } = req.body;
      console.log('Received schedulePost request:', req.body);

      // Validate required fields
      if (!title || !content || !topic || !platform) {
        return res.status(400).json({
          success: false,
          message: 'title, content, topic, and platform are required'
        });
      }

      // Create post in database with Vietnam timezone
      const newPost = await Post.create({
        title,
        content,
        topic,
        useAI: useAI || false,
        media: media || null,
        platform: Array.isArray(platform) ? platform.join(',') : platform,
        status: scheduledAt ? 'scheduled' : 'pending',
        published_at: scheduledAt ? new Date(scheduledAt) : null,
        created_at: TimezoneUtils.now().toDate(),
        updated_at: TimezoneUtils.now().toDate()
      });

      // Trigger n8n workflow
      const n8nPayload = {
        category: "content_management",
        postId: newPost.id,
        title: newPost.title,
        content: newPost.content,
        topic: newPost.topic,
        useAI: newPost.useAI,
        media: newPost.media,
        platform: Array.isArray(platform) ? platform : [platform],
        scheduledAt: scheduledAt || null,
        createdAt: newPost.created_at
      };

      // Trigger n8n workflow
      const n8nResult = await n8nService.triggerSchedulePost(n8nPayload);

      res.json({
        success: true,
        message: 'Post scheduled successfully',
        data: {
          postId: newPost.id,
          title: newPost.title,
          status: newPost.status,
          scheduledAt: newPost.published_at,
          n8nTriggered: n8nResult.success,
          n8nResult: n8nResult
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // POST /api/embed
  async createEmbeddings(req, res) {
    try {
      const { text } = req.body;

      if (!text || text.trim() === '') {
        return res.status(400).json({ error: "Thiếu trường 'text'" });
      }

      const embedding = await generateEmbedding(text);

      return res.json({
        success: true,
        model: 'models/text-embedding-004',
        embedding,
      });
    } catch (err) {
      console.error('❌ Lỗi tạo embedding:', err);
      res.status(500).json({
        error: 'Không thể tạo embedding từ Gemini API',
        detail: err.message,
      });
    }
  }
}

module.exports = new PostsController();