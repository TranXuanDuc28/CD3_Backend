const { FacebookPost, FacebookComment, HandledComment, ChatHistory } = require('../models');
const AIPromptService = require('./AIPromptService');
const { generateResponse } = require('../../CD3_Backend/config/gemini'); // Đảm bảo file gemini.js là bản đã sửa
const Logger = require('../utils/logger');
const SentimentAnalysisService = require('./SentimentAnalysisService');

class CommentService {
  // 🧩 Xử lý danh sách comment mới từ Facebook
  static async processComments(commentsData, sessionId) {
    try {
      const results = { processed: [], skipped: [], errors: [] };

      for (const comment of commentsData) {
        try {
          // Kiểm tra comment đã xử lý chưa
          const isHandled = await HandledComment.findOne({ where: { comment_id: comment.comment_id } });
          if (isHandled) {
            results.skipped.push({
              comment_id: comment.comment_id,
              reason: 'Already handled'
            });
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

          // 🔎 Phân tích cảm xúc & spam
          const processingResult = await SentimentAnalysisService.processComment(
            comment.comment_id,
            comment.message
          );

          if (!processingResult.shouldReply) {
            let reason = 'Unknown';
            if (processingResult.isToxic)
              reason = `Toxic detected (${processingResult.analysis?.toxicCategory})`;
            else if (processingResult.isSpam)
              reason = 'Spam detected';

            results.skipped.push({
              comment_id: comment.comment_id,
              reason,
              moderation_action: processingResult.moderationAction || 'none',
              is_toxic: processingResult.isToxic || false,
              is_spam: processingResult.isSpam || false,
              is_duplicate: false,
              analysis: processingResult.analysis
            });
            continue;
          }

          // 🧠 Sinh phản hồi từ AI
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
              sentiment_score: processingResult.analysis?.sentimentScore
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
          skipped: results.skipped.length,
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

      const templateData = {
        content: postContent,
        message: userMessage,
        user_name: userName,
        user_id: userId,
        post_id: postId,
        session_id: sessionId,
        ...workflowData
      };

      const systemPrompt = await AIPromptService.getProcessedPrompt('default_watch_sales', templateData);

      console.log('🔍 Template Data:', JSON.stringify(templateData, null, 2));
      console.log('🔍 Processed System Prompt:', systemPrompt);

      // Retrieve last 20 chat messages for session
      const rows = await ChatHistory.findAll({ where: { session_id: sessionId }, order: [['created_at', 'DESC']], limit: 20 });
      const history = rows.reverse().map(r => [{ role: 'user', content: r.user_message }, { role: 'assistant', content: r.ai_response }]).flat();

      let contextMessage = userMessage;
      if (postContent) {
        contextMessage = `Nội dung bài viết: ${postContent}\n\nTin nhắn từ ${userName}: ${userMessage}`;
      }

      const aiResult = await generateResponse(contextMessage, systemPrompt, history);

      // Nếu AI không trả lời → fallback
      if (!aiResult.success || !aiResult.response) {
        const fallbackMsg = "Xin lỗi, tôi hiện chưa thể phản hồi bình luận này. Hãy thử lại sau nhé! 🙏";
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
