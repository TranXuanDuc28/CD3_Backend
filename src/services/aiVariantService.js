const axios = require("axios");

/**
 * Service để tạo các variants cho A/B testing sử dụng AI
 * Tạo nhiều phiên bản marketing khác nhau từ một message gốc
 */
class AIVariantService {
    /**
     * Các chiến lược marketing có thể sử dụng
     */
    static STRATEGIES = {
        promotion: {
            name: "Promotion-focused",
            description: "Tập trung vào khuyến mãi, giảm giá, ưu đãi",
            tone: "exciting",
        },
        benefit: {
            name: "Benefit-focused",
            description: "Nhấn mạnh lợi ích cho khách hàng",
            tone: "friendly",
        },
        urgency: {
            name: "Urgency-focused",
            description: "Tạo cảm giác khan hiếm, cấp bách",
            tone: "urgent",
        },
        emotion: {
            name: "Emotion-focused",
            description: "Kích thích cảm xúc, trải nghiệm",
            tone: "warm",
        },
    };

    /**
   * Helper function để sleep
   */
    static sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /**
     * Tạo các variants từ message gốc sử dụng Gemini AI với retry logic
     * @param {string} message - Message gốc từ user
     * @param {number} variantCount - Số lượng variants cần tạo (2-5)
     * @param {Array<string>} strategies - Các chiến lược sử dụng
     * @param {number} retries - Số lần retry (default: 3)
     * @returns {Promise<Array>} Mảng các variants
     */
    static async generateVariants(
        message,
        variantCount = 2,
        strategies = ["promotion", "benefit"],
        retries = 3
    ) {
        // Đảm bảo số lượng strategies phù hợp với variantCount
        const selectedStrategies = strategies.slice(0, variantCount);

        // Nếu không đủ strategies, lặp lại
        while (selectedStrategies.length < variantCount) {
            selectedStrategies.push(
                strategies[selectedStrategies.length % strategies.length]
            );
        }

        // Thử gọi API với retry logic
        for (let attempt = 0; attempt < retries; attempt++) {
            try {
                const apiKey = process.env.GEMINI_API_KEY;
                const endpoint =
                    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent";

                // Build prompt cho Gemini
                const prompt = this.buildPrompt(message, selectedStrategies);

                const payload = {
                    contents: [
                        {
                            parts: [{ text: prompt }],
                        },
                    ],
                    generationConfig: {
                        temperature: 0.9, // Cao để tạo variants đa dạng
                        topK: 40,
                        topP: 0.95,
                        maxOutputTokens: 1024,
                    },
                };

                console.log(`Calling Gemini API (attempt ${attempt + 1}/${retries})...`);
                const response = await axios.post(`${endpoint}?key=${apiKey}`, payload, {
                    headers: {
                        "Content-Type": "application/json",
                    },
                });

                // Parse response
                let resultText = null;
                if (
                    response.data &&
                    response.data.candidates &&
                    response.data.candidates[0]?.content?.parts
                ) {
                    resultText = response.data.candidates[0].content.parts
                        .map((p) => p.text)
                        .join("\n");
                }

                if (!resultText) {
                    throw new Error("No result returned from Gemini API");
                }

                // Parse JSON từ response
                const variants = this.parseVariantsFromResponse(
                    resultText,
                    selectedStrategies,
                    message
                );

                console.log("✅ Generated variants successfully:", variants);
                return variants;
            } catch (error) {
                const isRateLimit = error.response?.status === 429;
                const isLastAttempt = attempt === retries - 1;

                console.error(`❌ Error on attempt ${attempt + 1}:`, error.message);

                if (isRateLimit && !isLastAttempt) {
                    // Exponential backoff: 1s, 2s, 4s
                    const waitTime = Math.pow(2, attempt) * 1000;
                    console.log(`⏳ Rate limit hit, waiting ${waitTime}ms before retry...`);
                    await this.sleep(waitTime);
                    continue;
                }

                if (isLastAttempt) {
                    // Sau khi hết retry, sử dụng fallback
                    console.warn("⚠️ All retries failed, using fallback variants");
                    return this.createFallbackVariants(message, selectedStrategies);
                }

                // Các lỗi khác, retry
                if (!isLastAttempt) {
                    await this.sleep(1000);
                    continue;
                }
            }
        }

        // Fallback cuối cùng nếu vòng lặp kết thúc mà không trả về (ví dụ: lỗi không xác định)
        return this.createFallbackVariants(message, selectedStrategies);
    }

