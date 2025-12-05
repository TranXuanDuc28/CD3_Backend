const axios = require('axios');

const FB_GRAPH_URL = 'https://graph.facebook.com/v18.0';
const PAGE_ACCESS_TOKEN = process.env.FACEBOOK_ACCESS_TOKEN;

/**
 * Service for sending messages via Facebook Messenger
 */
class MessengerService {
    /**
     * Send a text message to a PSID
     * @param {string} psid - Page-Scoped ID of the recipient
     * @param {string} text - Message text
     * @param {Array} quickReplies - Optional quick replies
     * @returns {Promise<object>} - Response from Facebook API
     */
    static async sendMessage(psid, text, quickReplies = null) {
        try {
            const messageData = {
                recipient: { id: psid },
                message: { text }
            };

            if (quickReplies && quickReplies.length > 0) {
                messageData.message.quick_replies = quickReplies;
            }

            const response = await axios.post(
                `${FB_GRAPH_URL}/me/messages`,
                messageData,
                {
                    params: { access_token: PAGE_ACCESS_TOKEN }
                }
            );

            console.log(`✅ Message sent to ${psid}:`, response.data);
            return response.data;
        } catch (error) {
            console.error(`❌ Failed to send message to ${psid}:`, error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Send a template message (generic, button, etc.)
     * @param {string} psid - Page-Scoped ID
     * @param {string} templateType - Type: 'generic', 'button', 'receipt'
     * @param {Array} elements - Template elements
     * @returns {Promise<object>}
     */
    static async sendTemplate(psid, templateType, elements) {
        try {
            const messageData = {
                recipient: { id: psid },
                message: {
                    attachment: {
                        type: 'template',
                        payload: {
                            template_type: templateType,
                            elements: elements
                        }
                    }
                }
            };

            const response = await axios.post(
                `${FB_GRAPH_URL}/me/messages`,
                messageData,
                {
                    params: { access_token: PAGE_ACCESS_TOKEN }
                }
            );

            console.log(`✅ Template sent to ${psid}`);
            return response.data;
        } catch (error) {
            console.error(`❌ Failed to send template to ${psid}:`, error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Broadcast message to multiple PSIDs
     * @param {Array<string>} psids - Array of PSIDs
     * @param {string} text - Message text
     * @returns {Promise<Array>} - Results for each PSID
     */
    static async broadcastMessage(psids, text) {
        const results = [];

        for (const psid of psids) {
            try {
                await this.sendMessage(psid, text);
                results.push({ psid, status: 'sent' });
            } catch (error) {
                results.push({
                    psid,
                    status: 'failed',
                    error: error.response?.data?.error?.message || error.message
                });
            }

            // Rate limiting: wait 50ms between messages
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        return results;
    }

    /**
     * Validate if a PSID is valid
     * @param {string} psid - PSID to validate
     * @returns {Promise<boolean>}
     */
    static async validatePSID(psid) {
        try {
            const response = await axios.get(
                `${FB_GRAPH_URL}/${psid}`,
                {
                    params: {
                        access_token: PAGE_ACCESS_TOKEN,
                        fields: 'id,name'
                    }
                }
            );

            return !!response.data.id;
        } catch (error) {
            console.error(`Invalid PSID ${psid}:`, error.response?.data || error.message);
            return false;
        }
    }

    /**
     * Send message with tag (for messages outside 24h window)
     * @param {string} psid - PSID
     * @param {string} text - Message text
     * @param {string} tag - Message tag (e.g., 'CONFIRMED_EVENT_UPDATE')
     * @returns {Promise<object>}
     */
    static async sendTaggedMessage(psid, text, tag = 'CONFIRMED_EVENT_UPDATE') {
        try {
            const messageData = {
                recipient: { id: psid },
                message: { text },
                messaging_type: 'MESSAGE_TAG',
                tag: tag
            };

            const response = await axios.post(
                `${FB_GRAPH_URL}/me/messages`,
                messageData,
                {
                    params: { access_token: PAGE_ACCESS_TOKEN }
                }
            );

            console.log(`✅ Tagged message sent to ${psid}`);
            return response.data;
        } catch (error) {
            console.error(`❌ Failed to send tagged message to ${psid}:`, error.response?.data || error.message);
            throw error;
        }
    }
}

module.exports = MessengerService;
