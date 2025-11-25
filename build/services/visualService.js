"use strict";

const axios = require("axios");
const sharp = require("sharp");
const fs = require("fs").promises;
const path = require("path");
const {
  Op
} = require("sequelize");
const TimezoneUtils = require("../utils/timezone");
const {
  Visual,
  AbTest,
  AbTestVariant
} = require("../models");
const removeAccents = require("remove-accents");

// const HUGGINGFACE_API_URL = 'https://api-inference.huggingface.co/models/runwayml/stable-diffusion-v1-5';
const HUGGINGFACE_API_URL = "https://router.huggingface.co/together/v1/images/generations";
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;
//console.log("Hugging Face API Key:", HUGGINGFACE_API_KEY);
const cloudinary = require("cloudinary").v2;

// Cấu hình Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});
class VisualService {
  // Tạo banner bằng Gemini API chuẩn như curl
  // static async generateBanner(prompt, size = '1200x630', variants = 1) {
  //   const apiKey = process.env.GEMINI_API_KEY;
  //   const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
  //   const images = [];
  //   for (let i = 0; i < variants; i++) {
  //     const variantPrompt = variants > 1 ? `${prompt} - Variant ${i + 1}` : prompt;
  //     const payload = {
  //       contents: [
  //         {
  //           parts: [
  //             { text: variantPrompt }
  //           ]
  //         }
  //       ],
  //       generationConfig: {
  //         thinkingConfig: {
  //           thinkingBudget: 0
  //         }
  //       }
  //     };
  //     const response = await axios.post(endpoint, payload, {
  //       headers: {
  //         'x-goog-api-key': apiKey,
  //         'Content-Type': 'application/json'
  //       }
  //     });
  //     // Trích xuất kết quả text từ response
  //     let resultText = null;
  //     if (response.data && response.data.candidates && response.data.candidates[0]?.content?.parts) {
  //       resultText = response.data.candidates[0].content.parts.map(p => p.text).join('\n');
  //     }
  //     if (resultText) {
  //       images.push(resultText);
  //     } else {
  //       throw new Error('No result returned from Gemini API');
  //     }
  //   }
  //   return images;
  // }

