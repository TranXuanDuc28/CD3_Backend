"use strict";

const {
  Engagement,
  PlatformPost
} = require('../models');
const MS = 1000;
const SocialService = require('../services/socialService');
const EngagementService = require('../services/engagementService');
class EngagementController {
  async updateEngagementFromData(data) {
    const {
      platform_post_id,
      platform,
      engagement = {} // tránh lỗi nếu engagement không có
    } = data;
    if (!platform_post_id || !platform) {
      console.warn("⚠️ Thiếu platform_post_id hoặc platform:", data);
      return null;
    }
    const engagementData = {
      platform_post_id,
      platform,
      likes: engagement.likes || 0,
      comments: engagement.comments || 0,
      shares: engagement.shares || 0,
      views: engagement.views || 0,
      clicks: engagement.clicks || 0,
      engagement_score: engagement.engagementScore || 0,
      reach: engagement.reach || 0,
      impressions: engagement.impressions || 0,
      engagement_rate: engagement.engagementRate || 0,
      last_checked_at: new Date(),
      metadata: engagement.metadata || null
    };
    let engagementRecord = await Engagement.findOne({
      where: {
        platform_post_id,
        platform
      }
    });
    if (engagementRecord) {
      await engagementRecord.update(engagementData);
    } else {
      engagementRecord = await Engagement.create(engagementData);
    }
    return engagementRecord;
  }
  async processPlatformPost(pp) {
    try {
      console.log(`Processing engagement for ${pp.platform} ${pp.platform_post_id}...`);
      // Fetch analytics from social service
      const analytics = await SocialService.getPostAnalytics(pp.platform, pp.platform_post_id || pp.platform_post_id);
      console.log(`Fetched analytics for ${pp.platform} ${pp.platform_post_id}:`, analytics);
      if (!analytics) {
        console.warn(`No analytics data for ${pp.platform} ${pp.platform_post_id}`);
        return null;
      }
      // Build payload compatible with EngagementService.updateEngagementFromData
      const payload = {
        post_id: pp.post_id,
        platform_post_id: pp.platform_post_id,
        platform: pp.platform,
        engagement: {
          likes: analytics.likes || 0,
          comments: analytics.comments || 0,
          shares: analytics.shares || 0,
          views: analytics.views || 0,
          clicks: analytics.clicks || 0,
          engagementScore: analytics.engagement_score || 0,
          reach: analytics.reach || 0,
          impressions: analytics.impressions || 0,
          engagementRate: 0,
          metadata: analytics
        }
      };
      const result = await EngagementService.updateEngagementFromData(payload);

      // Đánh dấu PlatformPost đã được checked
      await PlatformPost.update({
        checked: true
      }, {
        where: {
          platform_post_id: pp.platform_post_id,
          platform: pp.platform
        }
      });
      console.log(`Engagement updated and marked as checked for ${pp.platform} ${pp.platform_post_id}`);
      return result;
    } catch (err) {
      console.warn(`Failed to fetch/process engagement for ${pp.platform_post_id}:`, err.message);
      return null;
    }
  }
  getEngagement = async (req, res) => {
    try {
      const postData = req.body;
      if (!postData.platformPosts || !Array.isArray(postData.platformPosts)) {
        return res.status(400).json({
          error: "Invalid request body"
        });
      }
      const results = []; // 👉 danh sách kết quả trả về

      for (const pp of postData.platformPosts) {
        if (!pp.platform_post_id) continue;

        // Kiểm tra xem PlatformPost đã được checked chưa
        const platformPost = await PlatformPost.findOne({
          where: {
            platform_post_id: pp.platform_post_id,
            platform: pp.platform
          }
        });
        if (platformPost && platformPost.checked) {
          console.log(`⏩ Skipped ${pp.platform} ${pp.platform_post_id} (already checked)`);
          continue;
        }

        // Kiểm tra lần cập nhật cuối cùng (fallback check)
        // const lastEng = await Engagement.findOne({
        //   where: { platform_post_id: pp.platform_post_id },
        //   order: [['last_checked_at', 'DESC']]
        // });

        // if (
        //   lastEng &&
        //   lastEng.last_checked_at &&
        //   new Date(lastEng.last_checked_at) > new Date(pp.published_at)
        // ) {
        //   console.log(`⏩ Skipped ${pp.platform} ${pp.platform_post_id} (already up-to-date)`);
        //   continue;
        // }

        // Xử lý bài post
        const result = await this.processPlatformPost(pp);
        if (result) results.push(result);
      }

      // 👉 Trả kết quả thật về node tiếp theo
      res.json({
        message: "✅ Engagement data processed successfully",
        count: results.length,
        data: results
      });
    } catch (err) {
      console.error("❌ Engagement fetcher error:", err);
      res.status(500).json({
        error: err.message
      });
    }
  };
}
module.exports = new EngagementController();