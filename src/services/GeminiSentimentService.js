const { generateSimpleResponse } = require('../config/gemini');
const Logger = require('../utils/logger');

/**
 * GeminiSentimentService
 * Sử dụng Gemini AI để phân tích sentiment, toxic và trích xuất keywords
 * Gemini TỰ ĐỘNG nhận diện toxic content dựa trên ngữ cảnh
 */
class GeminiSentimentService {
    /**
     * Phân tích sentiment + toxic của comment bằng Gemini AI
     * @param {string} message - Nội dung comment
     * @returns {Promise<Object>} - Kết quả phân tích
     */
    static async analyzeSentiment(message) {
        try {
            // Prompt cho phép Gemini TỰ NHẬN DIỆN toxic content
            const prompt = `
Phân tích comment này và trả về JSON:

"${message}"

Yêu cầu:
1. Sentiment: đánh giá cảm xúc (positive/negative/neutral)
2. Score: điểm từ -1.0 đến 1.0
3. Keywords: trích xuất 3-5 từ khóa chính (tiếng Việt không dấu, viết thường)
4. Is_toxic: TỰ ĐÁNH GIÁ xem comment có nội dung không phù hợp không (spam, lăng mạ, kích động, quấy rối, bạo lực, lừa đảo, v.v.)
5. Toxic_category: nếu toxic, TỰ XÁC ĐỊNH loại (ví dụ: spam, profanity, hate_speech, harassment, violence, scam, hoặc mô tả ngắn gọn)
6. Reason: giải thích ngắn gọn

Trả về JSON (không giải thích thêm):
{
  "sentiment": "positive|negative|neutral",
  "score": 0.5,
  "keywords": ["tu khoa 1", "tu khoa 2"],
  "is_toxic": false,
  "toxic_category": null,
  "reason": "lý do"
}
`;

            const result = await generateSimpleResponse(prompt, '');

            if (!result.success || !result.response) {
                Logger.warn('⚠️ Gemini API error or empty, using fallback', { error: result.error });
                // Thay vì throw, ta sẽ để code chạy tiếp xuống phần catch bên dưới để dùng fallback
                throw new Error(result.error || 'Gemini API returned empty response');
            }

            // Parse JSON từ response
            let jsonText = result.response.trim();

            // Remove markdown code blocks nếu có
            jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

            // Nếu không có {, thử tìm JSON trong text
            if (!jsonText.startsWith('{')) {
                const match = jsonText.match(/\{[\s\S]*\}/);
                if (match) {
                    jsonText = match[0];
                } else {
                    throw new Error('No JSON found in response');
                }
            }

            // Parse JSON
            const analysis = JSON.parse(jsonText);

            // Validate response structure
            if (!analysis.sentiment) {
                throw new Error('Missing sentiment in response');
            }

            // Normalize sentiment value
            const validSentiments = ['positive', 'negative', 'neutral'];
            if (!validSentiments.includes(analysis.sentiment)) {
                // Try to map Vietnamese to English
                if (analysis.sentiment.includes('tích cực') || analysis.sentiment.includes('positive')) {
                    analysis.sentiment = 'positive';
                } else if (analysis.sentiment.includes('tiêu cực') || analysis.sentiment.includes('negative')) {
                    analysis.sentiment = 'negative';
                } else {
                    analysis.sentiment = 'neutral';
                }
            }

            // Ensure score is number and in range [-1, 1]
            analysis.score = parseFloat(analysis.score) || 0;
            analysis.score = Math.max(-1, Math.min(1, analysis.score));

            // Ensure keywords is array
            if (!Array.isArray(analysis.keywords)) {
                analysis.keywords = [];
            }
            analysis.keywords = analysis.keywords.slice(0, 5);

            // Ensure is_toxic is boolean
            analysis.is_toxic = !!analysis.is_toxic;

            // Normalize toxic_category (Gemini tự xác định)
            if (analysis.is_toxic && !analysis.toxic_category) {
                analysis.toxic_category = 'other';
            }

            Logger.info('✅ Gemini sentiment + toxic analysis OK', {
                message: message.substring(0, 30),
                sentiment: analysis.sentiment,
                score: analysis.score,
                is_toxic: analysis.is_toxic,
                toxic_category: analysis.toxic_category
            });

            return {
                success: true,
                sentiment: analysis.sentiment,
                score: parseFloat(analysis.score.toFixed(2)),
                keywords: analysis.keywords,
                is_toxic: analysis.is_toxic,
                toxic_category: analysis.toxic_category || null,
                reason: analysis.reason || '',
                confidenceScore: 0.9
            };

        } catch (error) {
            Logger.error('❌ Gemini sentiment analysis error', {
                error: error.message,
                message: message.substring(0, 50)
            });

            // Fallback: simple heuristic
            const lowerMsg = message.toLowerCase();
            let sentiment = 'neutral';
            let score = 0;
            let is_toxic = false;

            // Simple positive/negative detection
            if (lowerMsg.includes('tốt') || lowerMsg.includes('hay') || lowerMsg.includes('đẹp') || lowerMsg.includes('ok')) {
                sentiment = 'positive';
                score = 0.5;
            } else if (lowerMsg.includes('tệ') || lowerMsg.includes('xấu') || lowerMsg.includes('kém')) {
                sentiment = 'negative';
                score = -0.5;
            }

            // Simple toxic detection (fallback only)
            const toxicWords = ['dm', 'vl', 'cc', 'đm', 'lừa đảo', 'scam', 'spam'];
            is_toxic = toxicWords.some(word => lowerMsg.includes(word));

            return {
                success: false,
                sentiment: sentiment,
                score: score,
                keywords: [],
                is_toxic: is_toxic,
                toxic_category: is_toxic ? 'profanity' : null,
                reason: 'Fallback analysis',
                confidenceScore: 0.3,
                error: error.message
            };
        }
    }
}

module.exports = GeminiSentimentService;
