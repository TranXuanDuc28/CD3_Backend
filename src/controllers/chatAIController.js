const ChatAIService = require('../services/ChatAIService');
const Logger = require('../utils/logger');

class chatAIController {
  constructor() {
    this.chatAIService = new ChatAIService();
    this.logger = Logger;
  }

  /**
   * AI Reply endpoint for Messenger integration
   */
  async aiReply(req, res) {
    const startTime = Date.now();
    
    try {
      // Extract data from request body (support multiple field names)
      const { senderId, message, messageText, text, conversationId } = req.body;
      const userMessage = message || messageText || text;

      this.logger.info('🤖 ChatAI Reply Request', {
        senderId: senderId ? `***${senderId.slice(-4)}` : 'missing',
        messageLength: userMessage?.length || 0,
        conversationId,
        requestBody: JSON.stringify(req.body)
      });

      // Input validation
      if (!senderId) {
        return res.status(400).json({
          success: false,
          error: 'Missing required field: senderId',
          receivedFields: Object.keys(req.body)
        });
      }

      if (!userMessage || userMessage.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Missing required field: message (can be message, messageText, or text)',
          receivedFields: Object.keys(req.body),
          expectedFields: ['senderId', 'message/messageText/text']
        });
      }

      // 1. Get or create user
      let user;
      try {
        user = await this.chatAIService.getOrCreateUser(senderId);
        this.logger.debug('👤 User processed', { userId: user.id, senderId: `***${senderId.slice(-4)}` });
      } catch (error) {
        this.logger.error('❌ User processing failed', { error: error.message, senderId });
        return res.status(500).json({
          success: false,
          error: 'Failed to process user',
          details: error.message
        });
      }

      // 2. Save incoming message
      await this.chatAIService.saveMessage(user.id, userMessage, 'received', null, conversationId);
      this.logger.debug('📝 Incoming message saved');

      // 3. Get conversation history
      const conversationHistory = await this.chatAIService.getConversationHistory(user.id, 5);
      this.logger.debug(`📚 Retrieved ${conversationHistory.length} conversation history items`);

      // 4. Get database responses for context
      const databaseResponses = await this.chatAIService.getAllResponses();
      this.logger.debug(`🎯 Retrieved ${databaseResponses.length} database responses`);

      // 5. Generate AI response
      let aiResponse;
      try {
        aiResponse = await this.chatAIService.generateAIResponse(userMessage, conversationHistory, databaseResponses);
        const respLen = typeof aiResponse === 'string' ? aiResponse.length : (aiResponse?.text?.length || 0);
        this.logger.info('✅ AI response generated successfully', { responseLength: respLen });
      } catch (error) {
        this.logger.error('❌ AI generation failed', { error: error.message });
        aiResponse = { text: 'Xin lỗi, tôi đang gặp sự cố kỹ thuật. Vui lòng thử lại sau hoặc liên hệ trực tiếp với chúng tôi qua số điện thoại. 😊' };
      }

      // 6. Save AI response
      const textToSave = typeof aiResponse === 'string' ? aiResponse : (aiResponse?.text || '');
      await this.chatAIService.saveMessage(user.id, textToSave, 'sent', null, conversationId);
      this.logger.debug('💾 AI response saved');

      // 7. Log analytics
      const processingTime = Date.now() - startTime;
      await this.chatAIService.logAnalytics(user.id, 'message_processed', {
        message_text: userMessage,
        ai_response: aiResponse,
        processing_time: processingTime,
        conversation_history_count: conversationHistory.length,
        database_responses_count: databaseResponses.length,
        timestamp: new Date()
      });

      this.logger.info('🎯 ChatAI Reply completed', {
        processingTime: `${processingTime}ms`,
        responseLength: aiResponse.length,
        userId: user.id
      });

      // Return response for external systems (n8n, etc.)
      res.json({
        success: true,
        response: typeof aiResponse === 'string' ? aiResponse : aiResponse.text,
        attachment: typeof aiResponse === 'object' ? aiResponse.attachment : null,
        metadata: {
          processingTime,
          userId: user.id,
          conversationHistoryCount: conversationHistory.length,
          databaseResponsesCount: databaseResponses.length,
          service: 'chatai'
        }
      });

    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logger.error('🔥 ChatAI Reply failed', { 
        error: error.message, 
        stack: error.stack,
        processingTime: `${processingTime}ms`
      });

