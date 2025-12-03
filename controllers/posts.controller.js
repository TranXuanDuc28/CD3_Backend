const { Post } = require('../models');
const n8nService = require('../services/n8n.service');
const PostsService = require('../services/posts.service');
const { generateEmbedding } = require('../services/gemini.service');
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

  // DELETE /api/posts/:postId
  async deletePost(req, res) {
    try {
      const { postId } = req.params;
      const success = await PostsService.deletePost(postId);
      if (!success) {
        return res.status(404).json({ success: false, message: 'Post not found or could not be deleted' });
      }

      return res.json({ success: true, message: 'Post deleted' });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  // POST /api/posts/update-status
  async updatePostStatus(req, res) {
    try {
      const { postId, post_id, status } = req.body;
      console.log("postId", postId);
      console.log("post_id", post_id);
      console.log("status", status);

      const response = await PostsService.updatePostStatus(postId, post_id, status);
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
      const { title, useAI, content, topic, mediaUrl, platform, scheduledAt } = req.body;
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
        media: mediaUrl || null,
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