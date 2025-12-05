const { Post, PlatformPost, Engagement } = require('../models');
const { Op } = require('sequelize');
require('dotenv').config();
const axios = require("axios");
const { GoogleGenerativeAI } = require('@google/generative-ai');
const TimezoneUtils = require('../utils/timezone');
const NotificationService = require('./notificationService');
function parseCheckTimeToMinutes(str) {
  // "5 phút" => 5, "1 ngày" => 1440
  const match = str.match(/(\d+(\.\d+)?)\s*(ngày|giờ|phút)/i);
  if (!match) return 0;

  const value = parseFloat(match[1]);
  const unit = match[3].toLowerCase();

  switch (unit) {
    case 'ngày': return value * 24 * 60;
    case 'giờ': return value * 60;
    case 'phút': return value;
    default: return 0;
  }
}

class PostsService {

  //  async getPostsByStatus(status) {
  //     try {
  //       const posts = await Post.findAll({
  //         where: { status },
  //         include: [
  //           {
  //             model: PlatformPost,
  //             as: 'platformPosts'
  //           }
  //         ],
  //         order: [['created_at', 'DESC']]
  //       });

  //       return posts;
  //     } catch (error) {
  //       throw new Error(`Error fetching posts by status: ${error.message}`);
  //     }
  //   }
  // Generate AI response with chat history
  async generateResponse(prompt) {
    if (!prompt) throw new Error("Content is required");

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Missing GEMINI_API_KEY in environment");

    const url =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";


    try {
      // Gọi Gemini API bằng axios
      const response = await axios.post(
        `${url}?key=${apiKey}`,
        {
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }],
            },
          ],
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      // Lấy text từ response
      const text =
        response.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

      if (!text) {
        throw new Error("Empty response from Gemini API");
      }

      // Thử parse JSON
      let jsonOutput;
      try {
        jsonOutput = JSON.parse(text);
      } catch (err) {
        console.warn("⚠️ Failed to parse JSON from Gemini, returning raw text");
        jsonOutput = { raw: text };
      }