    /**
     * Build prompt cho Gemini dựa trên message và strategies
     */
    static buildPrompt(message, strategies) {
        const strategyDescriptions = strategies
            .map((s, i) => {
                const strategy = this.STRATEGIES[s];
                return `${i + 1}. ${strategy.name}: ${strategy.description}`;
            })
            .join("\n");

        return `Bạn là chuyên gia marketing. Nhiệm vụ của bạn là tạo ${strategies.length} phiên bản khác nhau cho một chiến dịch marketing.

Message gốc: "${message}"

Hãy tạo ${strategies.length} variants dựa trên các chiến lược sau:
${strategyDescriptions}

Yêu cầu:
- Mỗi variant phải ngắn gọn, súc tích (tối đa 100 ký tự)
- Phù hợp để làm caption cho banner/post Facebook
- Có thể sử dụng emoji phù hợp
- Mỗi variant phải khác biệt rõ ràng về cách tiếp cận

Trả về kết quả dưới dạng JSON array với format:
[
  {
    "message": "Nội dung variant 1",
    "strategy": "${strategies[0]}",
    "tone": "${this.STRATEGIES[strategies[0]].tone}"
  },
  {
    "message": "Nội dung variant 2",
    "strategy": "${strategies[1]}",
    "tone": "${this.STRATEGIES[strategies[1]].tone}"
  }
]

CHỈ TRẢ VỀ JSON, KHÔNG CÓ TEXT KHÁC.`;
    }

    /**
   * Parse variants từ response của Gemini
   */
    static parseVariantsFromResponse(responseText, strategies, message = "") {
        try {
            // Tìm JSON trong response
            const jsonMatch = responseText.match(/\[[\s\S]*\]/);
            if (!jsonMatch) {
                throw new Error("No JSON array found in response");
            }

            const variants = JSON.parse(jsonMatch[0]);

            // Validate và đảm bảo có đủ fields
            return variants.map((variant, index) => ({
                message: variant.message || "",
                strategy: variant.strategy || strategies[index] || "promotion",
                tone: variant.tone || this.STRATEGIES[strategies[index]]?.tone || "friendly",
            }));
        } catch (error) {
            console.error("Error parsing variants:", error);
            // Fallback: tạo variants mặc định
            return this.createFallbackVariants(message, strategies);
        }
    }

    /**
   * Tạo variants mặc định khi AI fail
   * Sử dụng template-based generation
   */
    static createFallbackVariants(message, strategies) {
        const templates = {
            promotion: [
                `🎉 ${message} - Ưu đãi đặc biệt!`,
                `💥 Giảm giá sốc! ${message}`,
                `🔥 Khuyến mãi hấp dẫn - ${message}`,
            ],
            benefit: [
                `✨ ${message} - Trải nghiệm tuyệt vời!`,
                `💯 ${message} - Lợi ích vượt trội!`,
                `⭐ Đặc quyền cho bạn - ${message}`,
            ],
            urgency: [
                `⏰ Nhanh tay! ${message}`,
                `🚨 Có hạn! ${message}`,
                `⚡ Đừng bỏ lỡ - ${message}`,
            ],
            emotion: [
                `❤️ ${message} - Cảm nhận khác biệt!`,
                `🌟 ${message} - Khoảnh khắc đáng nhớ!`,
                `💖 Yêu thích ngay - ${message}`,
            ],
        };

        return strategies.map((strategy, index) => {
            const strategyTemplates = templates[strategy] || templates.promotion;
            const template = strategyTemplates[index % strategyTemplates.length];

            return {
                message: template.substring(0, 100), // Giới hạn 100 ký tự
                strategy: strategy,
                tone: this.STRATEGIES[strategy]?.tone || "friendly",
            };
        });
    }