  static async generateBanner(prompt, size = "1200x630", variants = 1) {
    const images = [];
    const [width, height] = size.split("x").map(Number);
    const extractSignature = text => {
      let clean = text.replace(/[^\p{L}\p{N}\s]/gu, "").trim();
      const words = clean.split(/\s+/);
      return removeAccents(words.slice(-3).join(" "));
    };
    for (let i = 0; i < variants; i++) {
      const variantPrompt = `Hãy thêm một vài chữ đặc trưng cho ảnh: ${prompt} - Phiên bản ${i + 1}`;
      const signatureText = extractSignature(prompt);
      console.log("Generating image with prompt:", variantPrompt);
      const payload = {
        prompt: variantPrompt,
        response_format: "b64_json",
        model: "black-forest-labs/FLUX.1-schnell"
      };
      const response = await axios.post(HUGGINGFACE_API_URL, payload, {
        headers: {
          Authorization: `Bearer ${HUGGINGFACE_API_KEY}`,
          "Content-Type": "application/json"
        }
      });
      const b64Data = response.data.data[0]?.b64_json;
      if (!b64Data) throw new Error("No image returned from Hugging Face API");
      const imgBuffer = Buffer.from(b64Data, "base64");

      // Thêm signature rõ ràng bằng Sharp
      const svgText = `
        <svg width="${width}" height="${height}">
          <style>
            .signature {
              fill: white;
              font-size: 42px;
              font-weight: bold;
              font-family: 'Arial, sans-serif';
              text-shadow: 2px 2px 4px rgba(0,0,0,0.6);
            }
          </style>
          <text x="${width - 30}" y="${height - 30}" text-anchor="end" class="signature">${signatureText}</text>
        </svg>
      `;
      const processedImg = await sharp(imgBuffer).resize(width, height).composite([{
        input: Buffer.from(svgText),
        top: 0,
        left: 0
      }]).png().toBuffer();
      const tmpPath = path.join(__dirname, "../generated", `banner-${Date.now()}-${i}.png`);
      await fs.mkdir(path.dirname(tmpPath), {
        recursive: true
      });
      await fs.writeFile(tmpPath, processedImg);
      const cloudRes = await cloudinary.uploader.upload(tmpPath, {
        folder: "banners",
        use_filename: true,
        unique_filename: true,
        overwrite: true
      });
      console.log("Uploaded to Cloudinary:", cloudRes.secure_url);
      images.push(cloudRes.secure_url);
    }
    return images;
  }
  static async processImage(imageUrl, dimensions) {
    const [width, height] = (dimensions || "1920x1080").split("x").map(Number);

    // Download image
    const response = await axios.get(imageUrl, {
      responseType: "arraybuffer"
    });

    // Resize and convert to PNG
    const processedBuffer = await sharp(response.data).resize(width, height, {
      fit: "cover"
    }).png().toBuffer();

    // Save to generated folder
    const fileName = `processed-${Date.now()}.png`;
    const filePath = path.join(__dirname, "../generated", fileName);
    await fs.writeFile(filePath, processedBuffer);
    return `/static/${fileName}`;
  }
  static async createVariants(originalImage, variantCount) {
    const count = Math.max(1, Number(variantCount) || 1);
    const variants = [];

    // Lấy buffer ảnh gốc
    let originalBuffer;
    if (originalImage.startsWith("http")) {
      const response = await axios.get(originalImage, {
        responseType: "arraybuffer"
      });
      originalBuffer = response.data;
    } else {
      originalBuffer = await fs.readFile(path.resolve(originalImage));
    }
    for (let i = 1; i <= count; i++) {
      // Tạo biến thể: thay đổi hue, brightness, saturation
      const variantBuffer = await sharp(originalBuffer).modulate({
        brightness: 1 + i * 0.2,
        // tăng sáng rõ rệt
        saturation: 1 + i * 0.3,
        // tăng độ bão hòa
        hue: i * 60 // đổi sắc thái màu (0-360)
      }).png().toBuffer();

      // Lưu biến thể vào thư mục generated
      const variantName = `variant-${i + 1}-${Date.now()}.png`;
      const variantPath = path.join(__dirname, "../generated", variantName);
      await fs.mkdir(path.dirname(variantPath), {
        recursive: true
      });
      await fs.writeFile(variantPath, variantBuffer);
      variants.push(`/static/${variantName}`);
    }
    return variants;
  }
  static async listToCheck(checkTime = null) {
    console.log("Fetching A/B tests to check...");
    try {
      let timeToCheck;
      if (checkTime) {
        // Sử dụng thời gian từ FE và convert sang Vietnam timezone
        timeToCheck = new Date(checkTime);
        console.log("Using checkTime from FE (Vietnam time):", timeToCheck);
      } else {
        // Fallback về thời gian mặc định nếu không có input (2 phút trước)
        timeToCheck = TimezoneUtils.subtract(TimezoneUtils.now(), 3, "minutes").toDate();
        console.log("Using default checkTime (Vietnam time):", timeToCheck);
      }
      let abTests = await AbTest.findAll({
        where: {
          checked: true,
          status: "running",
          scheduledAt: {
            [Op.lte]: timeToCheck
          }
        },
        attributes: ["id", "notifyEmail"]
      });

      // Trả về dữ liệu, nếu rỗng trả về message
      if (abTests.length === 0) {
        return [];
      }
      console.log("Found A/B tests:", abTests);
      return abTests;
    } catch (err) {
      return {
        error: err.message
      };
    }
  }

  // Lấy Active A/B Tests
  static async getActiveAbTests() {
    try {
      const activeTests = await AbTest.findAll({
        where: {
          status: "completed"
        },
        include: [{
          model: AbTestVariant,
          as: "variants"
        }],
        order: [["scheduledAt", "DESC"]]
      });
      console.log("Active A/B tests fetched:", activeTests.length);
      return activeTests.map(test => ({
        id: test.id,
        type: test.data?.type || "banner",
        projectId: test.projectId,
        status: test.status,
        scheduledAt: test.scheduledAt,
        createdAt: test.createdAt,
        variantCount: test.variants?.length || 0,
        notifyEmail: test.notifyEmail
      }));
    } catch (error) {
      console.error("Error fetching active A/B tests:", error);
      return [];
    }
  }

