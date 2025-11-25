"use strict";

const db = require('../config/database');
class ChatHistory {
  // Save chat interaction
  static async saveChat(chatData) {
    const sql = `
      INSERT INTO chat_history 
      (session_id, user_id, user_name, user_message, ai_response, context_data)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    const contextJson = chatData.context_data ? JSON.stringify(chatData.context_data) : null;
    return await db.query(sql, [chatData.session_id, chatData.user_id, chatData.user_name || '', chatData.user_message, chatData.ai_response, contextJson]);
  }

  // Get chat history for a session
  static async getHistory(sessionId, limit = 20) {
    const sql = `
      SELECT user_message, ai_response, created_at
      FROM chat_history 
      WHERE session_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `;
    const results = await db.query(sql, [sessionId, limit]);

    // Convert to conversation format (newest first, then reverse)
    return results.reverse().map(row => [{
      role: 'user',
      content: row.user_message
    }, {
      role: 'assistant',
      content: row.ai_response
    }]).flat();
  }

  // Get history for a specific user
  static async getUserHistory(userId, limit = 50) {
    const sql = `
      SELECT session_id, user_message, ai_response, created_at
      FROM chat_history 
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `;
    return await db.query(sql, [userId, limit]);
  }

  // Delete old history (cleanup)
  static async cleanupOldHistory(daysOld = 90) {
    const sql = `
      DELETE FROM chat_history 
      WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)
    `;
    return await db.query(sql, [daysOld]);
  }

  // Get conversation statistics
  static async getStats(sessionId) {
    const sql = `
      SELECT 
        COUNT(*) as total_messages,
        COUNT(DISTINCT user_id) as unique_users,
        MIN(created_at) as first_message,
        MAX(created_at) as last_message
      FROM chat_history
      WHERE session_id = ?
    `;
    const result = await db.query(sql, [sessionId]);
    return result[0] || null;
  }
}
module.exports = ChatHistory;