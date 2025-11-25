"use strict";

require('dotenv').config();
const GEMINI_EMBED_URL = 'https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent';
async function generateEmbedding(text) {
  //   const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  //   if (!apiKey) throw new Error('Thiếu GOOGLE_API_KEY hoặc GEMINI_API_KEY trong .env');

  //   const response = await fetch(GEMINI_EMBED_URL, {
  //     method: 'POST',
  //     headers: {
  //       'Content-Type': 'application/json',
  //       'x-goog-api-key': apiKey,
  //     },
  //     body: JSON.stringify({
  //       model: 'models/text-embedding-004',
  //       content: { parts: [{ text }] },
  //     }),
  //   });

  //   const data = await response.json();

  //   if (!response.ok) {
  //     throw new Error(JSON.stringify(data));
  //   }

  //   return data.embedding?.values || [];
}
module.exports = {
  generateEmbedding
};