    /**
     * Tạo variants cho carousel slides - mỗi variant có style và message khác nhau
     * @param {Array} slides - Mảng slides gốc [{brand, message, style, dimensions}]
     * @param {number} variantCount - Số lượng variants cần tạo
     * @param {number} retries - Số lần retry
     * @returns {Promise<Array>} Mảng các carousel variants
     */
    static async generateCarouselVariants(slides, variantCount = 2, retries = 3) {
        if (!Array.isArray(slides) || slides.length === 0) {
            throw new Error("Slides must be a non-empty array");
        }

        // Variant 1: Giữ nguyên (original)
        const variant1 = {
            variantNumber: 1,
            style: slides[0].style || "refreshing",
            slides: slides.map((slide, i) => ({
                slideNumber: i + 1,
                message: slide.message,
                brand: slide.brand,
                style: slide.style || "refreshing",
                dimensions: slide.dimensions || "1200x630",
                prompt: `${slide.brand} brand: ${slide.message}. Style: ${slide.style || "refreshing"}, professional carousel slide ${i + 1}`,
            })),
        };

        // Variant 2+: Tạo bằng AI
        const aiVariants = [];

        for (let v = 2; v <= variantCount; v++) {
            for (let attempt = 0; attempt < retries; attempt++) {
                try {
                    const apiKey = process.env.GEMINI_API_KEY;
                    const endpoint =
                        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent";

                    // Build prompt cho Gemini
                    const prompt = this.buildCarouselVariantPrompt(slides, v);

                    const payload = {
                        contents: [
                            {
                                parts: [{ text: prompt }],
                            },
                        ],
                        generationConfig: {
                            temperature: 0.9,
                            topK: 40,
                            topP: 0.95,
                            maxOutputTokens: 2048,
                        },
                    };

                    console.log(`Generating carousel variant ${v} (attempt ${attempt + 1}/${retries})...`);
                    const response = await axios.post(`${endpoint}?key=${apiKey}`, payload, {
                        headers: {
                            "Content-Type": "application/json",
                        },
                    });

                    let resultText = null;
                    if (
                        response.data &&
                        response.data.candidates &&
                        response.data.candidates[0]?.content?.parts
                    ) {
                        resultText = response.data.candidates[0].content.parts
                            .map((p) => p.text)
                            .join("\n");
                    }

                    if (!resultText) {
                        throw new Error("No result returned from Gemini API");
                    }

                    // Parse JSON từ response
                    const variantData = this.parseCarouselVariantFromResponse(resultText, slides, v);
                    aiVariants.push(variantData);
                    console.log(`✅ Generated carousel variant ${v} successfully`);
                    break; // Success, exit retry loop
                } catch (error) {
                    const isRateLimit = error.response?.status === 429;
                    const isLastAttempt = attempt === retries - 1;

                    console.error(`❌ Error generating variant ${v}, attempt ${attempt + 1}:`, error.message);

                    if (isRateLimit && !isLastAttempt) {
                        const waitTime = Math.pow(2, attempt) * 1000;
                        console.log(`⏳ Rate limit hit, waiting ${waitTime}ms...`);
                        await this.sleep(waitTime);
                        continue;
                    }

                    if (isLastAttempt) {
                        console.warn(`⚠️ Failed to generate variant ${v}, using fallback`);
                        aiVariants.push(this.createFallbackCarouselVariant(slides, v));
                        break;
                    }

                    await this.sleep(1000);
                }
            }
        }

        return [variant1, ...aiVariants];
    }

    /**
     * Build prompt cho Gemini để tạo carousel variant
     */
    static buildCarouselVariantPrompt(slides, variantNumber) {
        const slidesDescription = slides
            .map((s, i) => `Slide ${i + 1}: "${s.message}"`)
            .join("\n");

        const styleOptions = ["Cozy", "Vibrant", "Elegant", "Playful", "Professional", "Festive"];
        const suggestedStyle = styleOptions[variantNumber % styleOptions.length];

        return `Bạn là chuyên gia marketing. Tôi có một carousel với ${slides.length} slides:

${slidesDescription}

Style hiện tại: ${slides[0].style || "refreshing"}

Hãy tạo một VARIANT MỚI (variant ${variantNumber}) với:
1. Style khác: "${suggestedStyle}" (thay vì ${slides[0].style})
2. Messages được viết lại hoàn toàn với tone khác biệt
3. Nhấn mạnh khía cạnh khác của sản phẩm/dịch vụ
4. CTA (Call-to-Action) rõ ràng hơn
5. Có thể thay đổi emoji cho phù hợp

Yêu cầu:
- Mỗi slide message tối đa 80 ký tự
- Giữ nguyên brand name
- Phải khác biệt rõ ràng so với bản gốc
- Phù hợp cho Facebook carousel post

Trả về JSON với format:
{
  "style": "${suggestedStyle}",
  "slides": [
    {
      "message": "Message mới cho slide 1",
      "tone": "warm/exciting/urgent/friendly"
    },
    {
      "message": "Message mới cho slide 2",
      "tone": "warm/exciting/urgent/friendly"
    }
  ]
}

CHỈ TRẢ VỀ JSON, KHÔNG CÓ TEXT KHÁC.`;
    }

