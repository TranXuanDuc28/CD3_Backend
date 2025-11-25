"use strict";

const SentimentAnalysisService = require('../services/SentimentAnalysisService');
const Logger = require('../utils/logger');
class AnalyticsController {
  // GET /api/analytics/summary?days=7
  static async getSummary(req, res) {
    try {
      const days = parseInt(req.query.days) || 7;
      const result = await SentimentAnalysisService.getAnalyticsSummary(days);
      res.json(result);
    } catch (error) {
      Logger.error('AnalyticsSummary error', {
        error: error.message
      });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // GET /api/analytics/sentiment-trend?days=30
  static async getSentimentTrend(req, res) {
    try {
      const days = parseInt(req.query.days) || 30;
      const result = await SentimentAnalysisService.getSentimentTrend(days);
      res.json(result);
    } catch (error) {
      Logger.error('SentimentTrend error', {
        error: error.message
      });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // GET /api/analytics/keywords?sentiment=positive&limit=20
  static async getTopKeywords(req, res) {
    try {
      const sentiment = req.query.sentiment || null;
      const limit = parseInt(req.query.limit) || 20;
      const result = await SentimentAnalysisService.getTopKeywords(sentiment, limit);
      res.json(result);
    } catch (error) {
      Logger.error('TopKeywords error', {
        error: error.message
      });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // GET /api/analytics/dashboard
  static async getDashboard(req, res) {
    try {
      const days = parseInt(req.query.days) || 7;

      // Get all analytics in parallel
      const [summary, trend, keywords] = await Promise.all([SentimentAnalysisService.getAnalyticsSummary(days), SentimentAnalysisService.getSentimentTrend(days), SentimentAnalysisService.getTopKeywords(null, 10)]);
      res.json({
        success: true,
        data: {
          summary: summary.data,
          trend: trend.data,
          topKeywords: keywords.data
        },
        period: `${days} days`
      });
    } catch (error) {
      Logger.error('Dashboard error', {
        error: error.message
      });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}
module.exports = AnalyticsController;