class N8nController {
  // POST /api/n8n-callback
  async n8nCallback(req, res) {
    try {
      const callbackData = req.body;

      // Process callback data from n8n workflow
      const processedData = {
        workflowId: callbackData.workflowId,
        executionId: callbackData.executionId,
        status: callbackData.status,
        data: callbackData.data,
        processed_at: new Date().toISOString()
      };

      // Here you can add logic to process the callback data
      // For example, update database records, trigger other workflows, etc.
      // If n8n sends a banner selection, trigger broadcast automatically
      try {
        const BroadcastService = require('../services/broadcast.service');
        if (callbackData && (callbackData.banner || (callbackData.data && callbackData.data.banner))) {
          const banner = callbackData.banner || callbackData.data.banner;
          const recipients = callbackData.recipients || callbackData.data.recipients || [];
          // Fire-and-forget: do not block n8n callback long
          BroadcastService.broadcastBannerToCustomers(banner, recipients).then(r => {
            console.log('Broadcast triggered by n8n callback, results:', r.length);
          }).catch(e => console.warn('Broadcast failed from n8n callback:', e.message));
        }
      } catch (e) {
        console.warn('Error while auto-triggering broadcast:', e.message);
      }

      res.json({
        success: true,
        message: 'Callback processed successfully',
        data: processedData
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = new N8nController();