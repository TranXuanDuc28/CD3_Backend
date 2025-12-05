const { CustomerMessage } = require('../models');

/**
 * Controller for handling Facebook Messenger webhooks
 */
class WebhookController {
    /**
     * Verify webhook (GET request from Facebook)
     * @param {object} req - Request object
     * @param {object} res - Response object
     */
    static verifyWebhook(req, res) {
        const VERIFY_TOKEN = process.env.FACEBOOK_ACCESS_TOKEN || 'your_verify_token';

        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];

        if (mode && token) {
            if (mode === 'subscribe' && token === VERIFY_TOKEN) {
                console.log('✅ Webhook verified');
                res.status(200).send(challenge);
            } else {
                console.error('❌ Webhook verification failed');
                res.sendStatus(403);
            }
        } else {
            res.sendStatus(400);
        }
    }

    /**
     * Handle incoming webhook events (POST request from Facebook)
     * @param {object} req - Request object
     * @param {object} res - Response object
     */
    static async handleFacebookWebhook(req, res) {
        const body = req.body;

        // Check if this is a page event
        if (body.object === 'page') {
            // Iterate over each entry
            for (const entry of body.entry) {
                // Get the messaging events
                const webhookEvent = entry.messaging ? entry.messaging[0] : null;

                if (webhookEvent) {
                    await WebhookController.handleWebhookEvent(webhookEvent);
                }
            }

            // Return 200 OK to acknowledge receipt
            res.status(200).send('EVENT_RECEIVED');
        } else {
            res.sendStatus(404);
        }
    }

    /**
     * Handle individual webhook event
     * @param {object} event - Webhook event
     */
    static async handleWebhookEvent(event) {
        const senderId = event.sender.id;

        try {
            // Handle message event
            if (event.message) {
                await WebhookController.handleMessage(senderId, event.message);
            }

            // Handle postback event (button clicks)
            if (event.postback) {
                await WebhookController.handlePostback(senderId, event.postback);
            }
        } catch (error) {
            console.error('Error handling webhook event:', error);
        }
    }

    /**
     * Handle incoming message
     * @param {string} senderId - PSID of sender
     * @param {object} message - Message object
     */
    static async handleMessage(senderId, message) {
        console.log(`📩 Message from ${senderId}:`, message.text);

        try {
            // Upsert customer message record
            const [customer, created] = await CustomerMessage.findOrCreate({
                where: { psid: senderId },
                defaults: {
                    psid: senderId,
                    lastMessageAt: new Date(),
                    messageCount: 1,
                    platform: 'facebook',
                    isActive: true
                }
            });

            if (!created) {
                // Update existing customer
                await customer.update({
                    lastMessageAt: new Date(),
                    messageCount: customer.messageCount + 1
                });
            }

            console.log(`✅ Customer ${senderId} tracked (${created ? 'new' : 'updated'})`);

            // Handle opt-out keywords
            const text = message.text?.toLowerCase();
            if (text && (text.includes('stop') || text.includes('unsubscribe') || text.includes('dừng'))) {
                await customer.update({ isActive: false });
                console.log(`🚫 Customer ${senderId} opted out`);
            }

            // Handle opt-in keywords
            if (text && (text.includes('start') || text.includes('subscribe') || text.includes('nhận'))) {
                await customer.update({ isActive: true });
                console.log(`✅ Customer ${senderId} opted in`);
            }
        } catch (error) {
            console.error('Error handling message:', error);
        }
    }

    /**
     * Handle postback (button click)
     * @param {string} senderId - PSID of sender
     * @param {object} postback - Postback object
     */
    static async handlePostback(senderId, postback) {
        console.log(`👆 Postback from ${senderId}:`, postback.payload);

        // Track interaction
        try {
            const customer = await CustomerMessage.findOne({ where: { psid: senderId } });
            if (customer) {
                await customer.update({
                    lastMessageAt: new Date()
                });
            }
        } catch (error) {
            console.error('Error handling postback:', error);
        }
    }
}

module.exports = WebhookController;