      // ✅ Trả về dạng tương thích với n8n (nó đọc .json.text)
      return {
        success: true,
        text: JSON.stringify(jsonOutput), // chuỗi JSON
        error: null,
      };
    } catch (error) {
      console.error(
        "❌ Gemini API error:",
        error.response?.data || error.message
      );

      // Trả về fallback dạng n8n-compatible
      return {
        success: false,
        text: JSON.stringify({
          error: "AI request failed",
          rawError: error.response?.data || error.message,
        }),
        error: error.message,
      };
    }
  }

  async getPostById(postId) {
    try {
      const post = await Post.findByPk(postId, {
        include: [
          {
            model: PlatformPost,
            as: 'platformPosts',
            required: true,
            include: [
              {
                model: Engagement,
                as: 'engagements',
                required: false
              }
            ]
          }
        ]
      });

      return post;
    } catch (error) {
      throw new Error(`Error fetching post: ${error.message}`);
    }
  }

  async getAllPosts(options = {}) {
    try {
      const { page = 1, limit = 10, status, topic } = options;
      const offset = (page - 1) * limit;

      const whereClause = {};
      if (status) whereClause.status = status;
      if (topic) whereClause.topic = { [Op.like]: `%${topic}%` };

      const { count, rows } = await Post.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: PlatformPost,
            as: 'platformPosts'
          }
        ],
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
        order: [['created_at', 'DESC']]
      });

      return {
        posts: rows,
        pagination: {
          total: count,
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          totalPages: Math.ceil(count / limit)
        }
      };
    } catch (error) {
      throw new Error(`Error fetching posts: ${error.message}`);
    }
  }

  async createPost(postData) {
    try {
      const post = await Post.create({
        ...postData,
        created_at: new Date(),
        updated_at: new Date()
      });

      return post;
    } catch (error) {
      throw new Error(`Error creating post: ${error.message}`);
    }
  }

  async updatePost(postId, updateData) {
    try {
      const [updatedRowsCount] = await Post.update(
        {
          ...updateData,
          updated_at: new Date()
        },
        {
          where: { id: postId }
        }
      );

      if (updatedRowsCount === 0) {
        return null;
      }

      return await this.getPostById(postId);
    } catch (error) {
      throw new Error(`Error updating post: ${error.message}`);
    }
  }

  async updatePostStatus(
    postId,
    facebook_post_id,
    instagram_post_id,
    status_facebook,
    status_instagram
  ) {
    try {
      const now = TimezoneUtils.now().toDate();

      // 1️⃣ Update trạng thái tổng trong Post
      const statusData = {
        status: (status_facebook === 'published' || status_instagram === 'published')
          ? 'published'
          : 'failed',
        published_at: (status_facebook === 'published' || status_instagram === 'published')
          ? now : null,
        updated_at: now,
      };

      await Post.update(statusData, { where: { id: postId } });

      // 2️⃣ Update PlatformPost cho từng nền tảng

      if (facebook_post_id) {
        await PlatformPost.update(
          {
            status: status_facebook,
            published_at: status_facebook === 'published' ? now : null,
            updated_at: now
          },
          {
            where: { post_id: postId, platform: 'facebook' }
          }
        );
      }

      if (instagram_post_id) {
        await PlatformPost.update(
          {
            status: status_instagram,
            published_at: status_instagram === 'published' ? now : null,
            updated_at: now
          },
          {
            where: { post_id: postId, platform: 'instagram' }
          }
        );
      }

      const updatedPost = await this.getPostById(postId);

      // ⭐ Trigger Notification if Special Occasion and Published
      if (updatedPost && updatedPost.isSpecialOccasion && updatedPost.status === 'published') {
        // Get Facebook Post ID if available
        const fbPost = updatedPost.platformPosts?.find(p => p.platform === 'facebook');
        const fbPostId = fbPost?.platform_post_id;
        const postUrl = fbPostId ? `https://facebook.com/${fbPostId}` : null;

        if (postUrl) {
          NotificationService.notifyRecentCustomers({
            postType: 'post',
            postId: updatedPost.id,
            postUrl: postUrl,
            message: `🎉 ${updatedPost.specialOccasionType || 'Sự kiện đặc biệt'}: ${updatedPost.title}`,
            occasionType: updatedPost.specialOccasionType
          }).catch(err => console.error('Notification trigger failed:', err));
        }
      }

      return updatedPost;

    } catch (error) {
      throw new Error(`Error updating post status: ${error.message}`);
    }
  }


  async deletePost(postId) {
    try {
      const deletedRowsCount = await Post.destroy({
        where: { id: postId }
      });

      return deletedRowsCount > 0;
    } catch (error) {
      throw new Error(`Error deleting post: ${error.message}`);
    }
  }

  async getPostsToCheck(checkTime = null) {
    try {
      // checkTime có thể là "5 phút", "1 ngày", "3 giờ"
      const minutesToSubtract = parseCheckTimeToMinutes(checkTime); // hàm parse trả về số phút
      const nowVN = TimezoneUtils.now();
      const cutoffTime = TimezoneUtils.subtract(nowVN, minutesToSubtract, 'minute');
      const cutoffTimeDB = TimezoneUtils.toDatabaseFormat(cutoffTime);

      console.log('cutoffTime for DB query:', cutoffTimeDB);

      const posts = await Post.findAll({
        where: {
          status: 'published',
          published_at: { [Op.lte]: cutoffTimeDB }
        },
        include: [
          {
            model: PlatformPost,
            as: 'platformPosts',
            where: { status: 'published', checked: false }
          }
        ],
        order: [['published_at', 'ASC']]
      });

      return posts;

    } catch (error) {
      throw new Error(`Error fetching posts to check: ${error.message}`);
    }
  }


  async getPostsByStatus(status) {
    try {
      // If requesting published posts, include those with published_at <= now
      const whereClause = {};
      if (status) {
        whereClause.status = status;
        if (status === 'published') {
          whereClause.published_at = { [Op.lte]: new Date() };
        }
      }

      const posts = await Post.findAll({
        where: whereClause,
        include: [
          {
            model: PlatformPost,
            as: 'platformPosts'
          }
        ],
        order: [['created_at', 'DESC']]
      });

      // Map to requested output shape
      const formatDate = (d) => {
        if (!d) return '';
        const dt = new Date(d);
        const pad = (n) => String(n).padStart(2, '0');
        const yyyy = dt.getFullYear();
        const mm = pad(dt.getMonth() + 1);
        const dd = pad(dt.getDate());
        const hh = pad(dt.getHours());
        const min = pad(dt.getMinutes());
        const ss = pad(dt.getSeconds());
        return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
      };

      const mapped = posts.map((p) => {
        // platform in DB may be stored as string or JSON; normalize to array
        let platforms = [];
        try {
          if (!p.platform) platforms = [];
          else if (Array.isArray(p.platform)) platforms = p.platform;
          else if (typeof p.platform === 'string') {
            // try parse JSON or split by comma
            try {
              const parsed = JSON.parse(p.platform);
              platforms = Array.isArray(parsed) ? parsed : [parsed];
            } catch (e) {
              platforms = p.platform.split(',').map(s => s.trim()).filter(Boolean);
            }
          }
        } catch (e) {
          platforms = [];
        }

        const body = {
          postId: p.id,
          title: p.title || '',
          content: p.content || '',
          topic: p.topic || '',
          useAI: !!p.useAI,
          media: p.media || '',
          platform: platforms,
          scheduledAt: formatDate(p.published_at),
          createdAt: p.created_at ? new Date(p.created_at).toISOString() : new Date().toISOString()
        };

        const bodyStr = JSON.stringify(body);
        const contentLength = Buffer.byteLength(bodyStr, 'utf8');

        const host = process.env.HOST || process.env.FRONTEND_HOST || 'localhost';
        const forwardedFor = process.env.FORWARDED_FOR || '127.0.0.1';
        const forwardedHost = process.env.FORWARDED_HOST || host;
        const forwardedPort = process.env.PORT || 443;
        const forwardedProto = process.env.FORWARDED_PROTO || 'https';
        const forwardedServer = process.env.FORWARDED_SERVER || require('os').hostname();

        const headers = {
          host,
          'user-agent': 'axios/1.12.2',
          'content-length': String(contentLength),
          accept: 'application/json, text/plain, */*',
          'accept-encoding': 'gzip, compress, deflate, br',
          'content-type': 'application/json',
          'x-forwarded-for': forwardedFor,
          'x-forwarded-host': forwardedHost,
          'x-forwarded-port': String(forwardedPort),
          'x-forwarded-proto': forwardedProto,
          'x-forwarded-server': forwardedServer,
          'x-real-ip': forwardedFor
        };

        return {
          headers,
          params: {},
          query: {},
          body,
          webhookUrl: process.env.WEBHOOK_TEST_URL || '',
          executionMode: 'test'
        };
      });

      return mapped;
    } catch (error) {
      throw new Error(`Error fetching posts by status: ${error.message}`);
    }
  }

  async getPostsByTopic(topic) {
    try {
      const posts = await Post.findAll({
        where: {
          topic: { [Op.like]: `%${topic}%` }
        },
        include: [
          {
            model: PlatformPost,
            as: 'platformPosts'
          }
        ],
        order: [['created_at', 'DESC']]
      });

      return posts;
    } catch (error) {
      throw new Error(`Error fetching posts by topic: ${error.message}`);
    }
  }
}

module.exports = new PostsService();
