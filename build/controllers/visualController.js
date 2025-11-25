"use strict";

const VisualService = require("../services/visualService");
const FacebookService = require("../services/facebookService");
const EmailService = require("../services/emailService");
const {
  Visual,
  AbTest,
  AbTestVariant
} = require("../models");
const TimezoneUtils = require("../utils/timezone");
const dayjs = require("dayjs");
const timezone = require("dayjs/plugin/timezone");
const utc = require("dayjs/plugin/utc");
dayjs.extend(utc);
dayjs.extend(timezone);
const axios = require("axios");
const {
  Op
} = require("sequelize");
class VisualController {
  // API kiểm tra scheduledAt trùng giờ hiện tại
  static async getAbTestByCurrentTime(req, res) {
    try {
      const nowVietnam = TimezoneUtils.now();
      // console.log("[Op.lte]: nowVietnam.utc().toDate()", nowVietnam.toDate());

      // const startTime = TimezoneUtils.now().subtract(1, 'minute').startOf('minute');
      // const endTime   = TimezoneUtils.now().add(1, 'minute').endOf('minute');

      // const startOfMinute = startTime.utc().toDate();
      // const endOfMinute   = endTime.utc().toDate();

      // console.log('Current Vietnam time:', nowVietnam.format('YYYY-MM-DD HH:mm:ss'));
      // console.log('Checking A/B tests scheduled between:', startOfMinute, 'and', endOfMinute);

      let timeToCheck = TimezoneUtils.subtract(TimezoneUtils.now(), 0, "minutes").toDate();
      console.log("Checking A/B tests scheduled at or before Vietnam time:", timeToCheck);
      const abTests = await AbTest.findAll({
        where: {
          checked: false,
          status: "running",
          scheduledAt: {
            [Op.lte]: timeToCheck
          }
        }
      });
      if (!abTests || abTests.length === 0) {
        return res.json({
          body: {}
        });
      }
      const result = [];
      console.log("Found A/B tests starting now:", abTests);
      for (const test of abTests) {
        const commonBody = {
          type: test.data.type,
          projectId: test.projectId,
          variantCount: test.data.variantCount,
          scheduledAt: test.scheduledAt ? TimezoneUtils.formatVietnamTime(test.scheduledAt) : null,
          abTestId: test.id,
          currentVietnamTime: nowVietnam.format("YYYY-MM-DD HH:mm:ss")
        };
        if (test.data.type === "banner") {
          // Banner trả về thông tin như hiện tại
          result.push({
            body: {
              ...commonBody,
              brand: test.data.brand || null,
              message: test.data.message || null,
              style: test.data.style || null,
              dimensions: test.data.dimensions || null
            },
            webhookUrl: "http://localhost:5678/webhook-test/create-visual",
            executionMode: "test"
          });
        } else if (test.data.type === "carousel" && Array.isArray(test.slides)) {
          // Carousel: trả về slides, mỗi slide thêm abTestId
          const slidesWithId = test.slides.map(slide => ({
            ...slide,
            abTestId: test.id
          }));
          result.push({
            body: {
              ...commonBody,
              slides: slidesWithId
            },
            webhookUrl: "http://localhost:5678/webhook-test/create-visual",
            executionMode: "test"
          });
        }
      }
      res.json(result);
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }

  // API forward dữ liệu tới webhook
  static async forwardToWebhook(req, res) {
    try {
      const data = req.body;

      // Convert scheduledAt sang Date object đúng giờ VN

      let scheduledAt = null;
      if (data.scheduledAt) {
        scheduledAt = new Date(data.scheduledAt);
        console.log("Converted scheduledAt to Vietnam time:", scheduledAt);
      } else {
        console.log("scheduledAt is null, will store null in DB");
      }
      const createdAbTests = []; // lưu tất cả bản ghi mới
      let responseData;
      if (data.type === "banner") {
        // Banner: lưu 1 record
        const jsonData = {
          type: data.type,
          variantCount: data.variantCount || 1,
          message: data.message || null,
          brand: data.brand || null,
          style: data.style || null,
          dimensions: data.dimensions || null,
          projectId: data.projectId
        };
        const abTest = await AbTest.create({
          type: data.type,
          projectId: data.projectId,
          data: jsonData,
          scheduledAt,
          status: "running",
          notifyEmail: data.notifyEmail || null,
          slides: null
        });
        createdAbTests.push(abTest);

        // Forward payload
        responseData = {
          ...data,
          abTestId: abTest.id
        };
      } else if (data.type === "carousel" && Array.isArray(data.slides)) {
        // Carousel: lưu mỗi slide 1 record
        const slidesWithIds = [];

        // for (const slide of data.slides) {

        //   slidesWithIds.push({
        //     ...slide,
        //     abTestId: abTest.id
        //   });
        // }
        const jsonData = {
          type: data.type,
          variantCount: data.variantCount || 1
        };
        const abTest = await AbTest.create({
          projectId: data.projectId,
          data: jsonData,
          scheduledAt,
          status: "running",
          notifyEmail: data.notifyEmail || null,
          slides: data.slides // lưu nguyên mảng slides
        });
        createdAbTests.push(abTest);

        // Trả về carousel với các slide đã có abTestId
        responseData = {
          ...data,
          abTestId: abTest.id
        };
      } else {
        return res.status(400).json({
          error: "Invalid type or slides array required"
        });
      }

      // Forward **1 lần duy nhất** cho carousel
      const webhookUrl = "https://n8n.nhom8.id.vn/webhook-test/8bf7bb62-0884-405f-87d8-533b7de85b28";
      await axios.post(webhookUrl, responseData, {
        headers: {
          "Content-Type": "application/json"
        }
      });

      // Trả về kết quả
      res.json({
        success: true,
        data: responseData,
        abTestIds: createdAbTests.map(a => a.id)
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        error: error.message
      });
    }
  }

  // API gửi mail riêng
  static async sendBestVariantEmail(req, res) {
    try {
      let {
        to,
        subject,
        html
      } = req.body;
      console.log("sendBestVariantEmail called with:", {
        to,
        subject,
        html
      });
      if (!to || !subject || !html) {
        return res.status(400).json({
          error: "Missing to, subject, or html in request body"
        });
      }
      await EmailService.sendBestVariantEmail(to, subject, html);
      res.json({
        success: true
      });
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }
  // Giai đoạn 1: Sinh ảnh cho từng slide bằng Gemini
  // static async generateCarouselImagesGemini(req, res) {
  //   try {
  //     let carousels = req.body;
  //     if (!Array.isArray(carousels)) {
  //       carousels = [carousels];
  //     }
  //     console.log('Received generateCarouselImagesGemini request:', carousels);
  //     const allImages = [];
  //     for (const carousel of carousels) {
  //       const { variants } = carousel;
  //       const images = [];
  //       for (const slide of variants) {
  //         const generated = await VisualService.generateBannerGemini(slide.prompt, slide.dimensions, 1);
  //         images.push({ slideNumber: slide.slideNumber, image: generated[0] });
  //       }
  //       allImages.push(images);
  //     }
  //     res.json({ success: true, allImages });
  //   } catch (error) {
  //     res.status(500).json({ error: error.message });
  //   }
  // }
  // Giai đoạn 1: Sinh ảnh cho từng slide
  static async generateCarouselImages(req, res) {
    try {
      let carousels = req.body; // dùng let thay vì const

      // Nếu người dùng gửi object đơn lẻ, bọc thành mảng
      if (!Array.isArray(carousels)) {
        carousels = [carousels];
      }
      console.log("Received generateCarouselImages request:", carousels);
      const allImages = [];
      for (const carousel of carousels) {
        const {
          variants
        } = carousel;
        const images = [];
        for (const slide of variants) {
          const generated = await VisualService.generateBanner(slide.prompt, slide.dimensions, 1);
          images.push({
            slideNumber: slide.slideNumber,
            image: generated[0]
          });
        }
        allImages.push(images);
      }
      res.json({
        success: true,
        allImages
      });
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }

  // // Giai đoạn 2: Đăng ảnh lên Facebook
  // static async postCarouselImages(req, res) {
  //   try {
  //     const { images, message } = req.body; // images: mảng url, message: caption
  //     const postId = await FacebookService.postImagesWithMessage(images, message);
  //     res.json({ success: true, postId });
  //   } catch (error) {
  //     res.status(500).json({ error: error.message });
  //   }
  // }

  // // Giai đoạn 3: Lưu thông tin vào DB
  // static async saveCarouselVariants(req, res) {
  //   try {
  //     const { projectId, images, postId, variants, variantNumber } = req.body;
  //     const abTest = await AbTest.create({ projectId, status: 'running' });
  //     const createdVariants = [];
  //     for (let i = 0; i < images.length; i++) {
  //       const v = await AbTestVariant.create({
  //         abTestId: abTest.id,
  //         imageUrl: images[i],
  //         postId,
  //         slideNumber: variants[i].slideNumber,
  //         variantNumber
  //       });
  //       createdVariants.push(v);
  //     }
  //     await abTest.update({ platformPostIds: [postId] });
  //     res.json({ success: true, abTestId: abTest.id, postId, createdVariants });
  //   } catch (error) {
  //     res.status(500).json({ error: error.message });
  //   }
  // }
  // static async startCarouselAbTest(req, res) {
  //   try {
  //     const carousels = req.body; // đầu vào là mảng carousel
  //     const results = [];
  //     for (const carousel of carousels) {
  //       const { projectId, variants, variantNumber } = carousel;
  //       const images = [];
  //       for (const slide of variants) {
  //         // Sinh ảnh cho từng slide
  //         const generated = await VisualService.generateBanner(slide.prompt, slide.dimensions, 1);
  //         images.push(generated[0]);
  //       }
  //       // Đăng 1 bài với nhiều ảnh
  //       const message = variants[0].message; // hoặc tuỳ chọn
  //       const abTest = await AbTest.create({ projectId, status: 'running' });
  //       const postId = await FacebookService.postImagesWithMessage(images, message);
  //       const createdVariants = [];
  //       for (let i = 0; i < images.length; i++) {
  //         const v = await AbTestVariant.create({
  //           abTestId: abTest.id,
  //           imageUrl: images[i],
  //           postId,
  //           slideNumber: variants[i].slideNumber,
  //           variantNumber
  //         });
  //         createdVariants.push(v);
  //       }
  //       await abTest.update({ platformPostIds: [postId] });
  //       results.push({ abTestId: abTest.id, postId, images, createdVariants });
  //     }
  //     res.json({ success: true, results });
  //   } catch (error) {
  //     res.status(500).json({ error: error.message });
  //   }
  // }
  static async generate(req, res) {
    console.log("generate called with body:", req.body);
    try {
      let {
        prompt,
        size,
        variants
      } = req.body;
      console.log("Received generate request:", {
        prompt,
        size,
        variants
      });
      const images = await VisualService.generateBanner(prompt, size, variants);
      res.json({
        success: true,
        images
      });
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }
  static async processImage(req, res) {
    try {
      const {
        imageUrl,
        type,
        dimensions
      } = req.body;
      const processedImageUrl = await VisualService.processImage(imageUrl, dimensions);
      res.json({
        success: true,
        processedImageUrl
      });
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }
  static async createVariants(req, res) {
    try {
      const {
        originalImage,
        variantCount,
        type
      } = req.body;
      const variants = await VisualService.createVariants(originalImage, variantCount);
      res.json({
        success: true,
        variants
      });
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }
  static async save(req, res) {
    try {
      const {
        projectId,
        originalImage,
        variants,
        metadata
      } = req.body;
      const visual = await Visual.create({
        projectId,
        originalImage,
        variants,
        metadata
      });
      res.json({
        success: true,
        id: visual.id,
        data: visual
      });
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }
  static async startAbTest(req, res) {
    try {
      const {
        abTestId,
        projectId,
        variants,
        multiImages,
        message
      } = req.body;
      console.log("Starting A/B test with:", req.body);
      if (!projectId) {
        return res.status(400).json({
          error: "projectId is required"
        });
      }

      // Lấy abTest từ DB
      const abTest = await AbTest.findByPk(abTestId);
      if (!abTest) {
        return res.status(404).json({
          error: "AbTest not found"
        });
      }
      const createdVariants = [];

      // Trường hợp đăng nhiều ảnh chung 1 bài
      let multiImageGroups = [];
      if (Array.isArray(multiImages) && multiImages.length > 0) {
        multiImageGroups = Array.isArray(multiImages[0]) ? multiImages : [multiImages];
      }

      // Xử lý multiImages
      if (multiImageGroups.length > 0) {
        for (const imageGroup of multiImageGroups) {
          // imageGroup là mảng 1 chiều các URL
          const postId = await FacebookService.postImagesWithMessage(imageGroup, message);
          for (const imageUrl of imageGroup) {
            const v = await AbTestVariant.create({
              abTestId: abTest.id,
              imageUrl,
              postId
            });
            createdVariants.push(v);
          }

          // Cập nhật platformPostIds (gộp vào mảng cũ nếu đã có)
          const currentPostIds = abTest.platformPostIds || [];
          await abTest.update({
            scheduledAt: new Date(),
            platformPostIds: [...currentPostIds, postId]
          });
        }
      } else if (Array.isArray(variants) && variants.length > 0) {
        // Đăng từng ảnh riêng lẻ (mỗi ảnh 1 bài)
        for (const imageUrl of variants) {
          const postId = await FacebookService.postImageWithMessage(imageUrl, message);
          const v = await AbTestVariant.create({
            abTestId: abTest.id,
            imageUrl,
            postId
          });
          createdVariants.push(v);
        }

        // Lưu tất cả postId vào abTest
        await abTest.update({
          scheduledAt: new Date(),
          checked: true,
          platformPostIds: createdVariants.map(v => v.postId)
        });
      } else {
        return res.status(400).json({
          error: "variants or multiImages array required"
        });
      }
      res.json({
        success: true,
        abTestId: abTest.id,
        variants: createdVariants,
        message
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        error: error.message
      });
    }
  }
  static async listToCheck(req, res) {
    try {
      const {
        checkTime
      } = req.body; // Nhận thời gian từ FE
      const result = await VisualService.listToCheck(checkTime);
      res.json({
        success: true,
        result
      });
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }
  static async checkAbTest(req, res) {
    try {
      console.log("checkAbTest called with body:", req.body);

      // Lấy mảng tests từ body
      let tests = req.body.result || req.body; // nếu body có "result" thì lấy, không thì lấy nguyên

      if (!Array.isArray(tests) || tests.length === 0) {
        return res.json({
          notification: "Invalid or empty tests array"
        });
      }
      const responses = [];
      for (const t of tests) {
        // Lấy tất cả abTest liên quan, chỉ những tests chưa được checked
        const abTests = await AbTest.findAll({
          where: {
            id: t.id,
            checked: true,
            // Chỉ lấy những tests chưa được checked
            status: "running"
          },
          include: [{
            model: AbTestVariant,
            as: "variants"
          }]
        });
        if (!abTests || abTests.length === 0) {
          responses.push({
            id: t.id,
            error: "AB test not found"
          });
          continue;
        }
        const testResults = [];
        for (const abTest of abTests) {
          const results = [];
          const bestVariants = [];
          let maxScore = -Infinity;
          for (const v of abTest.variants) {
            if (!v.postId) continue;

            // Lấy metrics từ Facebook
            const metrics = await FacebookService.getEngagement(v.postId);
            await v.update({
              metrics
            });
            results.push({
              id: v.id,
              imageUrl: v.imageUrl,
              postId: v.postId,
              metrics
            });

            // So sánh engagementScore để tìm tất cả best
            if (metrics.engagementScore > maxScore) {
              maxScore = metrics.engagementScore;
              bestVariants.length = 0; // reset mảng
              bestVariants.push({
                id: v.id,
                imageUrl: v.imageUrl,
                postId: v.postId,
                metrics
              });
            } else if (metrics.engagementScore === maxScore) {
              bestVariants.push({
                id: v.id,
                imageUrl: v.imageUrl,
                postId: v.postId,
                metrics
              });
            }
          }

          // Cập nhật abTest với bestVariantId (nếu muốn lưu 1 ID)
          if (bestVariants.length > 0) {
            await abTest.update({
              status: "completed",
              bestVariantId: bestVariants.map(v => v.id).join(","),
              completedAt: TimezoneUtils.now().toDate(),
              checked: true
            });
          }
          testResults.push({
            abTestId: abTest.id,
            type: abTest.data?.type,
            best: bestVariants,
            // trả về mảng tất cả best
            results
          });
        }
        responses.push({
          id: t.id,
          testResults
        });
      }
      res.json({
        success: true,
        results: responses
      });
    } catch (error) {
      console.error("checkAbTest error:", error);
      res.status(500).json({
        error: error.message
      });
    }
  }

  // API để lấy Active A/B Tests
  static async getActiveAbTests(req, res) {
    try {
      const activeTests = await VisualService.getActiveAbTests();
      res.json({
        success: true,
        data: activeTests
      });
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }

  // API để lấy Currently running tests
  static async getRunningTests(req, res) {
    try {
      const runningTests = await VisualService.getRunningTests();
      res.json({
        success: true,
        data: runningTests
      });
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }

  // API để lấy A/B Test Results
  static async getAbTestResults(req, res) {
    try {
      const results = await VisualService.getAbTestResults();
      res.json({
        success: true,
        data: results
      });
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }

  // API để lấy Performance analytics and insights
  static async getPerformanceAnalytics(req, res) {
    try {
      const analytics = await VisualService.getPerformanceAnalytics();
      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }
}
module.exports = VisualController;