const { AIPrompt } = require('../models');
const TemplateEngine = require('../utils/templateEngine');

class AIPromptService {
  static async getPrompt(promptName = 'default_watch_sales') {
    const row = await AIPrompt.findOne({ where: { prompt_name: promptName, is_active: true } });
    return row?.system_message || '';
  }

  static async getProcessedPrompt(promptName = 'default_watch_sales', data = {}) {
    const template = await this.getPrompt(promptName);
    const processed = TemplateEngine.processTemplate(template, data);
    return TemplateEngine.sanitizePrompt(processed);
  }

  static async getAllPrompts() {
    const rows = await AIPrompt.findAll({ where: { is_active: true } });
    return rows;
  }

  static async savePrompt(promptName, systemMessage) {
    await AIPrompt.upsert({ prompt_name: promptName, system_message: systemMessage, updated_at: new Date() });
    return true;
  }

  static async deactivatePrompt(promptName) {
    await AIPrompt.update({ is_active: false }, { where: { prompt_name: promptName } });
    return true;
  }

  static async activatePrompt(promptName) {
    await AIPrompt.update({ is_active: true }, { where: { prompt_name: promptName } });
    return true;
  }
}

module.exports = AIPromptService;


