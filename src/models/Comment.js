const db = require('../config/database');

// Utility function to convert ISO 8601 datetime to MySQL datetime format
function convertToMySQLDateTime(isoString) {
  if (!isoString) return null;
  
  try {
    // Parse ISO 8601 string and convert to MySQL datetime format (YYYY-MM-DD HH:MM:SS)
    const date = new Date(isoString);
    return date.toISOString().slice(0, 19).replace('T', ' ');
  } catch (error) {
    console.error('Error converting datetime:', error);
    return null;
  }
}


class Comment {
  // Save Facebook post
  static async savePost(postData) {
    const sql = `
      INSERT INTO facebook_posts (post_id, page_id, content, created_time)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
        content = VALUES(content),
        fetched_at = CURRENT_TIMESTAMP
    `;
    
    return await db.query(sql, [
      postData.post_id,
      postData.page_id,
      postData.content || '',
      convertToMySQLDateTime(postData.created_time)
    ]);
  }

  // Save Facebook comment
  static async saveComment(commentData) {
    const sql = `
      INSERT INTO facebook_comments 
      (comment_id, post_id, parent_comment_id, from_id, from_name, is_from_page, message, created_time, comment_level)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
        message = VALUES(message),
        fetched_at = CURRENT_TIMESTAMP
    `;
    
    const params = [
      commentData.comment_id,
      commentData.post_id,
      commentData.parent_comment_id || null,
      commentData.from_id,
      commentData.from_name,
      commentData.is_from_page || 0,
      commentData.message,
      convertToMySQLDateTime(commentData.created_time),
      parseInt(commentData.comment_level) || 1
    ];
    
    // Debug logging
    console.log('SQL Parameters:', params);
    console.log('SQL Query:', sql);
    
    return await db.query(sql, params);
  }

  // Check if comment is already handled
  static async isHandled(commentId) {
    const sql = 'SELECT * FROM handled_comments WHERE comment_id = ?';
    const result = await db.query(sql, [commentId]);
    return result.length > 0;
  }

  // Get all handled comment IDs
  static async getAllHandledIds() {
    const sql = 'SELECT comment_id FROM handled_comments';
    const results = await db.query(sql);
    return results.map(row => row.comment_id);
  }

  // Mark comment as handled
  static async markAsHandled(commentId, replyId, aiResponse, sessionId) {
    const sql = `
      INSERT INTO handled_comments (comment_id, reply_id, ai_response, session_id)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
        reply_id = VALUES(reply_id),
        ai_response = VALUES(ai_response),
        handled_at = CURRENT_TIMESTAMP
    `;
    
    return await db.query(sql, [commentId, replyId, aiResponse, sessionId]);
  }

  // Get unhandled comments
  static async getUnhandledComments(limit = 100) {
    const sql = `
      SELECT fc.* 
      FROM facebook_comments fc
      LEFT JOIN handled_comments hc ON fc.comment_id = hc.comment_id
      WHERE hc.comment_id IS NULL
      ORDER BY fc.created_time DESC
      LIMIT ?
    `;
    
    return await db.query(sql, [limit]);
  }

  // Get comment details
  static async getCommentById(commentId) {
    const sql = 'SELECT * FROM facebook_comments WHERE comment_id = ?';
    const result = await db.query(sql, [commentId]);
    return result[0] || null;
  }

  // Get post content for context
  static async getPostContent(postId) {
    const sql = 'SELECT content FROM facebook_posts WHERE post_id = ?';
    const result = await db.query(sql, [postId]);
    return result[0]?.content || '';
  }

  // Get recent comments for a post
  static async getCommentsByPost(postId, limit = 50) {
    const sql = `
      SELECT * FROM facebook_comments 
      WHERE post_id = ? 
      ORDER BY created_time DESC 
      LIMIT ?
    `;
    
    return await db.query(sql, [postId, limit]);
  }

  // Delete old handled records (cleanup)
  static async cleanupOldHandled(daysOld = 30) {
    const sql = `
      DELETE FROM handled_comments 
      WHERE handled_at < DATE_SUB(NOW(), INTERVAL ? DAY)
    `;
    
    return await db.query(sql, [daysOld]);
  }
}

module.exports = Comment;

