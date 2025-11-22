const axios = require('axios');
require('dotenv').config();

// Gemini API configuration
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent";

// Model configuration
const modelConfig = {
  temperature: 0.7,
  topP: 0.9,
  topK: 40,
  maxOutputTokens: 1024,
};


// Safety settings
const safetySettings = [
  {
    category: "HARM_CATEGORY_HARASSMENT",
    threshold: "BLOCK_MEDIUM_AND_ABOVE",
  },
  {
    category: "HARM_CATEGORY_HATE_SPEECH", 
    threshold: "BLOCK_MEDIUM_AND_ABOVE",
  },
  {
    category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
    threshold: "BLOCK_MEDIUM_AND_ABOVE",
  },
  {
    category: "HARM_CATEGORY_DANGEROUS_CONTENT",
    threshold: "BLOCK_MEDIUM_AND_ABOVE",
  },
];

// Generate AI response with chat history
async function generateResponse(userMessage, systemPrompt, chatHistory = []) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Missing GEMINI_API_KEY in environment");
    }

    // Build conversation history
    const history = chatHistory.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));

    // Combine system prompt with user message
    const vietnameseInstruction = "QUAN TRỌNG: Trả lời bằng tiếng Việt. Không bao giờ trả lời bằng tiếng Anh.\n\n";
    const fullPrompt = systemPrompt 
      ? `${vietnameseInstruction}${systemPrompt}\n\nTin nhắn từ khách hàng: ${userMessage}`
      : `${vietnameseInstruction}Tin nhắn từ khách hàng: ${userMessage}`;

    // Prepare request payload
    const requestPayload = {
      contents: [
        ...history,
        {
          role: "user",
          parts: [{ text: fullPrompt }]
        }
      ],
      generationConfig: modelConfig,
      safetySettings: safetySettings
    };

    // Call Gemini API
    const response = await axios.post(
      `${GEMINI_API_URL}?key=${apiKey}`,
      requestPayload,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    // Extract response text
    const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

    if (!text) {
      throw new Error("Empty response from Gemini API");
    }

    return {
      success: true,
      response: text,
      error: null
    };
  } catch (error) {
    console.error('❌ Gemini API error:', error.response?.data || error.message);
    return {
      success: false,
      response: null,
      error: error.message
    };
  }
}

// Generate response without history (simple mode)
async function generateSimpleResponse(userMessage, systemPrompt) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Missing GEMINI_API_KEY in environment");
    }

    const vietnameseInstruction = "QUAN TRỌNG: Trả lời bằng tiếng Việt. Không bao giờ trả lời bằng tiếng Anh.\n\n";
    const fullPrompt = systemPrompt 
      ? `${vietnameseInstruction}${systemPrompt}\n\nTin nhắn từ khách hàng: ${userMessage}`
      : `${vietnameseInstruction}Tin nhắn từ khách hàng: ${userMessage}`;

    // Prepare request payload
    const requestPayload = {
      contents: [
        {
          role: "user",
          parts: [{ text: fullPrompt }]
        }
      ],
      generationConfig: modelConfig,
      safetySettings: safetySettings
    };

    // Call Gemini API
    const response = await axios.post(
      `${GEMINI_API_URL}?key=${apiKey}`,
      requestPayload,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    // Extract response text
    const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

    if (!text) {
      throw new Error("Empty response from Gemini API");
    }

    return {
      success: true,
      response: text,
      error: null
    };
  } catch (error) {
    console.error('❌ Gemini API error:', error.response?.data || error.message);
    return {
      success: false,
      response: null,
      error: error.message
    };
  }
}

module.exports = {
  generateResponse,
  generateSimpleResponse
};

