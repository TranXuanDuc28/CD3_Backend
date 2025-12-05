const VisualService = require("../services/visualService");
const FacebookService = require("../services/facebookService");
const EmailService = require("../services/emailService");
const AIVariantService = require("../services/aiVariantService");
const NotificationService = require("../services/notificationService");
const { Visual, AbTest, AbTestVariant } = require("../models");
const TimezoneUtils = require("../utils/timezone");
const dayjs = require("dayjs");
const timezone = require("dayjs/plugin/timezone");
const utc = require("dayjs/plugin/utc");
dayjs.extend(utc);
dayjs.extend(timezone);
const axios = require("axios");
const { Op } = require("sequelize");

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

      let timeToCheck = TimezoneUtils.subtract(
        TimezoneUtils.now(),
        0,
        "minutes"
      ).toDate();
      console.log(
        "Checking A/B tests scheduled at or before Vietnam time:",
        timeToCheck
      );
      const abTests = await AbTest.findAll({
        where: {
          checked: false,
          status: "running",
          scheduledAt: {
            [Op.lte]: timeToCheck,
          },
        },
      });

      if (!abTests || abTests.length === 0) {
        return res.json({ body: {} });
      }

      const result = [];
      console.log("Found A/B tests starting now:", abTests);

      for (const test of abTests) {
        const commonBody = {
          type: test.data.type,
          projectId: test.projectId,
          variantCount: test.data.variantCount,
          scheduledAt: test.scheduledAt
            ? TimezoneUtils.formatVietnamTime(test.scheduledAt)
            : null,
          abTestId: test.id,
          currentVietnamTime: nowVietnam.format("YYYY-MM-DD HH:mm:ss"),
        };

        if (test.data.type === "banner") {
          // Banner trả về thông tin như hiện tại
          result.push({
            body: {
              ...commonBody,
              brand: test.data.brand || null,
              message: test.data.message || null,
              style: test.data.style || null,
              dimensions: test.data.dimensions || null,
            },
            webhookUrl: "http://localhost:5678/webhook-test/create-visual",
            executionMode: "test",
          });
        } else if (
          test.data.type === "carousel" &&
          Array.isArray(test.slides)
        ) {
          // Carousel: trả về slides, mỗi slide thêm abTestId
          const slidesWithId = test.slides.map((slide) => ({
            ...slide,
            abTestId: test.id,
          }));

          result.push({
            body: {
              ...commonBody,
              slides: slidesWithId,
            },
            webhookUrl: "http://localhost:5678/webhook-test/create-visual",
            executionMode: "test",
          });
        }
      }

      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
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
          projectId: data.projectId,
        };

        const abTest = await AbTest.create({
          type: data.type,
          projectId: data.projectId,
          data: jsonData,
          scheduledAt,
          status: "running",
          notifyEmail: data.notifyEmail || null,
          slides: null,
        });

        createdAbTests.push(abTest);

        // Forward payload
        responseData = { ...data, abTestId: abTest.id };
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
          variantCount: data.variantCount || 1,
        };

        const abTest = await AbTest.create({
          projectId: data.projectId,
          data: jsonData,
          scheduledAt,
          status: "running",
          notifyEmail: data.notifyEmail || null,
          slides: data.slides, // lưu nguyên mảng slides
        });
        createdAbTests.push(abTest);

        // Trả về carousel với các slide đã có abTestId
        responseData = {
          ...data,
          abTestId: abTest.id,
        };
      } else {
        return res
          .status(400)
          .json({ error: "Invalid type or slides array required" });
      }

      // Forward **1 lần duy nhất** cho carousel
      const webhookUrl = process.env.N8N_WEBHOOK_URL;
      await axios.post(webhookUrl, responseData, {
        headers: { "Content-Type": "application/json" },
      });

      // Trả về kết quả
      res.json({
        success: true,
        data: responseData,
        abTestIds: createdAbTests.map((a) => a.id),
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  }

  // API gửi mail riêng
  static async sendBestVariantEmail(req, res) {
    try {
      let { to, subject, html } = req.body;
      console.log("sendBestVariantEmail called with:", { to, subject, html });
      if (!to || !subject || !html) {
        return res
          .status(400)
          .json({ error: "Missing to, subject, or html in request body" });
      }
      await EmailService.sendBestVariantEmail(to, subject, html);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
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
  // Generate carousel images
  // Supports three modes:
  // 1. Simple: { prompt, variantCount, dimensions, brand, style }
  // 2. Slides: { slides: [{brand, message, style, dimensions}] }
  // 3. Variants: { variants: [{prompt, dimensions, slideNumber, ...}] } - from AI generation
  // Returns: { success: true, images: [url1, url2, ...] }
  static async generateCarouselImages(req, res) {
    try {
      const { slides, variants } = req.body;

      // Mode 1: Variants array from AI (has prompt field)
      if (Array.isArray(variants) && variants.length > 0) {
        console.log(`Generating carousel with ${variants.length} AI variants:`, variants);

        const allImages = [];

        // Process each variant - variants already have prompt field
        for (const variant of variants) {
          const {
            prompt,
            dimensions = "1200x630",
            message,
          } = variant;

          if (!prompt || !prompt.trim()) {
            console.warn("Skipping variant without prompt:", variant);
            continue;
          }

          // Use the prompt directly (already formatted by AI)
          const variantArray = [{
            prompt: prompt,
          }];

          // Generate image for this variant
          const images = await VisualService.generateBanner(dimensions, variantArray);

          if (images && images.length > 0) {
            allImages.push({
              url: images[0],
              message: message || prompt, // Use message if available, fallback to prompt
            });
          }
        }

        return res.json({
          success: true,
          images: allImages, // Changed from 'images' to 'variantImages'
          count: allImages.length,
          mode: "variants",
        });
      }

      // Mode 2: Slides array (manual input)
      if (Array.isArray(slides) && slides.length > 0) {
        console.log(`Generating carousel with ${slides.length} slides:`, slides);

        const allImages = [];

        // Process each slide
        for (const slide of slides) {
          const {
            brand = "VKU",
            message,
            style = "refreshing",
            dimensions = "1200x630",
          } = slide;

          if (!message || !message.trim()) {
            console.warn("Skipping slide without message:", slide);
            continue;
          }

          // Create variant for this slide
          const variantArray = [{
            prompt: `${brand} brand: ${message}. Style: ${style}, professional carousel slide`,
          }];

          // Generate image for this slide
          const images = await VisualService.generateBanner(dimensions, variantArray);

          if (images && images.length > 0) {
            allImages.push(images[0]);
          }
        }

        return res.json({
          success: true,
          images: allImages,
          count: allImages.length,
          mode: "slides",
        });
      }

      // Mode 3: Simple prompt (generate variants)
      const {
        prompt,
        variantCount = 3,
        dimensions = "1200x630",
        brand = "VKU",
        style = "refreshing",
      } = req.body;

      if (!prompt || !prompt.trim()) {
        return res.status(400).json({
          error: "Either 'variants', 'slides' array or 'prompt' is required"
        });
      }

      console.log("Generating carousel images with:", {
        prompt,
        variantCount,
        dimensions,
        brand,
        style,
      });

      // Create variants array for generateBanner
      const variantArray = [];
      for (let i = 0; i < variantCount; i++) {
        variantArray.push({
          prompt: `${brand} brand: ${prompt}. Style: ${style}, professional carousel slide ${i + 1}`,
        });
      }

      // Generate all images in one call
      const images = await VisualService.generateBanner(dimensions, variantArray);

      res.json({
        success: true,
        images,
        count: images.length,
        mode: "prompt",
      });
    } catch (error) {
      console.error("Error generating carousel images:", error);
      res.status(500).json({ error: error.message });
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
    try {
      let input = req.body;

      // Nếu là object thì chuyển thành array
      if (!Array.isArray(input)) {
        input = [input];
      }

      const first = input[0];
      console.log("Received generate request:", first);

      const size = first.size || "1200x630";

      const variants = first.variants.map(v => ({
        prompt: v.prompt_image,
        index: v.index,
      }));

      const generatedUrls = await VisualService.generateBanner(size, variants);

      const allImages = generatedUrls.map((url, i) => ({
        url,
        message: variants[i].prompt
      }));

      return res.json({
        success: true,
        abTestId: first.abTestId,
        images: allImages
      });

    } catch (error) {
      console.error("Generate Error:", error);
      return res.status(500).json({ error: error.message });
    }
  }



  static async processImage(req, res) {
    try {
      const { imageUrl, type, dimensions } = req.body;
      const processedImageUrl = await VisualService.processImage(
        imageUrl,
        dimensions
      );
      res.json({ success: true, processedImageUrl });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async createVariants(req, res) {
    try {
      const { originalImage, variantCount, type } = req.body;
      const variants = await VisualService.createVariants(
        originalImage,
        variantCount
      );
      res.json({ success: true, variants });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async save(req, res) {
    try {
      const { projectId, originalImage, variants, metadata } = req.body;
      const visual = await Visual.create({
        projectId,
        originalImage,
        variants,
        metadata,
      });
      res.json({ success: true, id: visual.id, data: visual });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async startAbTest(req, res) {
    try {
      const { abTestId, projectId, variants, multiImages, message } = req.body;
      console.log("Starting A/B test with:", req.body);

      if (!projectId) {
        return res.status(400).json({ error: "projectId is required" });
      }

      // Lấy abTest từ DB
      const abTest = await AbTest.findByPk(abTestId);
      if (!abTest) {
        return res.status(404).json({ error: "AbTest not found" });
      }

      const createdVariants = [];

      // Trường hợp đăng nhiều ảnh chung 1 bài
      let multiImageGroups = [];
      if (Array.isArray(multiImages) && multiImages.length > 0) {
        multiImageGroups = Array.isArray(multiImages[0])
          ? multiImages
          : [multiImages];
      }

      // Xử lý multiImages
      if (multiImageGroups.length > 0) {
        const postIds = [];
        for (const imageUrls of multiImageGroups) {
          // imageGroup là mảng 1 chiều các URL
          console.log("imageUrls", imageUrls);
          const postId = await FacebookService.postImagesWithMessage(
            imageUrls,
            ''
          );
          console.log("postId", postId);
          postIds.push(postId);
          const created = await AbTestVariant.create({
            abTestId: abTest.id,
            imageUrl: JSON.stringify(imageUrls.map(i => i.url)), // Lưu list URL
            message: JSON.stringify(imageUrls.map(i => i.message)), // Lưu list caption
            postId,
          });
          createdVariants.push(created);
        }

        // Cập nhật platformPostIds (gộp vào mảng cũ nếu đã có)
        const currentPostIds = abTest.platformPostIds || [];
        await abTest.update({
          scheduledAt: new Date(),
          platformPostIds: [...currentPostIds, ...postIds],
        });
      }
      else if (Array.isArray(variants) && variants.length > 0) {
        // Đăng từng ảnh riêng lẻ (mỗi ảnh 1 bài)
        for (const v of variants) {
          const postId = await FacebookService.postImageWithMessage(
            v.url,
            message
          );
          const createdVariant = await AbTestVariant.create({
            abTestId: abTest.id,
            imageUrl: v.url,
            postId,
          });
          createdVariants.push(createdVariant);
        }

        // Lưu tất cả postId vào abTest
        await abTest.update({
          scheduledAt: new Date(),
          platformPostIds: createdVariants.map((v) => v.postId),
        });
      }
      else {
        return res
          .status(400)
          .json({ error: "variants or multiImages array required" });
      }

      // ⭐ Trigger Notification if Special Occasion
      // if (createdVariants.length > 0 && abTest.isSpecialOccasion) {
      //   // Use the first variant's image/message for notification preview
      //   const previewVariant = createdVariants[0];
      //   let previewImage = previewVariant.imageUrl;
      //   let previewMessage = "Chúng tôi vừa có bài đăng mới! Xem ngay nhé";

      //   // Handle JSON format if it's a multi-image post
      //   try {
      //     if (previewImage.startsWith('[')) {
      //       const images = JSON.parse(previewImage);
      //       previewImage = images[0];
      //     }
      //     if (previewVariant.message && previewVariant.message.startsWith('[')) {
      //       const messages = JSON.parse(previewVariant.message);
      //       previewMessage = messages[0] || previewMessage;
      //     } else if (previewVariant.message) {
      //       previewMessage = previewVariant.message;
      //     }
      //   } catch (e) {
      //     console.warn('Error parsing variant data for notification:', e);
      //   }

      //   // Run in background
      //   NotificationService.notifyRecentCustomers({
      //     postType: 'abtest',
      //     postId: abTest.id,
      //     postUrl: `https://facebook.com/${previewVariant.postId}`, // Approximate URL
      //     message: `🎉 ${abTest.specialOccasionType || 'Sự kiện đặc biệt'}: ${previewMessage}`,
      //     occasionType: abTest.specialOccasionType
      //   }).catch(err => console.error('Notification trigger failed:', err));
      // }

      return res.json({
        success: true,
        abTestId: abTest.id,
        variants: createdVariants,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  }

  static async listToCheck(req, res) {
    try {
      const { checkTime } = req.body; // Nhận thời gian từ FE
      const result = await VisualService.listToCheck(checkTime);
      res.json({ success: true, result });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async checkAbTest(req, res) {
    try {
      console.log("checkAbTest called with body:", req.body);

      // Lấy mảng tests từ body
      let tests = req.body.result || req.body; // nếu body có "result" thì lấy, không thì lấy nguyên

      if (!Array.isArray(tests) || tests.length === 0) {
        return res.json({ notification: "Invalid or empty tests array" });
      }

      const responses = [];

      for (const t of tests) {
        // Lấy tất cả abTest liên quan, chỉ những tests chưa được checked
        const abTests = await AbTest.findAll({
          where: {
            id: t.id,
            checked: false, // Chỉ lấy những tests chưa được checked
            status: "running",
          },
          include: [{ model: AbTestVariant, as: "variants" }],
        });

        if (!abTests || abTests.length === 0) {
          responses.push({ id: t.id, error: "AB test not found" });
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
            await v.update({ metrics });
            console.log("v", v.imageUrl);

            results.push({
              id: v.id,
              imageUrl: v.imageUrl,
              postId: v.postId,
              metrics,
            });

            // So sánh engagementScore để tìm tất cả best
            if (metrics.engagementScore > maxScore) {
              maxScore = metrics.engagementScore;
              bestVariants.length = 0; // reset mảng
              bestVariants.push({
                id: v.id,
                imageUrl: v.imageUrl,
                postId: v.postId,
                metrics,
              });
            } else if (metrics.engagementScore === maxScore) {
              bestVariants.push({
                id: v.id,
                imageUrl: v.imageUrl,
                postId: v.postId,
                metrics,
              });
            }
          }

          // Cập nhật abTest với bestVariantId (nếu muốn lưu 1 ID)
          if (bestVariants.length > 0) {
            await abTest.update({
              status: "completed",
              bestVariantId: bestVariants.map((v) => v.id).join(","),
              completedAt: TimezoneUtils.now().toDate(),
              checked: true,
            });
          }

          testResults.push({
            abTestId: abTest.id,
            type: abTest.data?.type,
            best: bestVariants, // trả về mảng tất cả best
            results,
          });
        }

        responses.push({
          id: t.id,
          testResults,
        });
      }

      res.json({ success: true, results: responses });
    } catch (error) {
      console.error("checkAbTest error:", error);
      res.status(500).json({ error: error.message });
    }
  }

  // API để lấy Active A/B Tests
  static async getActiveAbTests(req, res) {
    try {
      const activeTests = await VisualService.getActiveAbTests();
      res.json({ success: true, data: activeTests });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // API để lấy Currently running tests
  static async getRunningTests(req, res) {
    try {
      const runningTests = await VisualService.getRunningTests();
      res.json({ success: true, data: runningTests });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // API để lấy A/B Test Results
  static async getAbTestResults(req, res) {
    try {
      const results = await VisualService.getAbTestResults();
      res.json({ success: true, data: results });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // API để lấy Performance analytics and insights
  static async getPerformanceAnalytics(req, res) {
    try {
      const analytics = await VisualService.getPerformanceAnalytics();
      res.json({ success: true, data: analytics });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // API tạo variants tự động từ message sử dụng AI
  static async generateAbTestVariants(req, res) {
    try {
      const { message, variantCount = 2, strategies, type, brand, style, dimensions } = req.body;

      console.log("Generating A/B test variants with:", { message, variantCount, strategies });

      if (!message || !message.trim()) {
        return res.status(400).json({ error: "Message is required" });
      }

      // Nếu không có strategies, tự động suggest
      let selectedStrategies = strategies;
      if (!selectedStrategies || selectedStrategies.length === 0) {
        selectedStrategies = await AIVariantService.suggestStrategies(message);
        console.log("Auto-suggested strategies:", selectedStrategies);
      }

      // Generate variants using AI
      const variants = await AIVariantService.generateVariants(
        message,
        variantCount,
        selectedStrategies
      );

      // Enrich variants với thông tin bổ sung
      const enrichedVariants = variants.map((variant, index) => ({
        ...variant,
        variantNumber: index + 1,
        brand: brand || "VKU",
        style: style || "refreshing",
        dimensions: dimensions || "1200x630",
        type: type || "banner",
      }));

      res.json({
        success: true,
        variants: enrichedVariants,
        suggestedStrategies: selectedStrategies,
      });
    } catch (error) {
      console.error("Error generating A/B test variants:", error);
      res.status(500).json({ error: error.message });
    }
  }

  // API tạo carousel variants với AI - tạo variants thực sự khác nhau
  static async generateCarouselAbTestVariants(req, res) {
    try {
      const { slides, variantCount = 2, projectId, abTestId } = req.body;

      console.log("Generating carousel A/B test variants:", {
        slideCount: slides?.length,
        variantCount,
        projectId,
        abTestId
      });

      if (!Array.isArray(slides) || slides.length === 0) {
        return res.status(400).json({ error: "Slides array is required" });
      }

      // Validate slides
      slides.forEach((slide, index) => {
        if (!slide.message || !slide.brand) {
          throw new Error(`Slide ${index + 1} is missing required fields: message or brand`);
        }
      });

      // Generate variants using AI
      const variants = await AIVariantService.generateCarouselVariants(
        slides,
        variantCount
      );

      // Format response for n8n workflow
      const formattedVariants = variants.map(variant => ({
        projectId: projectId || "proj200",
        abTestId: abTestId || null,
        type: "carousel",
        variantNumber: variant.variantNumber,
        style: variant.style,
        variants: variant.slides.map(slide => ({
          slideNumber: slide.slideNumber,
          prompt: slide.prompt,
          message: slide.message,
          brand: slide.brand,
          style: slide.style,
          dimensions: slide.dimensions,
        })),
      }));

      res.json({
        success: true,
        variants: formattedVariants,
        count: formattedVariants.length,
      });
    } catch (error) {
      console.error("Error generating carousel A/B test variants:", error);
      res.status(500).json({ error: error.message });
    }
  }
}


module.exports = VisualController;
