const { Op, literal } = require('sequelize');
const { FacebookPost, FacebookComment, HandledComment, ChatHistory, CommentAnalysis } = require('../models');
// const AIPromptService = require('./AIPromptService'); // ❌ REMOVED: Now using inline natural prompts
const { generateResponse } = require('../config/gemini');
const Logger = require('../utils/logger');
const SentimentAnalysisService = require('./SentimentAnalysisService');

class CommentService {
  static resolveStatus(handled, analysis) {
    if (handled) return 'processed';
    if (analysis && (analysis.is_toxic || (analysis.moderation_action && analysis.moderation_action !== 'none'))) {
      return 'error';
    }
    return 'pending';
  }

  static mapCommentRecord(instance) {
    if (!instance) return null;
    const data = instance.get ? instance.get({ plain: true }) : instance;
    const handled = data.handled || null;
    const analysis = data.analysis || null;
    const post = data.post || null;

    return {
      id: data.comment_id,
      comment_id: data.comment_id,
      post_id: data.post_id,
      parent_comment_id: data.parent_comment_id,
      message: data.message,
      created_time: data.created_time,
      fetched_at: data.fetched_at,
      comment_level: data.comment_level,
      from: {
        id: data.from_id,
        name: data.from_name,
        is_page: data.is_from_page
      },
      post: post ? { post_id: post.post_id, content: post.content } : null,
      ai_response: handled?.ai_response || null,
      reply_id: handled?.reply_id || null,
      handled_at: handled?.handled_at || null,
      session_id: handled?.session_id || null,
      sentiment: analysis?.sentiment || null,
      sentiment_score: analysis?.sentiment_score || null,
      moderation_action: analysis?.moderation_action || 'none',
      is_toxic: analysis?.is_toxic || false,
      toxic_category: analysis?.toxic_category || null,
      keywords: analysis?.keywords || null,
      status: this.resolveStatus(handled, analysis)
    };
  }

  static buildStatusFilters(status) {
    const clauses = [];
    const normalized = (status || 'all').toLowerCase();

    if (normalized === 'pending') {
      clauses.push(literal('`handled`.`comment_id` IS NULL'));
      clauses.push({
        [Op.or]: [
          { '$analysis.moderation_action$': null },
          { '$analysis.moderation_action$': 'none' }
        ]
      });
    } else if (normalized === 'error') {
      clauses.push(literal('`handled`.`comment_id` IS NULL'));
      clauses.push({
        [Op.or]: [
          { '$analysis.is_toxic$': true },
          { '$analysis.moderation_action$': { [Op.in]: ['delete', 'manual_review'] } }
        ]
      });
    }

    return { normalized, clauses };
  }

