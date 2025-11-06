const express = require("express");
const router = express.Router();
const VisualController = require("../controllers/visualController");

// Example route
router.get("/status", (req, res) => {
  res.json({ status: "API is running" });
});
router.post("/generate-image", VisualController.generate);
router.post("/process-image", VisualController.processImage);
router.post("/create-variants", VisualController.createVariants);
router.post("/save", VisualController.save);
router.post("/ab-test/start", VisualController.startAbTest);
router.post("/generate-carousel", VisualController.generateCarouselImages);
router.post("/ab-test/check", VisualController.checkAbTest);
router.post("/list-to-check-testing", VisualController.listToCheck);

// API gửi mail riêng
router.post("/send-best-variant-email", VisualController.sendBestVariantEmail);
// API kiểm tra scheduledAt trùng giờ hiện tại
router.get("/abtest/by-current-time", VisualController.getAbTestByCurrentTime);

// API forward dữ liệu tới webhook
router.post("/forward-to-webhook", VisualController.forwardToWebhook);

// API lấy dữ liệu động cho dashboard
router.get("/ab-test/active", VisualController.getActiveAbTests);
router.get("/ab-test/running", VisualController.getRunningTests);
router.get("/ab-test/results", VisualController.getAbTestResults);
router.get("/ab-test/analytics", VisualController.getPerformanceAnalytics);

module.exports = router;
