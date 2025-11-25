"use strict";

const axios = require('axios');
const tokensService = require('./tokensService');
class SocialService {
  constructor() {
    this.apiEndpoints = {
      facebook: 'https://graph.facebook.com/v18.0',
      instagram: 'https://graph.facebook.com/v18.0',
      twitter: 'https://api.twitter.com/2',
      linkedin: 'https://api.linkedin.com/v2'
    };
  }
  async postToFacebook(postData) {
    try {
      const token = await tokensService.getTokenByPlatform('facebook');
      console.log("token", token.access_token);
      console.log("postData", postData);
      if (!token) {
        throw new Error('Facebook token not found');
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

      // Real implementation would look like this:

      const response = await axios.post(`${this.apiEndpoints.facebook}/me/feed`, {
        message: postData.content,
        link: postData.image_url,
        access_token: token.access_token
      });
      return {
        success: true,
        postId: response.data.id,
        platform: 'facebook',
        content: postData.content,
        published_at: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Error posting to Facebook: ${error.message}`);
    }
  }
  async postToInstagram(postData) {
    try {
      console.log("postData", postData);
      const token = await tokensService.getTokenByPlatform('instagram');
      console.log("token", token.access_token);
      if (!token) {
        throw new Error('Instagram token not found');
      }
      const igUserId = "17841477144867201"; // lấy từ Graph API (linked với page)

      // 1. Tạo media container
      const mediaRes = await axios.post(`https://graph.facebook.com/v18.0/${igUserId}/media`, null, {
        params: {
          image_url: postData.image_url,
          caption: postData.content,
          access_token: token.access_token
        }
      });
      console.log("mediaRes", mediaRes.data);
      const creationId = mediaRes.data.id;
      console.log("creationId", creationId);
      // ✅ chờ 2 giây cho media sẵn sàng
      await new Promise(r => setTimeout(r, 2000));

      // 2. Publish media
      const publishRes = await axios.post(`https://graph.facebook.com/v18.0/${igUserId}/media_publish`, null, {
        params: {
          creation_id: creationId,
          access_token: token.access_token
        }
      });
      console.log("publishRes", publishRes.data);
      const postId = publishRes.data.id;
      return {
        success: true,
        postId,
        platform: 'instagram',
        content: postData.content,
        published_at: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Error posting to Instagram: ${error.message}`);
    }
  }
  async postToTwitter(postData) {
    try {
      const token = await tokensService.getTokenByPlatform('twitter');
      if (!token) {
        throw new Error('Twitter token not found');
      }

      // Mock response for development
      const mockResponse = {
        success: true,
        postId: 'tw_' + Date.now(),
        platform: 'twitter',
        content: postData.content,
        image_url: postData.image_url,
        published_at: new Date().toISOString(),
        platform_post_id: 'tw_' + Date.now()
      };

      // Real implementation would use Twitter API v2

      return mockResponse;
    } catch (error) {
      throw new Error(`Error posting to Twitter: ${error.message}`);
    }
  }
  async postToLinkedIn(postData) {
    try {
      const token = await tokensService.getTokenByPlatform('linkedin');
      if (!token) {
        throw new Error('LinkedIn token not found');
      }

      // Mock response for development
      const mockResponse = {
        success: true,
        postId: 'li_' + Date.now(),
        platform: 'linkedin',
        content: postData.content,
        image_url: postData.image_url,
        published_at: new Date().toISOString(),
        platform_post_id: 'li_' + Date.now()
      };

      // Real implementation would use LinkedIn API

      return mockResponse;
    } catch (error) {
      throw new Error(`Error posting to LinkedIn: ${error.message}`);
    }
  }
  async getPostAnalytics(platform, postId) {
    try {
      const token = await tokensService.getTokenByPlatform(platform);
      if (!token || !token.access_token) {
        throw new Error(`${platform} token not found or invalid`);
      }
      let likes = 0,
        comments = 0,
        shares = 0;

      // ===================== FACEBOOK =====================
      if (platform === 'facebook') {
        console.log(`📊 Fetching Facebook analytics for post ${postId}...`);
        try {
          // Chỉ lấy reactions, comments, shares
          const baseResp = await axios.get(`https://graph.facebook.com/v19.0/${postId}`, {
            params: {
              fields: 'reactions.summary(true),comments.summary(true),shares',
              access_token: token.access_token
            }
          });
          const baseData = baseResp.data || {};
          likes = baseData?.reactions?.summary?.total_count || 0;
          comments = baseData?.comments?.summary?.total_count || 0;
          shares = baseData?.shares?.count || 0;
          console.log(`✅ Facebook Post ${postId} — Likes: ${likes}, Comments: ${comments}, Shares: ${shares}`);
        } catch (err) {
          console.warn(`⚠️ Could not fetch metrics for Facebook post ${postId}:`, err.response?.data || err.message);
        }
      }

      // ===================== INSTAGRAM =====================
      else if (platform === 'instagram') {
        console.log(`📊 Fetching Instagram analytics for media ${postId}...`);
        try {
          // Instagram API v19.0 — chỉ lấy like_count và comments_count
          const resp = await axios.get(`https://graph.facebook.com/v19.0/${postId}`, {
            params: {
              fields: 'like_count,comments_count',
              access_token: token.access_token
            }
          });
          const data = resp.data || {};
          likes = data.like_count || 0;
          comments = data.comments_count || 0;
          shares = 0; // Instagram không có shares

          console.log(`✅ Instagram Media ${postId} — Likes: ${likes}, Comments: ${comments}`);
        } catch (err) {
          console.warn(`⚠️ Could not fetch metrics for Instagram media ${postId}:`, err.response?.data || err.message);
        }
      }

      // ===================== OTHER PLATFORMS (mock data) =====================
      else {
        likes = Math.floor(Math.random() * 1000);
        comments = Math.floor(Math.random() * 100);
        shares = Math.floor(Math.random() * 50);
      }

      // ===================== ✅ TÍNH ENGAGEMENT SCORE =====================
      // Công thức: likes + (comments × 2) + (shares × 3)
      const totalEngagement = likes + comments * 2 + shares * 3;
      const engagementScore = parseFloat(totalEngagement.toFixed(2));
      const result = {
        platform,
        postId,
        likes,
        comments,
        shares,
        engagement_score: engagementScore,
        last_updated: new Date().toISOString()
      };
      console.log(`📈 Engagement score for ${platform} post ${postId}: ${engagementScore}`);
      return result;
    } catch (error) {
      console.error(`❌ Error getting analytics for ${platform} ${postId}:`, error.response?.data || error.message);
      throw new Error(`Error getting analytics: ${error.message}`);
    }
  }
  async sendFacebookMessage(psid, message) {
    try {
      const token = await tokensService.getTokenByPlatform('facebook');
      if (!token) throw new Error('Facebook token not found');
      const url = `https://graph.facebook.com/v11.0/me/messages`;
      const payload = {
        recipient: {
          id: psid
        },
        messaging_type: 'UPDATE',
        message: {}
      };
      if (message.image_url) {
        payload.message = {
          attachment: {
            type: 'image',
            payload: {
              url: message.image_url,
              is_reusable: false
            }
          }
        };
        // also send text as separate message
        await axios.post(url, payload, {
          params: {
            access_token: token.access_token
          }
        });
        payload.message = {
          text: message.text || ''
        };
      } else {
        payload.message = {
          text: message.text || ''
        };
      }
      const resp = await axios.post(url, payload, {
        params: {
          access_token: token.access_token
        }
      });
      return resp.data;
    } catch (err) {
      throw new Error(`Error sending FB message: ${err.message}`);
    }
  }
  async schedulePost(scheduleData) {
    try {
      const {
        platform,
        content,
        scheduled_time,
        image_url
      } = scheduleData;
      if (!platform || !content || !scheduled_time) {
        throw new Error('Platform, content, and scheduled_time are required');
      }

      // Mock scheduling response
      const mockResponse = {
        success: true,
        scheduled_post_id: 'sched_' + Date.now(),
        platform: platform,
        content: content,
        scheduled_time: scheduled_time,
        image_url: image_url,
        status: 'scheduled',
        created_at: new Date().toISOString()
      };

      // Real implementation would store the scheduled post and use a job queue

      return mockResponse;
    } catch (error) {
      throw new Error(`Error scheduling post: ${error.message}`);
    }
  }
  async optimizeContentForPlatform(content, platform) {
    try {
      const optimizations = {
        facebook: {
          maxLength: 63206,
          hashtags: 5,
          emojis: true
        },
        instagram: {
          maxLength: 2200,
          hashtags: 30,
          emojis: true
        },
        twitter: {
          maxLength: 280,
          hashtags: 3,
          emojis: true
        },
        linkedin: {
          maxLength: 3000,
          hashtags: 5,
          emojis: false
        }
      };
      const config = optimizations[platform];
      if (!config) {
        throw new Error(`Unsupported platform: ${platform}`);
      }
      let optimizedContent = content;

      // Truncate if too long
      if (optimizedContent.length > config.maxLength) {
        optimizedContent = optimizedContent.substring(0, config.maxLength - 3) + '...';
      }

      // Extract hashtags
      const hashtags = optimizedContent.match(/#\w+/g) || [];

      // Limit hashtags
      if (hashtags.length > config.hashtags) {
        const limitedHashtags = hashtags.slice(0, config.hashtags);
        optimizedContent = optimizedContent.replace(/#\w+/g, '').trim();
        optimizedContent += '\n\n' + limitedHashtags.join(' ');
      }
      return {
        optimized_content: optimizedContent,
        original_length: content.length,
        optimized_length: optimizedContent.length,
        hashtags_count: hashtags.length,
        platform: platform
      };
    } catch (error) {
      throw new Error(`Error optimizing content: ${error.message}`);
    }
  }
  async validatePostData(postData, platform) {
    try {
      const validations = {
        facebook: {
          required: ['content'],
          maxContentLength: 63206,
          allowedImageFormats: ['jpg', 'jpeg', 'png', 'gif']
        },
        instagram: {
          required: ['content', 'image_url'],
          maxContentLength: 2200,
          allowedImageFormats: ['jpg', 'jpeg', 'png']
        },
        twitter: {
          required: ['content'],
          maxContentLength: 280,
          allowedImageFormats: ['jpg', 'jpeg', 'png', 'gif']
        },
        linkedin: {
          required: ['content'],
          maxContentLength: 3000,
          allowedImageFormats: ['jpg', 'jpeg', 'png']
        }
      };
      const validation = validations[platform];
      if (!validation) {
        throw new Error(`Unsupported platform: ${platform}`);
      }

      // Check required fields
      for (const field of validation.required) {
        if (!postData[field]) {
          throw new Error(`${field} is required for ${platform}`);
        }
      }

      // Check content length
      if (postData.content && postData.content.length > validation.maxContentLength) {
        throw new Error(`Content too long for ${platform}. Maximum ${validation.maxContentLength} characters.`);
      }

      // Check image format if image_url is provided
      if (postData.image_url) {
        const imageExtension = postData.image_url.split('.').pop().toLowerCase();
        if (!validation.allowedImageFormats.includes(imageExtension)) {
          throw new Error(`Image format not supported for ${platform}. Allowed: ${validation.allowedImageFormats.join(', ')}`);
        }
      }
      return {
        valid: true,
        platform: platform,
        validated_at: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Validation error: ${error.message}`);
    }
  }
}
module.exports = new SocialService();