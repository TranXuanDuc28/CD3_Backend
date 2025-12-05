const { ChatAIUser, ChatAIConversation, ChatAIResponse, ChatAIAnalytics, Post, PlatformPost, Engagement, AbTest, AbTestVariant } = require('../models');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Logger = require('../utils/logger');

class ChatAIService {
  constructor() {
    this.logger = Logger;
    this.gemini = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
    this.model = this.gemini ? this.gemini.getGenerativeModel({ model: "gemini-2.5-flash" }) : null;
  }

  /**
   * Get or create ChatAI user
   */
  async getOrCreateUser(facebookId, userProfile = {}) {
    try {
      let user = await ChatAIUser.findOne({ where: { facebook_id: facebookId } });

      if (!user) {
        user = await ChatAIUser.create({
          facebook_id: facebookId,
          first_name: userProfile.first_name || 'User',
          last_name: userProfile.last_name || '',
          profile_pic: userProfile.profile_pic || ''
        });
        this.logger.info('Created new ChatAI user', { userId: user.id, facebookId });
      } else {
        // Update existing user profile
        await user.update({
          first_name: userProfile.first_name || user.first_name,
          last_name: userProfile.last_name || user.last_name,
          profile_pic: userProfile.profile_pic || user.profile_pic
        });
        this.logger.info('Updated existing ChatAI user', { userId: user.id, facebookId });
      }

      return user;
    } catch (error) {
      this.logger.error('Error getting/creating ChatAI user', { error: error.message, facebookId });
      throw error;
    }
  }

