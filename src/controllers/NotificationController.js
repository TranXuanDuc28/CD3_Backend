const NotificationService = require('../services/notificationService');

class NotificationController {
    /**
     * Get all notification logs grouped by post
     * GET /api/notifications/logs
     */
    static async getNotificationLogs(req, res) {
        try {
            const { postId, postType, occasionType, status } = req.query;

            const logs = await NotificationService.getAllNotificationLogs({
                postId,
                postType,
                occasionType,
                status
            });

            res.json({
                success: true,
                data: logs
            });
        } catch (error) {
            console.error('Error getting notification logs:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Get notification logs for a specific post
     * GET /api/notifications/logs/:postType/:postId
     */
    static async getPostNotificationLogs(req, res) {
        try {
            const { postType, postId } = req.params;

            const logs = await NotificationService.getNotificationLogs(
                parseInt(postId),
                postType
            );

            res.json({
                success: true,
                data: logs
            });
        } catch (error) {
            console.error('Error getting post notification logs:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Get notification statistics
     * GET /api/notifications/stats
     */
    static async getStatistics(req, res) {
        try {
            const stats = await NotificationService.getStatistics();

            res.json({
                success: true,
                stats
            });
        } catch (error) {
            console.error('Error getting notification statistics:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Get recent notification campaigns (grouped by post)
     * GET /api/notifications/campaigns
     */
    static async getCampaigns(req, res) {
        try {
            const { limit = 20 } = req.query;

            const campaigns = await NotificationService.getRecentCampaigns(
                parseInt(limit)
            );

            res.json({
                success: true,
                data: campaigns
            });
        } catch (error) {
            console.error('Error getting notification campaigns:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
}

module.exports = NotificationController;
