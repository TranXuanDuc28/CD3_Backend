"use strict";

const {
  Token
} = require('../models');
const SocialService = require('../services/socialService');
class SocialController {
  // POST /api/post-to-facebook
  async postToFacebook(req, res) {
    try {
      const postData = req.body;

      // Get Facebook token
      const token = await Token.findOne({
        where: {
          platform: 'facebook',
          is_active: true
        }
      });
      if (!token) {
        return res.status(400).json({
          success: false,
          message: 'Facebook token not found'
        });
      }

      // Mock response for development
      // const mockResponse = {
      //   success: true,
      //   postId: 'fb_' + Date.now(),
      //   platform: 'facebook',
      //   content: postData.content,
      //   image_url: postData.image_url,
      //   published_at: new Date().toISOString(),
      //   platform_post_id: 'fb_' + Date.now()
      // };

      // res.json(mockResponse);
      const response = await SocialService.postToFacebook(postData);
      // Persist platform post record
      try {
        const {
          PlatformPost,
          Post
        } = require('../models');
        const platformPost = await PlatformPost.create({
          post_id: postData.original_post_id || postData.postId || null,
          platform: 'facebook',
          platform_post_id: response.postId || null,
          content: postData.content || '',
          hashtags: postData.hashtags || [],
          image_url: postData.image_url || null,
          post_type: postData.post_type || null,
          best_time: postData.best_time || null,
          priority: postData.priority || 'normal',
          status: response.success ? 'published' : 'failed',
          published_at: response.published_at ? new Date(response.published_at) : new Date(),
          created_at: new Date(),
          updated_at: new Date()
        });

        // Update parent post status if original_post_id exists
        if (postData.original_post_id) {
          await Post.update({
            status: response.success ? 'published' : 'failed',
            platform_post_id: response.postId
          }, {
            where: {
              id: postData.original_post_id
            }
          });
        }
      } catch (e) {
        console.warn('Could not persist PlatformPost for facebook:', e.message);
      }
      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // POST /api/post-to-instagram
  async postToInstagram(req, res) {
    try {
      const postData = req.body;

      // Get Instagram token
      const token = await Token.findOne({
        where: {
          platform: 'instagram',
          is_active: true
        }
      });
      if (!token) {
        return res.status(400).json({
          success: false,
          message: 'Instagram token not found'
        });
      }

      // Mock response for development
      // const mockResponse = {
      //   success: true,
      //   postId: 'ig_' + Date.now(),
      //   platform: 'instagram',
      //   content: postData.content,
      //   image_url: postData.image_url,
      //   published_at: new Date().toISOString(),
      //   platform_post_id: 'ig_' + Date.now()
      // };

      // res.json(mockResponse);
      const response = await SocialService.postToInstagram(postData);
      try {
        const {
          PlatformPost,
          Post
        } = require('../models');
        const platformPost = await PlatformPost.create({
          post_id: postData.original_post_id || postData.postId || null,
          platform: 'instagram',
          platform_post_id: response.postId || null,
          content: postData.content || '',
          hashtags: postData.hashtags || [],
          image_url: postData.image_url || null,
          post_type: postData.post_type || null,
          aspect_ratio: postData.aspect_ratio || null,
          best_time: postData.best_time || null,
          priority: postData.priority || 'normal',
          status: response.success ? 'published' : 'failed',
          published_at: response.published_at ? new Date(response.published_at) : new Date(),
          created_at: new Date(),
          updated_at: new Date()
        });
        if (postData.original_post_id) {
          await Post.update({
            status: response.success ? 'published' : 'failed',
            platform_post_id: response.postId
          }, {
            where: {
              id: postData.original_post_id
            }
          });
        }
      } catch (e) {
        console.warn('Could not persist PlatformPost for instagram:', e.message);
      }
      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}
module.exports = new SocialController();