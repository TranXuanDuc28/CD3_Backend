"use strict";

const axios = require("axios");
require("dotenv").config();
const HUGGINGFACE_API_URL = 'https://router.huggingface.co/together/v1/images/generations';
class GenerateController {
  // POST /api/generate

  static async generateContent(req, res) {
    try {
      const {
        prompt_image
      } = req.body;
      if (!prompt_image) {
        return res.status(400).json({
          success: false,
          message: "prompt_image is required"
        });
      }
      const payload = {
        prompt: prompt_image,
        response_format: 'b64_json',
        model: 'black-forest-labs/FLUX.1-schnell'
      };
      const response = await axios.post(HUGGINGFACE_API_URL, payload, {
        headers: {
          Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
          "Content-Type": "application/json"
        }
      });
      const b64Data = response.data.data[0].b64_json;
      if (!b64Data) {
        throw new Error("No image returned from Hugging Face API");
      }
      const images = [{
        base64: b64Data
      }];
      return res.json({
        success: true,
        prompt: prompt_image,
        generated_at: new Date().toISOString(),
        images
      });
    } catch (error) {
      console.error("HuggingFace API error:", error.message);
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}
module.exports = GenerateController;