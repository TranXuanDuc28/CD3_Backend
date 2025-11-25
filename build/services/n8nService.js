"use strict";

const axios = require('axios');
class N8nService {
  constructor() {
    this.n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
  }
  async triggerSchedulePost(payload) {
    try {
      console.log('Triggering n8n workflow with payload:', payload);

      // Call n8n webhook
      const response = await axios.post(this.n8nWebhookUrl, payload, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      return {
        success: true,
        n8nResponse: response.data,
        triggeredAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error triggering n8n workflow:', error.message);
      return {
        success: false,
        error: error.message,
        triggeredAt: new Date().toISOString()
      };
    }
  }
}
module.exports = new N8nService();