  /**
   * Save conversation message
   */
  async saveMessage(userId, messageText, messageType, facebookMessageId = null, conversationId = null) {
    try {
      const conversation = await ChatAIConversation.create({
        user_id: userId,
        message_text: messageText,
        message_type: messageType,
        facebook_message_id: facebookMessageId,
        conversation_id: conversationId
      });

      this.logger.debug('Saved ChatAI conversation', {
        conversationId: conversation.id,
        userId,
        messageType,
        messageLength: messageText.length
      });

      return conversation;
    } catch (error) {
      this.logger.error('Error saving ChatAI conversation', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Get conversation history
   */
  async getConversationHistory(userId, limit = 10) {
    try {
      const conversations = await ChatAIConversation.findAll({
        where: { user_id: userId },
        order: [['timestamp', 'ASC']],
        limit: limit,
        raw: true
      });

      // Reverse to get chronological order
      return conversations.reverse();
    } catch (error) {
      this.logger.error('Error getting ChatAI conversation history', { error: error.message, userId });
      return [];
    }
  }

  /**
   * Get all responses for keyword matching (includes dynamic content from posts)
   */
  async getAllResponses() {
    try {
      // Get static responses
      const staticResponses = await ChatAIResponse.findAll({
        where: { is_active: true },
        raw: true
      });

      // Get dynamic content from published posts
      const dynamicContent = await this.getDynamicContentFromPosts();

      // Get A/B test insights for better responses
      const abTestInsights = await this.getABTestInsights();

      // Combine static, dynamic, and A/B test responses
      const allResponses = [...staticResponses, ...dynamicContent, ...abTestInsights];

      this.logger.debug('Retrieved ChatAI responses', {
        static: staticResponses.length,
        dynamic: dynamicContent.length,
        abTest: abTestInsights.length,
        total: allResponses.length
      });

      return allResponses;
    } catch (error) {
      this.logger.error('Error getting ChatAI responses', { error: error.message });
      return [];
    }
  }

  /**
   * Get dynamic content from published posts
   */
  async getDynamicContentFromPosts() {
    try {
      // Get recent published posts with their platform posts and engagement data
      const recentPosts = await Post.findAll({
        where: {
          status: 'published',
          published_at: {
            [require('sequelize').Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
          }
        },
        include: [
          {
            model: PlatformPost,
            as: 'platformPosts',
            required: false
          },
          {
            model: Engagement,
            as: 'engagements',
            required: false
          }
        ],
        order: [['published_at', 'DESC']],
        limit: 50
      });
      const dynamicResponses = [];

      for (const post of recentPosts) {
        // Extract topics and keywords from post content
        const topics = this.extractTopicsFromPost(post);

        // Try to extract an image URL from post.media (if any)
        let imageUrl = null;
        try {
          const media = post.media;
          if (media) {
            const m = typeof media === 'string' ? JSON.parse(media) : media;
            if (Array.isArray(m)) {
              const firstImg = m.find(item => typeof item === 'string' && /\.(png|jpe?g|webp|gif)$/i.test(item));
              if (firstImg) imageUrl = firstImg;
            } else if (typeof m === 'object') {
              if (m.url && typeof m.url === 'string') imageUrl = m.url;
              if (!imageUrl && Array.isArray(m.images)) {
                const firstImg = m.images.find(u => typeof u === 'string');
                if (firstImg) imageUrl = firstImg;
              }
            }
          }
        } catch (_) {
          // ignore malformed media json
        }

        // Create dynamic responses based on post content
        for (const topic of topics) {
          dynamicResponses.push({
            keyword: topic.keyword,
            response_text: topic.response,
            category: 'dynamic_post',
            post_id: post.id,
            post_title: post.title,
            engagement_score: this.calculateEngagementScore(post.engagements),
            is_active: true,
            image_url: imageUrl || null
          });
        }

        // Also leverage platform-specific content as potential responses
        if (post.platformPosts && Array.isArray(post.platformPosts)) {
          for (const pp of post.platformPosts) {
            if (pp.content) {
              // Extract keywords from platform post content for better matching
              const platformKeywords = this.extractKeywordsFromText(pp.content);

              // Create response for each extracted keyword
              for (const keyword of platformKeywords) {
                dynamicResponses.push({
                  keyword: keyword.toLowerCase(),
                  response_text: pp.content,
                  category: 'dynamic_platform_post',
                  post_id: post.id,
                  post_title: post.title,
                  platform: pp.platform,
                  platform_post_id: pp.id,
                  status: pp.status,
                  is_active: true,
                  image_url: pp.image_url || imageUrl || null
                });
              }

              // Also add a general response based on post topic/title
              if (post.topic || post.title) {
                dynamicResponses.push({
                  keyword: (post.topic || post.title || '').toLowerCase(),
                  response_text: pp.content,
                  category: 'dynamic_platform_post',
                  post_id: post.id,
                  post_title: post.title,
                  platform: pp.platform,
                  platform_post_id: pp.id,
                  status: pp.status,
                  is_active: true,
                  image_url: pp.image_url || imageUrl || null
                });
              }
            }
          }
        }

        // Add campaign-specific responses
        if (post.campaign) {
          const campaignResponses = this.generateCampaignResponses(post);
          dynamicResponses.push(...campaignResponses);
        }
      }

      this.logger.debug('Generated dynamic responses from posts', {
        postsProcessed: recentPosts.length,
        responsesGenerated: dynamicResponses.length
      });

      return dynamicResponses;
    } catch (error) {
      this.logger.error('Error getting dynamic content from posts', { error: error.message });
      return [];
    }
  }

  /**
   * Get A/B test insights for enhanced responses
   */
  async getABTestInsights() {
    try {
      const tests = await AbTest.findAll({
        where: { status: 'completed' },
        include: [{
          model: AbTestVariant,
          as: 'variants'
        }],
        order: [['completedAt', 'DESC']],
        limit: 50
      });

      const insights = [];

      for (const test of tests) {
        const variants = Array.isArray(test.variants) ? test.variants : [];
        if (variants.length === 0) continue;

        // Choose best by metrics.engagement || likes+comments+shares || ctr
        let best = null;
        let bestScore = -Infinity;
        for (const v of variants) {
          const m = v.metrics || {};
          const aggregate = (m.engagement || 0) + (m.likes || 0) + (m.comments || 0) + (m.shares || 0) + ((m.ctr || 0) * 100);
          if (aggregate > bestScore) {
            bestScore = aggregate;
            best = v;
          }
        }

        const keyword = (test.type || test.projectId || 'ab_test').toString().toLowerCase();
        const summary = `Từ kết quả A/B test "${test.type || test.projectId}", biến thể có hiệu suất tốt nhất đang mang lại tương tác cao. Bạn có muốn mình tư vấn theo hướng nội dung này không?`;

        insights.push({
          keyword,
          response_text: summary,
          category: 'ab_test_insight',
          is_active: true,
          ab_test_id: test.id,
          best_variant_image: best ? best.imageUrl : null
        });
      }

      this.logger.debug('Generated A/B test insights', { count: insights.length });
      return insights;
    } catch (error) {
      this.logger.error('Error generating A/B test insights', { error: error.message });
      return [];
    }
  }

  /**
   * Extract keywords from text content
   */
  extractKeywordsFromText(text) {
    if (!text || typeof text !== 'string') return [];

    const keywords = [];
    const content = text.toLowerCase();

    // Common Vietnamese keywords for travel, food, beauty, etc.
    const keywordPatterns = [
      // Travel keywords
      'du lịch', 'tour', 'khách sạn', 'resort', 'nghỉ dưỡng', 'đi chơi', 'tham quan',
      'đà nẵng', 'hội an', 'nha trang', 'phú quốc', 'sapa', 'hạ long', 'huế', 'hồ chí minh', 'hà nội',
      // Food keywords
      'ăn uống', 'nhà hàng', 'quán ăn', 'món ngon', 'ẩm thực', 'buffet', 'đặc sản',
      // Beauty keywords
      'làm đẹp', 'spa', 'massage', 'chăm sóc da', 'mỹ phẩm', 'thẩm mỹ',
      // Shopping keywords
      'mua sắm', 'shop', 'cửa hàng', 'giảm giá', 'khuyến mãi', 'sale',
      // Service keywords
      'dịch vụ', 'tư vấn', 'hỗ trợ', 'chăm sóc khách hàng'
    ];

    // Find matching keywords
    for (const pattern of keywordPatterns) {
      if (content.includes(pattern)) {
        keywords.push(pattern);
      }
    }

    // Extract hashtags if any
    const hashtagMatches = text.match(/#[\w\u00C0-\u1EF9]+/g);
    if (hashtagMatches) {
      hashtagMatches.forEach(tag => {
        keywords.push(tag.substring(1)); // Remove # symbol
      });
    }

    // Extract words that might be important (longer than 3 characters)
    const words = text.match(/[\w\u00C0-\u1EF9]{4,}/g);
    if (words) {
      words.forEach(word => {
        if (word.length >= 4 && !keywords.includes(word.toLowerCase())) {
          keywords.push(word.toLowerCase());
        }
      });
    }

    return keywords.slice(0, 10); // Limit to 10 keywords per post
  }

  /**
   * Extract topics and keywords from post content
   */
  extractTopicsFromPost(post) {
    const topics = [];
    const content = post.content || '';
    const title = post.title || '';

    // Extract destinations
    const destinations = ['đà nẵng', 'hội an', 'nha trang', 'phú quốc', 'sapa', 'hạ long', 'huế', 'hồ chí minh', 'hà nội'];
    const foundDestinations = destinations.filter(dest =>
      content.toLowerCase().includes(dest) || title.toLowerCase().includes(dest)
    );

    for (const destination of foundDestinations) {
      topics.push({
        keyword: destination,
        response: `Chúng tôi có tour ${destination.charAt(0).toUpperCase() + destination.slice(1)} rất hấp dẫn! Dựa trên bài viết "${title}", chúng tôi đang có nhiều ưu đãi đặc biệt. Bạn muốn biết thêm chi tiết không? 🎯`
      });
    }

    // Extract activities
    const activities = ['du lịch', 'tour', 'khách sạn', 'ăn uống', 'vui chơi', 'nghỉ dưỡng'];
    const foundActivities = activities.filter(activity =>
      content.toLowerCase().includes(activity) || title.toLowerCase().includes(activity)
    );

    for (const activity of foundActivities) {
      topics.push({
        keyword: activity,
        response: `Về ${activity}, chúng tôi có nhiều dịch vụ chất lượng cao. Theo bài viết "${title}", chúng tôi đang có chương trình khuyến mãi hấp dẫn. Inbox để được tư vấn chi tiết nhé! 💫`
      });
    }

    return topics;
  }

  /**
   * Generate campaign-specific responses
   */
  generateCampaignResponses(post) {
    const responses = [];

    if (post.campaign) {
      const campaign = typeof post.campaign === 'string' ? JSON.parse(post.campaign) : post.campaign;

      if (campaign.name) {
        responses.push({
          keyword: campaign.name.toLowerCase(),
          response_text: `Chúng tôi đang chạy chiến dịch "${campaign.name}" với nhiều ưu đãi hấp dẫn! Theo bài viết "${post.title}", bạn có thể tiết kiệm được rất nhiều. Liên hệ ngay để được tư vấn! 🎉`,
          category: 'campaign',
          post_id: post.id,
          campaign_name: campaign.name,
          is_active: true
        });
      }

      if (campaign.goals && campaign.goals.includes('awareness')) {
        responses.push({
          keyword: 'khuyến mãi',
          response_text: `Hiện tại chúng tôi đang có nhiều chương trình khuyến mãi đặc biệt! Theo bài viết "${post.title}", bạn sẽ được giảm giá và nhận nhiều ưu đãi. Đừng bỏ lỡ cơ hội này! 💰`,
          category: 'promotion',
          post_id: post.id,
          is_active: true
        });
      }
    }

    return responses;
  }

  /**
   * Calculate engagement score for a post
   */
  calculateEngagementScore(engagements) {
    if (!engagements || engagements.length === 0) return 0;

    const totalEngagement = engagements.reduce((sum, eng) => {
      return sum + (eng.likes || 0) + (eng.comments || 0) + (eng.shares || 0);
    }, 0);

    return totalEngagement;
  }

  /**
   * Get A/B test insights for enhanced responses
   */
  async generateAIResponse(message, conversationHistory = [], databaseResponses = []) {
    if (!this.model) {
      throw new Error('Gemini AI not available');
    }

    try {
      // Xây dựng ngữ cảnh hội thoại
      const context = conversationHistory.map(conv =>
        `${conv.message_type === 'received' ? 'User' : 'Assistant'}: ${conv.message_text}`
      ).join('\n');

      // Xây dựng ngữ cảnh từ cơ sở dữ liệu phản hồi
      const dbContext = databaseResponses.map(resp =>
        `Keyword: ${resp.keyword} -> Response: ${resp.response_text}`
      ).join('\n');

      // Phân loại phản hồi: tĩnh / động / A-B test
      const staticResponses = databaseResponses.filter(r => !r.category || !r.category.includes('dynamic'));
      const dynamicResponses = databaseResponses.filter(r => r.category && r.category.includes('dynamic'));
      const abTestResponses = databaseResponses.filter(r => r.category && r.category.includes('ab_test'));

      // Bối cảnh từ các bài viết gần đây
      const dynamicContext = dynamicResponses.length > 0 ?
        `BÀI VIẾT GẦN ĐÂY (${dynamicResponses.length} bài):
  ${dynamicResponses.slice(0, 5).map(r => `- "${r.post_title}": ${r.response_text}`).join('\n')}` : '';

      // Bối cảnh từ kết quả A/B test
      const abTestContext = abTestResponses.length > 0 ?
        `KẾT QUẢ A/B TEST (${abTestResponses.length} insights):
  ${abTestResponses.slice(0, 3).map(r => `- ${r.response_text}`).join('\n')}` : '';

      // 👉 Prompt mới: phản hồi cho MỌI LĨNH VỰC
      const prompt = `Bạn là trợ lý AI của fanpage, có nhiệm vụ phản hồi bình luận hoặc tin nhắn của khách hàng về **mọi lĩnh vực** mà fanpage đăng tải: 
  du lịch, ẩm thực, làm đẹp, công nghệ, giáo dục, kinh doanh, sức khỏe, phong cách sống, v.v.
  
  🎯 NHIỆM VỤ:
  Trả lời khách hàng dựa trên nội dung thực tế từ các bài đăng, phản hồi trước đó, và dữ liệu trong cơ sở dữ liệu.
  
  NGỮ CẢNH HIỆN TẠI:
  - Tin nhắn khách hàng: ${message}
  - Lịch sử hội thoại: ${context || 'Chưa có lịch sử'}
  
  ${dynamicContext}
  
  ${abTestContext}
  
  CƠ SỞ DỮ LIỆU PHẢN HỒI:
  ${dbContext || 'Chưa có dữ liệu cơ bản'}
  
  💡 HƯỚNG DẪN PHẢN HỒI:
  1. Luôn dựa vào nội dung bài đăng hoặc dữ liệu có liên quan để trả lời chính xác.
  2. Giọng văn thân thiện, tự nhiên, thể hiện sự quan tâm và chuyên nghiệp.
  3. Giữ câu trả lời ngắn gọn (2–4 câu), dễ hiểu và mang năng lượng tích cực.
  4. Sử dụng emoji nhẹ nhàng để tăng tương tác (🌟✨💬💌...).
  5. Nếu phù hợp, kết thúc bằng lời mời hành động (CTA) như:
     - “Inbox em để được tư vấn chi tiết hơn nhé 💌”
     - “Anh/chị muốn xem thêm sản phẩm tương tự không ạ?”
     - “Theo dõi page để cập nhật thêm tin mới nha 🌟”
  6. Nếu câu hỏi không thuộc lĩnh vực cụ thể → phản hồi trung lập, lịch sự, và gợi ý khách inbox hoặc để lại thông tin liên hệ.
  
  📘 TÌNH HUỐNG ĐẶC BIỆT:
  - Nếu khách nhắc đến chủ đề xuất hiện trong bài đăng gần đây → sử dụng thông tin từ bài viết đó.
  - Nếu khách hỏi về ưu đãi / giá / chương trình → mời khách inbox để nhận chi tiết.
  - Nếu không có dữ liệu phù hợp → giữ giọng lịch sự, gợi mở trò chuyện.
  
  ➡️ Hãy phản hồi cho khách hàng dựa trên thông tin thực tế và hướng dẫn trên:`;

      // Gọi mô hình AI
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const aiResponse = response.text().trim();

      if (!aiResponse || aiResponse.length < 10) {
        throw new Error('AI response too short or empty');
      }

      // Ghi log thông tin phản hồi
      this.logger.info('Generated AI response', {
        messageLength: message.length,
        responseLength: aiResponse.length,
        hasHistory: conversationHistory.length > 0,
        hasDatabase: databaseResponses.length > 0
      });

      return aiResponse;
    } catch (error) {
      this.logger.error('Error generating AI response', { error: error.message });
      throw error;
    }
  }


  /**
   * Log analytics event
   */
  async logAnalytics(userId, eventType, eventData = {}) {
    try {
      await ChatAIAnalytics.create({
        user_id: userId,
        event_type: eventType,
        event_data: eventData
      });

      this.logger.debug('Logged ChatAI analytics', { userId, eventType });
    } catch (error) {
      this.logger.error('Error logging ChatAI analytics', { error: error.message, userId });
    }
  }

  /**
   * Get analytics data
   */
  async getAnalytics(startDate, endDate) {
    try {
      const analytics = await ChatAIAnalytics.findAll({
        where: {
          timestamp: {
            [require('sequelize').Op.between]: [startDate, endDate]
          }
        },
        include: [{
          model: ChatAIUser,
          as: 'user',
          attributes: ['id', 'first_name', 'last_name', 'facebook_id']
        }],
        order: [['timestamp', 'DESC']]
      });

      return analytics;
    } catch (error) {
      this.logger.error('Error getting ChatAI analytics', { error: error.message });
      return [];
    }
  }

  /**
   * Add new response to database
   */
  async addResponse(keyword, responseText, category = 'general') {
    try {
      const response = await ChatAIResponse.create({
        keyword,
        response_text: responseText,
        category,
        is_active: true
      });

      this.logger.info('Added new ChatAI response', {
        id: response.id,
        keyword,
        category,
        responseLength: responseText.length
      });

      return response.id;
    } catch (error) {
      this.logger.error('Error adding ChatAI response', { error: error.message });
      throw error;
    }
  }

  /**
   * Get service statistics
   */
  async getStats() {
    try {
      const [userCount, conversationCount, responseCount, publishedPostsCount] = await Promise.all([
        ChatAIUser.count(),
        ChatAIConversation.count(),
        ChatAIResponse.count({ where: { is_active: true } }),
        Post.count({ where: { status: 'published' } })
      ]);

      // Get dynamic content stats
      const dynamicContent = await this.getDynamicContentFromPosts();
      const abTestInsights = await this.getABTestInsights();

      return {
        users: userCount,
        conversations: conversationCount,
        active_responses: responseCount,
        published_posts: publishedPostsCount,
        dynamic_responses: dynamicContent.length,
        ab_test_insights: abTestInsights.length,
        total_responses: responseCount + dynamicContent.length + abTestInsights.length,
        gemini_available: !!this.model
      };
    } catch (error) {
      this.logger.error('Error getting ChatAI stats', { error: error.message });
      return {
        users: 0,
        conversations: 0,
        active_responses: 0,
        published_posts: 0,
        dynamic_responses: 0,
        ab_test_insights: 0,
        total_responses: 0,
        gemini_available: false
      };
    }
  }

  /**
   * Refresh dynamic content cache (call this periodically)
   */
  async refreshDynamicContent() {
    try {
      this.logger.info('Refreshing dynamic content cache...');

      const dynamicContent = await this.getDynamicContentFromPosts();
      //console.log("dynamicContent", dynamicContent)
      const abTestInsights = await this.getABTestInsights();
      console.log("abTestInsights", abTestInsights)

      this.logger.info('Dynamic content refreshed', {
        dynamicResponses: dynamicContent.length,
        abTestInsights: abTestInsights.length
      });

      return {
        dynamic_responses: dynamicContent.length,
        ab_test_insights: abTestInsights.length,
        refreshed_at: new Date()
      };
    } catch (error) {
      this.logger.error('Error refreshing dynamic content', { error: error.message });
      throw error;
    }
  }

  /**
   * Get posts for dynamic content analysis (for debugging/analysis)
   */
  async getPostsForDynamicAnalysis(limit = 20, days = 30) {
    try {
      const dateFrom = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const posts = await Post.findAll({
        where: {
          status: 'published',
          published_at: {
            [require('sequelize').Op.gte]: dateFrom
          }
        },
        include: [
          {
            model: PlatformPost,
            as: 'platformPosts',
            required: false
          },
          {
            model: Engagement,
            as: 'engagements',
            required: false
          }
        ],
        order: [['published_at', 'DESC']],
        limit: limit
      });

      // Add analysis data to each post
      const analyzedPosts = posts.map(post => {
        const topics = this.extractTopicsFromPost(post);
        const campaignResponses = post.campaign ? this.generateCampaignResponses(post) : [];
        const engagementScore = this.calculateEngagementScore(post.engagements);

        return {
          id: post.id,
          title: post.title,
          content: post.content,
          status: post.status,
          published_at: post.published_at,
          campaign: post.campaign,
          platform_posts_count: post.platformPosts ? post.platformPosts.length : 0,
          engagements_count: post.engagements ? post.engagements.length : 0,
          engagement_score: engagementScore,
          extracted_topics: topics,
          campaign_responses: campaignResponses,
          dynamic_responses_count: topics.length + campaignResponses.length
        };
      });

      this.logger.debug('Analyzed posts for dynamic content', {
        postsAnalyzed: analyzedPosts.length,
        totalDynamicResponses: analyzedPosts.reduce((sum, post) => sum + post.dynamic_responses_count, 0)
      });

      return analyzedPosts;
    } catch (error) {
      this.logger.error('Error getting posts for dynamic analysis', { error: error.message });
      throw error;
    }
  }
}

module.exports = ChatAIService;