    /**
     * Parse carousel variant từ Gemini response
     */
    static parseCarouselVariantFromResponse(responseText, originalSlides, variantNumber) {
        try {
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error("No JSON object found in response");
            }

            const parsed = JSON.parse(jsonMatch[0]);

            return {
                variantNumber,
                style: parsed.style || "cozy",
                slides: originalSlides.map((originalSlide, i) => {
                    const aiSlide = parsed.slides?.[i] || {};
                    return {
                        slideNumber: i + 1,
                        message: aiSlide.message || originalSlide.message,
                        brand: originalSlide.brand,
                        style: parsed.style || "cozy",
                        dimensions: originalSlide.dimensions || "1200x630",
                        prompt: `${originalSlide.brand} brand: ${aiSlide.message || originalSlide.message}. Style: ${parsed.style || "cozy"}, professional carousel slide ${i + 1}`,
                    };
                }),
            };
        } catch (error) {
            console.error("Error parsing carousel variant:", error);
            return this.createFallbackCarouselVariant(originalSlides, variantNumber);
        }
    }

    /**
     * Tạo fallback carousel variant khi AI fail
     */
    static createFallbackCarouselVariant(originalSlides, variantNumber) {
        const styles = ["Cozy", "Vibrant", "Elegant", "Playful"];
        const style = styles[(variantNumber - 1) % styles.length];

        const templates = {
            Cozy: {
                prefix: ["🏡", "☕", "❤️"],
                suffix: ["- Ấm áp mùa lễ hội!", "- Thư giãn cùng bạn bè!", "- Khoảnh khắc đáng nhớ!"],
            },
            Vibrant: {
                prefix: ["🔥", "⚡", "💥"],
                suffix: ["- Năng lượng tràn đầy!", "- Sống động mỗi ngày!", "- Bùng nổ cảm xúc!"],
            },
            Elegant: {
                prefix: ["✨", "💎", "🌟"],
                suffix: ["- Đẳng cấp vượt trội!", "- Sang trọng tinh tế!", "- Phong cách riêng biệt!"],
            },
            Playful: {
                prefix: ["🎉", "🎈", "🎊"],
                suffix: ["- Vui vẻ mỗi ngày!", "- Tận hưởng niềm vui!", "- Khám phá điều mới!"],
            },
        };

        const template = templates[style] || templates.Cozy;

        return {
            variantNumber,
            style: style.toLowerCase(),
            slides: originalSlides.map((slide, i) => {
                const emoji = template.prefix[i % template.prefix.length];
                const suffix = template.suffix[i % template.suffix.length];
                const newMessage = `${emoji} ${slide.message.replace(/[🎄☕📸🎁✨🎅❄️]/g, "").trim()} ${suffix}`;

                return {
                    slideNumber: i + 1,
                    message: newMessage.substring(0, 80),
                    brand: slide.brand,
                    style: style.toLowerCase(),
                    dimensions: slide.dimensions || "1200x630",
                    prompt: `${slide.brand} brand: ${newMessage}. Style: ${style.toLowerCase()}, professional carousel slide ${i + 1}`,
                };
            }),
        };
    }

    /**
     * Phân tích message để đề xuất chiến lược phù hợp
     */
    static async suggestStrategies(message) {
        // Simple rule-based suggestion
        const suggestions = [];

        const lowerMessage = message.toLowerCase();

        if (
            lowerMessage.includes("giảm") ||
            lowerMessage.includes("khuyến mãi") ||
            lowerMessage.includes("sale")
        ) {
            suggestions.push("promotion");
        }

        if (
            lowerMessage.includes("sinh viên") ||
            lowerMessage.includes("học sinh") ||
            lowerMessage.includes("lợi ích")
        ) {
            suggestions.push("benefit");
        }

        if (
            lowerMessage.includes("hạn") ||
            lowerMessage.includes("nhanh") ||
            lowerMessage.includes("ngay")
        ) {
            suggestions.push("urgency");
        }

        if (
            lowerMessage.includes("trải nghiệm") ||
            lowerMessage.includes("cảm xúc") ||
            lowerMessage.includes("yêu")
        ) {
            suggestions.push("emotion");
        }

        // Nếu không có gợi ý nào, trả về mặc định
        if (suggestions.length === 0) {
            return ["promotion", "benefit"];
        }

        return suggestions;
    }
}

module.exports = AIVariantService;
