const { Op } = require('sequelize');
const { CustomerMessage, NotificationLog } = require('../models');
const MessengerService = require('./messengerService');

/**
 * Service for managing customer notifications
 */
class NotificationService {
    /**
     * Notify recent customers about a new post
     * @param {object} options - Notification options
     * @returns {Promise<Array>} - Results of notifications sent
     */
    static async notifyRecentCustomers(options) {
        const { postType, postId, postUrl, message, occasionType } = options;

        console.log(`📢 Sending notifications for ${occasionType || 'special occasion'}`);
        console.log(`Post Type: ${postType}, Post ID: ${postId}`);

        // 1. Lấy khách hàng đã chat trong 5 ngày
        const fiveDaysAgo = new Date();
        fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

        const customers = await CustomerMessage.findAll({
            where: {
                lastMessageAt: { [Op.gte]: fiveDaysAgo },
                platform: 'facebook',
                isActive: true  // Chỉ gửi cho khách muốn nhận thông báo
            }
        });

        console.log(`Found ${customers.length} customers to notify`);

        if (customers.length === 0) {
            console.log('⚠️ No customers to notify');
            return [];
        }

        // 2. Tùy chỉnh message theo loại dịp
        const customMessage = this.getMessageByOccasion(occasionType, message);

        // 3. Gửi tin nhắn cho từng khách
        const results = [];
        for (const customer of customers) {
            try {
                // Gửi template message
                await MessengerService.sendTemplate(customer.psid, 'generic', [{
                    title: customMessage.title,
                    subtitle: customMessage.subtitle,
                    image_url: customMessage.imageUrl,
                    buttons: [{
                        type: 'web_url',
                        url: postUrl,
                        title: 'Xem ngay 👉'
                    }]
                }]);

                // Log thành công
                await NotificationLog.create({
                    customerId: customer.id,
                    postId,
                    postType,
                    occasionType,
                    sentAt: new Date(),
                    status: 'sent',
                    messageContent: JSON.stringify(customMessage)
                });

                results.push({
                    psid: customer.psid,
                    customerName: customer.customerName,
                    status: 'sent'
                });

                console.log(`✅ Sent to ${customer.customerName || customer.psid}`);
            } catch (error) {
                // Log lỗi
                await NotificationLog.create({
                    customerId: customer.id,
                    postId,
                    postType,
                    occasionType,
                    status: 'failed',
                    errorMessage: error.message
                });

                results.push({
                    psid: customer.psid,
                    customerName: customer.customerName,
                    status: 'failed',
                    error: error.message
                });

                console.error(`❌ Failed to send to ${customer.psid}:`, error.message);
            }

            // Rate limiting: wait 100ms between messages
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        console.log(`📊 Notification results: ${results.filter(r => r.status === 'sent').length} sent, ${results.filter(r => r.status === 'failed').length} failed`);

        return results;
    }

    /**
     * Tùy chỉnh message theo dịp đặc biệt
     * @param {string} occasionType - Loại dịp
     * @param {string} defaultMessage - Message mặc định
     * @returns {object} - Message template
     */
    static getMessageByOccasion(occasionType, defaultMessage) {
        const templates = {
            'Tết': {
                title: '🧧 Chúc Mừng Năm Mới!',
                subtitle: 'Ưu đãi đặc biệt mừng Tết - Giảm giá lên đến 50%! 🎊',
                imageUrl: null
            },
            'Noel': {
                title: '🎄 Giáng Sinh An Lành!',
                subtitle: 'Quà tặng đặc biệt mùa Noel dành cho bạn ❄️',
                imageUrl: null
            },
            'Black Friday': {
                title: '🔥 Black Friday Sale!',
                subtitle: 'Giảm giá sốc - Chỉ hôm nay! Đừng bỏ lỡ!',
                imageUrl: null
            },
            'Valentine': {
                title: '💝 Valentine Ngọt Ngào!',
                subtitle: 'Ưu đãi đặc biệt cho ngày lễ tình nhân 💕',
                imageUrl: null
            },
            'Sinh Nhật': {
                title: '🎂 Chúc Mừng Sinh Nhật!',
                subtitle: 'Quà tặng sinh nhật đặc biệt dành riêng cho bạn!',
                imageUrl: null
            },
            '8/3': {
                title: '🌸 Chúc Mừng Ngày Quốc Tế Phụ Nữ!',
                subtitle: 'Ưu đãi đặc biệt 8/3 - Dành tặng những người phụ nữ tuyệt vời!',
                imageUrl: null
            }
        };

        return templates[occasionType] || {
            title: '🎉 Sự kiện đặc biệt!',
            subtitle: defaultMessage || 'Chúng tôi vừa có bài đăng mới! Xem ngay nhé',
            imageUrl: null
        };
    }

    /**
     * Get notification logs for a post
     * @param {number} postId - Post ID
     * @param {string} postType - Post type
     * @returns {Promise<Array>}
     */
    static async getNotificationLogs(postId, postType) {
        return await NotificationLog.findAll({
            where: { postId, postType },
            include: [{
                model: CustomerMessage,
                as: 'customer',
                attributes: ['psid', 'customerName', 'platform']
            }],
            order: [['sentAt', 'DESC']]
        });
    }

    /**
     * Get notification statistics
     * @returns {Promise<object>}
     */
    static async getStatistics() {
        const total = await NotificationLog.count();
        const sent = await NotificationLog.count({ where: { status: 'sent' } });
        const failed = await NotificationLog.count({ where: { status: 'failed' } });
        const activeCustomers = await CustomerMessage.count({
            where: { isActive: true }
        });

        return {
            total,
            sent,
            failed,
            successRate: total > 0 ? ((sent / total) * 100).toFixed(2) + '%' : '0%',
            activeCustomers
        };
    }
}

module.exports = NotificationService;
