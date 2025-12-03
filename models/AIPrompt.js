const db = require('../config/database');
const TemplateEngine = require('../utils/templateEngine');

class AIPrompt {
  // Get active prompt by name
  static async getPrompt(promptName = 'default_watch_sales') {
    const sql = `
      SELECT system_message 
      FROM ai_prompts 
      WHERE prompt_name = ? AND is_active = TRUE
    `;
    
    const result = await db.query(sql, [promptName]);
    return result[0]?.system_message || '';
  }

  // Get processed prompt with template data
  static async getProcessedPrompt(promptName = 'default_watch_sales', data = {}) {
    const template = await this.getPrompt(promptName);
    const processedTemplate = TemplateEngine.processTemplate(template, data);
    return TemplateEngine.sanitizePrompt(processedTemplate);
  }

  // Get all active prompts
  static async getAllPrompts() {
    const sql = 'SELECT * FROM ai_prompts WHERE is_active = TRUE';
    return await db.query(sql);
  }

  // Create or update prompt
  static async savePrompt(promptName, systemMessage) {
    const sql = `
      INSERT INTO ai_prompts (prompt_name, system_message)
      VALUES (?, ?)
      ON DUPLICATE KEY UPDATE 
        system_message = VALUES(system_message),
        updated_at = CURRENT_TIMESTAMP
    `;
    
    return await db.query(sql, [promptName, systemMessage]);
  }

  // Deactivate prompt
  static async deactivatePrompt(promptName) {
    const sql = 'UPDATE ai_prompts SET is_active = FALSE WHERE prompt_name = ?';
    return await db.query(sql, [promptName]);
  }

  // Activate prompt
  static async activatePrompt(promptName) {
    const sql = 'UPDATE ai_prompts SET is_active = TRUE WHERE prompt_name = ?';
    return await db.query(sql, [promptName]);
  }
}

module.exports = AIPrompt;