  static async getComments(query = {}) {
    try {
      const page = Math.max(parseInt(query.page, 10) || 1, 1);
      const limit = Math.min(Math.max(parseInt(query.limit, 10) || 10, 1), 100);
      const offset = (page - 1) * limit;
      const search = query.search?.trim();
      const sentiment = query.sentiment?.trim();
      const toxic = query.toxic?.trim();

      const whereClauses = [];
      if (search) {
        whereClauses.push({
          [Op.or]: [
            { from_name: { [Op.like]: `%${search}%` } },
            { message: { [Op.like]: `%${search}%` } },
            { comment_id: { [Op.like]: `%${search}%` } }
          ]
        });
      }

      // Sentiment filter
      if (sentiment && sentiment !== 'all') {
        whereClauses.push({
          '$analysis.sentiment$': sentiment
        });
      }

      // Toxic filter
      if (toxic && toxic !== 'all') {
        whereClauses.push({
          '$analysis.is_toxic$': toxic === 'true'
        });
      }

      const { normalized: status, clauses } = this.buildStatusFilters(query.status);
      whereClauses.push(...clauses);

      const include = [
        { model: HandledComment, as: 'handled', required: status === 'processed' },
        { model: CommentAnalysis, as: 'analysis', required: false },
        { model: FacebookPost, as: 'post', attributes: ['post_id', 'content'], required: false }
      ];

      const where = whereClauses.length ? { [Op.and]: whereClauses } : {};

      const { rows, count } = await FacebookComment.findAndCountAll({
        where,
        include,
        order: [['created_time', 'DESC']],
        limit,
        offset,
        distinct: true,
        subQuery: false
      });

      const total = typeof count === 'number' ? count : count.length;
      const comments = rows.map((row) => this.mapCommentRecord(row));

      return {
        success: true,
        comments,
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit)
      };
    } catch (error) {
      Logger.error('GetComments error', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  static async getCommentDetails(commentId) {
    try {
      const comment = await FacebookComment.findOne({
        where: { comment_id: commentId },
        include: [
          { model: HandledComment, as: 'handled', required: false },
          { model: CommentAnalysis, as: 'analysis', required: false },
          { model: FacebookPost, as: 'post', attributes: ['post_id', 'content'], required: false }
        ]
      });

      if (!comment) {
        return { success: false, error: 'Comment not found' };
      }

      return { success: true, comment: this.mapCommentRecord(comment) };
    } catch (error) {
      Logger.error('GetCommentDetails error', { comment_id: commentId, error: error.message });
      return { success: false, error: error.message };
    }
  }

  static async updateCommentStatus(commentId, status, payload = {}) {
    try {
      const normalized = (status || '').toLowerCase();
      if (!['processed', 'pending'].includes(normalized)) {
        return { success: false, error: 'Unsupported status value' };
      }

      const exists = await FacebookComment.findOne({ where: { comment_id: commentId } });
      if (!exists) {
        return { success: false, error: 'Comment not found' };
      }

      if (normalized === 'processed') {
        await HandledComment.upsert({
          comment_id: commentId,
          reply_id: payload.reply_id || null,
          ai_response: payload.ai_response || null,
          session_id: payload.session_id || null,
          handled_at: new Date()
        });
      } else {
        await HandledComment.destroy({ where: { comment_id: commentId } });
      }

      const updated = await this.getCommentDetails(commentId);
      return { success: true, comment: updated.comment || null };
    } catch (error) {
      Logger.error('UpdateCommentStatus error', { comment_id: commentId, error: error.message });
      return { success: false, error: error.message };
    }
  }

  static async getCommentStats() {
    try {
      const total = await FacebookComment.count();

      const processed = await FacebookComment.count({
        include: [{ model: HandledComment, as: 'handled', required: true }],
        distinct: true
      });

      const errorCount = await FacebookComment.count({
        where: literal('`handled`.`comment_id` IS NULL'),
        include: [
          { model: HandledComment, as: 'handled', required: false },
          {
            model: CommentAnalysis,
            as: 'analysis',
            required: true,
            where: {
              [Op.or]: [
                { moderation_action: { [Op.in]: ['delete', 'manual_review'] } },
                { is_toxic: true }
              ]
            }
          }
        ],
        distinct: true
      });

      const pending = Math.max(total - processed - errorCount, 0);

      return {
        success: true,
        stats: {
          total,
          pending,
          processed,
          error: errorCount
        }
      };
    } catch (error) {
      Logger.error('GetCommentStats error', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  static async getRecentComments(limit = 5) {
    try {
      const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 5, 1), 50);
      const rows = await FacebookComment.findAll({
        include: [
          { model: HandledComment, as: 'handled', required: false },
          { model: CommentAnalysis, as: 'analysis', required: false },
          { model: FacebookPost, as: 'post', attributes: ['post_id', 'content'], required: false }
        ],
        order: [['created_time', 'DESC']],
        limit: safeLimit
      });

      return { success: true, comments: rows.map((row) => this.mapCommentRecord(row)) };
    } catch (error) {
      Logger.error('GetRecentComments error', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  static async getCommentHistory(commentId, limit = 20) {
    try {
      const handled = await HandledComment.findOne({ where: { comment_id: commentId } });
      if (!handled?.session_id) {
        return { success: true, history: [] };
      }

      const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
      const rows = await ChatHistory.findAll({
        where: { session_id: handled.session_id },
        order: [['created_at', 'ASC']],
        limit: safeLimit
      });

      return {
        success: true,
        history: rows.map((item) => ({
          id: item.id,
          session_id: item.session_id,
          user_id: item.user_id,
          user_name: item.user_name,
          user_message: item.user_message,
          ai_response: item.ai_response,
          context_data: item.context_data,
          created_at: item.created_at
        }))
      };
    } catch (error) {
      Logger.error('GetCommentHistory error', { comment_id: commentId, error: error.message });
      return { success: false, error: error.message };
    }
  }

  // 🧩 Xử lý danh sách comment mới từ Facebook
  static async processComments(commentsData, sessionId) {
    try {
      const results = { processed: [], errors: [] };

      for (const comment of commentsData) {
        try {
          // Kiểm tra comment đã xử lý chưa
          const isHandled = await HandledComment.findOne({ where: { comment_id: comment.comment_id } });
          if (isHandled) {
            Logger.info('Comment already handled, skipping', { comment_id: comment.comment_id });
            continue;
          }

          // Lưu comment mới vào DB
          await FacebookComment.upsert({
            comment_id: comment.comment_id,
            post_id: comment.post_id,
            parent_comment_id: comment.parent_comment_id || null,
            from_id: comment.from_id,
            from_name: comment.from_name,
            is_from_page: !!comment.is_from_page,
            message: comment.message,
            created_time: new Date(comment.created_time),
            comment_level: parseInt(comment.comment_level) || 1,
            fetched_at: new Date()
          });

          // 🔎 Phân tích cảm xúc bằng Gemini
          const processingResult = await SentimentAnalysisService.processComment(
            comment.comment_id,
            comment.message
          );

          // 🧠 Sinh phản hồi từ AI (luôn reply, không skip)
          const aiResult = await this.generateAIResponse(
            comment.message,
            comment.from_name,
            comment.from_id,
            comment.post_id,
            sessionId
          );

          if (aiResult.success && aiResult.response) {
            results.processed.push({
              comment_id: comment.comment_id,
              from_name: comment.from_name,
              message: comment.message,
              ai_response: aiResult.response,
              session_id: sessionId,
              sentiment: processingResult.analysis?.sentiment,
              sentiment_score: processingResult.analysis?.sentimentScore,
              keywords: processingResult.analysis?.keywords
            });
          } else {
            results.errors.push({
              comment_id: comment.comment_id,
              error: aiResult.error || "AI did not return a response"
            });
          }

        } catch (error) {
          results.errors.push({
            comment_id: comment.comment_id,
            error: error.message
          });
          Logger.error('Comment processing error', { comment, error: error.message });
        }
      }

      return {
        success: true,
        data: results,
        summary: {
          total: commentsData.length,
          processed: results.processed.length,
          errors: results.errors.length
        }
      };

    } catch (error) {
      Logger.error('ProcessComments error', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  // 🧠 Sinh phản hồi từ AI với ngữ cảnh
  static async generateAIResponse(userMessage, userName, userId, postId, sessionId, workflowData = {}) {
    try {
      let postContent = '';
      if (postId) {
        const post = await FacebookPost.findOne({ where: { post_id: postId } });
        postContent = post?.content || '';
      }

      // Retrieve last 20 chat messages for session
      const rows = await ChatHistory.findAll({ where: { session_id: sessionId }, order: [['created_at', 'DESC']], limit: 20 });
      const history = rows.reverse().map(r => [{ role: 'user', content: r.user_message }, { role: 'assistant', content: r.ai_response }]).flat();

      // 🎯 Tạo prompt tự nhiên, không template cứng nhắc
      const systemPrompt = `
Bạn là nhân viên tư vấn thân thiện và chuyên nghiệp của cửa hàng.

${postContent ? `Bài viết đang được thảo luận: "${postContent}"` : ''}

Hướng dẫn trả lời:
- Trả lời TỰ NHIÊN như đang trò chuyện trực tiếp với khách hàng
- NGẮN GỌN, đi thẳng vào vấn đề (1-3 câu)
- Thân thiện, nhiệt tình nhưng không quá cầu kỳ
- Có thể dùng emoji phù hợp (😊 👍 ✨) nhưng đừng lạm dụng
- Nếu khách hỏi giá/thông tin sản phẩm → trả lời cụ thể nếu biết, nếu không thì hỏi lại
- Nếu khách khen → cảm ơn ngắn gọn
- Nếu khách phàn nàn → xin lỗi chân thành và hỏi thêm chi tiết để hỗ trợ
- KHÔNG dùng template kiểu "Chào bạn! Cảm ơn bạn đã quan tâm đến sản phẩm..."
- KHÔNG giới thiệu bản thân mỗi lần
- KHÔNG nói "Tôi là AI" hay "Tôi là trợ lý ảo"

Trả lời NGAY, như người thật đang chat.
`.trim();

      let contextMessage = userMessage;
      if (postContent) {
        contextMessage = `${userName} bình luận: ${userMessage}`;
      }

      const aiResult = await generateResponse(contextMessage, systemPrompt, history);

      // Nếu AI không trả lời → fallback
      if (!aiResult.success || !aiResult.response) {
        const fallbackMsg = "Xin lỗi, tôi hiện chưa thể phản hồi. Hãy thử lại sau nhé! 🙏";
        Logger.warn('⚠️ Gemini trả về rỗng, dùng fallback message.', { userMessage });
        return { success: true, response: fallbackMsg };
      }

      // Lưu lịch sử chat
      await ChatHistory.create({
        session_id: sessionId,
        user_id: userId,
        user_name: userName,
        user_message: userMessage,
        ai_response: aiResult.response,
        context_data: { post_id: postId, post_content: postContent },
        created_at: new Date()
      });

      return { success: true, response: aiResult.response };

    } catch (error) {
      Logger.error('AI Response generation error', { error: error.message });
      return { success: false, response: null, error: error.message };
    }
  }

  // ✅ Mark comments đã trả lời
  static async markCommentsHandled(handledData) {
    try {
      const results = [];
      for (const item of handledData) {
        try {
          await HandledComment.upsert({
            comment_id: item.comment_id,
            reply_id: item.reply_id || null,
            ai_response: item.ai_response,
            session_id: item.session_id || null,
            handled_at: new Date()
          });
          results.push({ comment_id: item.comment_id, status: 'success' });
        } catch (error) {
          results.push({ comment_id: item.comment_id, status: 'error', error: error.message });
        }
      }
      return { success: true, data: results };
    } catch (error) {
      Logger.error('MarkCommentsHandled error', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  // ✅ Kiểm tra 1 comment đã xử lý chưa
  static async checkSingleCommentHandled(commentId, sessionId) {
    try {
      const isHandled = !!(await HandledComment.findOne({ where: { comment_id: commentId } }));
      return { success: true, comment_id: commentId, is_handled: isHandled, session_id: sessionId };
    } catch (error) {
      Logger.error('CheckSingleCommentHandled error', { error: error.message });
      return { success: false, comment_id: commentId, is_handled: false, error: error.message };
    }
  }

  // ✅ Kiểm tra nhiều comment
  static async checkHandledStatus(commentIds) {
    try {
      const handled = await HandledComment.findAll({ where: { comment_id: commentIds } });
      const handledSet = new Set(handled.map(h => h.comment_id));
      const results = commentIds.map(id => ({ comment_id: id, is_handled: handledSet.has(id) }));
      return { success: true, data: results };
    } catch (error) {
      Logger.error('CheckHandledStatus error', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  // ✅ Lấy comment chưa xử lý
  static async getUnhandledComments(limit = 100) {
    try {
      const comments = await FacebookComment.findAll({
        where: {},
        include: [{ model: HandledComment, as: 'handled', required: false }],
        order: [['created_time', 'DESC']],
        limit
      });
      const unhandled = comments.filter(c => !c.handled);
      return { success: true, data: unhandled, count: unhandled.length };
    } catch (error) {
      Logger.error('GetUnhandledComments error', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  // ✅ Lưu danh sách bài viết
  static async savePosts(postsData) {
    const CHUNK_SIZE = parseInt(process.env.SAVE_POSTS_CHUNK_SIZE || '500', 10);

    try {
      if (!Array.isArray(postsData) || postsData.length === 0) {
        return { success: false, error: 'posts array is required', data: [] };
      }

      const normalizedPosts = [];
      const skippedPosts = [];

      const parseDate = (value) => {
        if (!value) return new Date();
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
      };

      postsData.forEach((rawPost, index) => {
        const postId = rawPost?.post_id || rawPost?.id;
        const pageId = rawPost?.page_id || rawPost?.from?.id;

        if (!postId || !pageId) {
          skippedPosts.push({
            index,
            post_id: postId || null,
            reason: 'Missing post_id or page_id'
          });
          return;
        }

        normalizedPosts.push({
          post_id: postId,
          page_id: pageId,
          content: rawPost?.content ?? rawPost?.message ?? rawPost?.caption ?? '',
          created_time: parseDate(rawPost?.created_time),
          fetched_at: parseDate(rawPost?.fetched_at)
        });
      });

      if (!normalizedPosts.length) {
        return { success: false, error: 'No valid posts to save', skipped: skippedPosts };
      }

      const results = [];
      const chunkSize = Math.min(Math.max(CHUNK_SIZE, 50), 1000);
      const updateFields = ['page_id', 'content', 'created_time', 'fetched_at'];
      const startTime = Date.now();

      for (let i = 0; i < normalizedPosts.length; i += chunkSize) {
        const chunk = normalizedPosts.slice(i, i + chunkSize);
        try {
          await FacebookPost.bulkCreate(chunk, { updateOnDuplicate: updateFields });
          chunk.forEach((post) => {
            results.push({ post_id: post.post_id, status: 'success' });
          });
        } catch (bulkError) {
          Logger.warn('Bulk save chunk failed, fallback to individual upserts', {
            chunk_start: i,
            chunk_size: chunk.length,
            error: bulkError.message
          });

          for (const post of chunk) {
            try {
              await FacebookPost.upsert(post);
              results.push({ post_id: post.post_id, status: 'success' });
            } catch (error) {
              results.push({ post_id: post.post_id, status: 'error', error: error.message });
            }
          }
        }
      }

      const successCount = results.filter((r) => r.status === 'success').length;
      const errorCount = results.length - successCount;

      return {
        success: errorCount === 0,
        data: results,
        summary: {
          total_received: postsData.length,
          attempted: normalizedPosts.length,
          saved: successCount,
          failed: errorCount,
          skipped: skippedPosts.length,
          duration_ms: Date.now() - startTime
        },
        skipped: skippedPosts
      };
    } catch (error) {
      Logger.error('SavePosts error', { error: error.message });
      return { success: false, error: error.message };
    }
  }
}

module.exports = CommentService;