      res.status(500).json({
        success: false,
        error: error.message,
        response: 'Xin lỗi, có lỗi xảy ra. Vui lòng thử lại sau.',
        metadata: {
          processingTime,
          service: 'chatai',
          errorType: 'server_error'
        }
      });
    }
  }

  /**
   * Get ChatAI users
   */
  async getUsers(req, res) {
    try {
      const { limit = 50, offset = 0 } = req.query;
      
      const { ChatAIUser } = require('../models');
      const users = await ChatAIUser.findAll({
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['created_at', 'DESC']],
        include: [{
          model: require('../models').ChatAIConversation,
          as: 'conversations',
          limit: 1,
          order: [['timestamp', 'DESC']]
        }]
      });

      res.json({
        success: true,
        users,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: users.length
        }
      });
    } catch (error) {
      this.logger.error('Error getting ChatAI users', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to get users'
      });
    }
  }

  /**
   * Get conversation history for a user
   */
  async getUserConversations(req, res) {
    try {
      const { userId } = req.params;
      const { limit = 50 } = req.query;
      
      const conversations = await this.chatAIService.getConversationHistory(userId, parseInt(limit));
      
      res.json({
        success: true,
        conversations,
        userId
      });
    } catch (error) {
      this.logger.error('Error getting user conversations', { error: error.message, userId: req.params.userId });
      res.status(500).json({
        success: false,
        error: 'Failed to get conversations'
      });
    }
  }

  /**
   * Get ChatAI responses
   */
  async getResponses(req, res) {
    try {
      const responses = await this.chatAIService.getAllResponses();
      
      res.json({
        success: true,
        responses
      });
    } catch (error) {
      this.logger.error('Error getting ChatAI responses', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to get responses'
      });
    }
  }

  /**
   * Add new response
   */
  async addResponse(req, res) {
    try {
      const { keyword, response_text, category } = req.body;
      
      if (!response_text) {
        return res.status(400).json({
          success: false,
          error: 'Missing required field: response_text'
        });
      }

      const responseId = await this.chatAIService.addResponse(keyword, response_text, category);
      
      res.json({
        success: true,
        id: responseId,
        message: 'Response added successfully'
      });
    } catch (error) {
      this.logger.error('Error adding ChatAI response', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to add response'
      });
    }
  }

  /**
   * Get analytics
   */
  async getAnalytics(req, res) {
    try {
      const { start_date, end_date } = req.query;
      
      const startDate = start_date ? new Date(start_date) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const endDate = end_date ? new Date(end_date) : new Date();
      
      const analytics = await this.chatAIService.getAnalytics(startDate, endDate);
      
      res.json({
        success: true,
        analytics,
        period: {
          start: startDate,
          end: endDate
        }
      });
    } catch (error) {
      this.logger.error('Error getting ChatAI analytics', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to get analytics'
      });
    }
  }

  /**
   * Get service statistics
   */
  async getStats(req, res) {
    try {
      const stats = await this.chatAIService.getStats();
      
      res.json({
        success: true,
        stats,
        service: 'chatai'
      });
    } catch (error) {
      this.logger.error('Error getting ChatAI stats', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to get stats'
      });
    }
  }

  /**
   * Test AI service
   */
  async testAI(req, res) {
    try {
      const { message = 'Hello, test message' } = req.body;
      
      const testResponse = await this.chatAIService.generateAIResponse(message, [], []);
      
      res.json({
        success: true,
        testMessage: message,
        aiResponse: testResponse,
        service: 'chatai'
      });
    } catch (error) {
      this.logger.error('Error testing ChatAI', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Refresh dynamic content from posts and A/B tests
   */
  async refreshDynamicContent(req, res) {
    try {
      const result = await this.chatAIService.refreshDynamicContent();
      
      res.json({
        success: true,
        message: 'Dynamic content refreshed successfully',
        data: result
      });
    } catch (error) {
      this.logger.error('Error refreshing dynamic content', { error: error.message });
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get posts for dynamic content analysis
   */
  async getPostsForAnalysis(req, res) {
    try {
      const { limit = 20, days = 30 } = req.query;
      
      const posts = await this.chatAIService.getPostsForDynamicAnalysis(parseInt(limit), parseInt(days));
      
      res.json({
        success: true,
        data: {
          posts: posts,
          count: posts.length,
          limit: parseInt(limit),
          days: parseInt(days)
        }
      });
    } catch (error) {
      this.logger.error('Error getting posts for analysis', { error: error.message });
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = chatAIController;