  // Lấy Currently running tests
  static async getRunningTests() {
    try {
      const runningTests = await AbTest.findAll({
        where: {
          status: "running"
        },
        include: [{
          model: AbTestVariant,
          as: "variants"
        }],
        order: [["createdAt", "DESC"]]
      });
      return runningTests.map(test => ({
        id: test.id,
        type: test.data?.type || "banner",
        projectId: test.projectId,
        status: test.status,
        scheduledAt: test.scheduledAt,
        createdAt: test.createdAt,
        variantCount: test.variants?.length || 0,
        notifyEmail: test.notifyEmail,
        platformPostIds: test.platformPostIds || []
      }));
    } catch (error) {
      console.error("Error fetching running tests:", error);
      return [];
    }
  }

  // Lấy A/B Test Results
  static async getAbTestResults() {
    try {
      const completedTests = await AbTest.findAll({
        where: {
          status: "completed"
        },
        include: [{
          model: AbTestVariant,
          as: "variants"
        }],
        order: [["completedAt", "DESC"]]
      });
      return completedTests.map(test => ({
        id: test.id,
        type: test.data?.type || "banner",
        projectId: test.projectId,
        status: test.status,
        completedAt: test.completedAt,
        bestVariantId: test.bestVariantId,
        variantCount: test.variants?.length || 0,
        variants: test.variants?.map(variant => ({
          id: variant.id,
          imageUrl: variant.imageUrl,
          postId: variant.postId,
          metrics: variant.metrics || {}
        })) || []
      }));
    } catch (error) {
      console.error("Error fetching A/B test results:", error);
      return [];
    }
  }

  // Lấy Performance analytics and insights
  static async getPerformanceAnalytics() {
    try {
      // Lấy tổng số tests
      const totalTests = await AbTest.count();
      const runningTests = await AbTest.count({
        where: {
          status: "running"
        }
      });
      const completedTests = await AbTest.count({
        where: {
          status: "completed"
        }
      });

      // Lấy metrics tổng hợp
      const completedTestsWithVariants = await AbTest.findAll({
        where: {
          status: "completed"
        },
        include: [{
          model: AbTestVariant,
          as: "variants"
        }]
      });
      let totalEngagement = 0;
      let totalReach = 0;
      let totalLikes = 0;
      let totalComments = 0;
      let totalShares = 0;
      completedTestsWithVariants.forEach(test => {
        test.variants?.forEach(variant => {
          if (variant.metrics) {
            const metrics = typeof variant.metrics === "string" ? JSON.parse(variant.metrics) : variant.metrics;
            totalEngagement += metrics.engagementScore || 0;
            totalReach += metrics.reach || 0;
            totalLikes += metrics.likes || 0;
            totalComments += metrics.comments || 0;
            totalShares += metrics.shares || 0;
          }
        });
      });

      // Tính trung bình
      const variantCount = completedTestsWithVariants.reduce((sum, test) => sum + (test.variants?.length || 0), 0);
      return {
        overview: {
          totalTests,
          runningTests,
          completedTests,
          averageEngagement: variantCount > 0 ? (totalEngagement / variantCount).toFixed(2) : 0,
          averageReach: variantCount > 0 ? (totalReach / variantCount).toFixed(0) : 0
        },
        metrics: {
          totalEngagement: totalEngagement.toFixed(2),
          totalReach: totalReach.toFixed(0),
          totalLikes: totalLikes.toFixed(0),
          totalComments: totalComments.toFixed(0),
          totalShares: totalShares.toFixed(0)
        },
        topPerformers: completedTestsWithVariants.sort((a, b) => {
          const aMax = Math.max(...(a.variants?.map(v => v.metrics?.engagementScore || 0) || [0]));
          const bMax = Math.max(...(b.variants?.map(v => v.metrics?.engagementScore || 0) || [0]));
          return bMax - aMax;
        }).slice(0, 5).map(test => ({
          id: test.id,
          type: test.data?.type || "banner",
          projectId: test.projectId,
          maxEngagement: Math.max(...(test.variants?.map(v => v.metrics?.engagementScore || 0) || [0])),
          completedAt: test.completedAt
        }))
      };
    } catch (error) {
      console.error("Error fetching performance analytics:", error);
      return {
        overview: {
          totalTests: 0,
          runningTests: 0,
          completedTests: 0,
          averageEngagement: 0,
          averageReach: 0
        },
        metrics: {
          totalEngagement: 0,
          totalReach: 0,
          totalLikes: 0,
          totalComments: 0,
          totalShares: 0
        },
        topPerformers: []
      };
    }
  }
}
module.exports = VisualService;