"use strict";

const {
  Engagement,
  PlatformPost
} = require('../models');
const {
  Op
} = require('sequelize');
class EngagementService {
  async processEngagementData(engagementData) {
    try {
      // This method processes engagement data from n8n workflow
      const processedData = [];
      if (Array.isArray(engagementData)) {
        for (const item of engagementData) {
          const processed = await this.updateEngagementFromData(item);
          processedData.push(processed);
        }
      } else {
        const processed = await this.updateEngagementFromData(engagementData);
        processedData.push(processed);
      }
      return {
        success: true,
        processed_count: processedData.length,
        data: processedData
      };
    } catch (error) {
      throw new Error(`Error processing engagement data: ${error.message}`);
    }
  }
  async updateEngagementFromData(data) {
    try {
      const {
        post_id,
        platform_post_id,
        platform,
        engagement
      } = data;
      if (!post_id || !platform_post_id || !platform || !engagement) {
        throw new Error('platform_post_id, platform, and engagement are required');
      }

      // Find or create engagement record
      let engagementRecord = await Engagement.findOne({
        where: {
          platform_post_id: platform_post_id,
          platform: platform
        }
      });
      const engagementData = {
        post_id: post_id,
        platform: platform,
        platform_post_id: platform_post_id,
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
      if (engagementRecord) {
        await engagementRecord.update(engagementData);
      } else {
        engagementRecord = await Engagement.create(engagementData);
      }
      return engagementRecord;
    } catch (error) {
      throw new Error(`Error updating engagement: ${error.message}`);
    }
  }
  async getEngagementByPost(platformPostId) {
    try {
      const engagement = await Engagement.findAll({
        where: {
          platform_post_id: platformPostId
        },
        include: [{
          model: PlatformPost,
          as: 'platformPost'
        }],
        order: [['last_checked_at', 'DESC']]
      });
      return engagement;
    } catch (error) {
      throw new Error(`Error fetching engagement by post: ${error.message}`);
    }
  }
  async getEngagementByPlatform(platform, options = {}) {
    try {
      const {
        startDate,
        endDate,
        limit = 50
      } = options;
      const whereClause = {
        platform
      };
      if (startDate && endDate) {
        whereClause.last_checked_at = {
          [Op.between]: [new Date(startDate), new Date(endDate)]
        };
      }
      const engagements = await Engagement.findAll({
        where: whereClause,
        include: [{
          model: PlatformPost,
          as: 'platformPost'
        }],
        limit: parseInt(limit),
        order: [['last_checked_at', 'DESC']]
      });
      return engagements;
    } catch (error) {
      throw new Error(`Error fetching engagement by platform: ${error.message}`);
    }
  }
  async updateEngagement(platformPostId, engagementData) {
    try {
      const {
        platformPostId: id,
        engagementData: data
      } = engagementData;
      const engagement = await Engagement.findOne({
        where: {
          platform_post_id: id
        }
      });
      if (!engagement) {
        throw new Error('Engagement record not found');
      }
      const updatedData = {
        ...data,
        last_checked_at: new Date(),
        updated_at: new Date()
      };
      await engagement.update(updatedData);
      return engagement;
    } catch (error) {
      throw new Error(`Error updating engagement: ${error.message}`);
    }
  }
  async getEngagementSummary(options = {}) {
    try {
      const {
        platform,
        startDate,
        endDate
      } = options;
      const whereClause = {};
      if (platform) whereClause.platform = platform;
      if (startDate && endDate) {
        whereClause.last_checked_at = {
          [Op.between]: [new Date(startDate), new Date(endDate)]
        };
      }
      const summary = await Engagement.findAll({
        where: whereClause,
        attributes: ['platform', [Engagement.sequelize.fn('COUNT', Engagement.sequelize.col('id')), 'total_posts'], [Engagement.sequelize.fn('SUM', Engagement.sequelize.col('likes')), 'total_likes'], [Engagement.sequelize.fn('SUM', Engagement.sequelize.col('comments')), 'total_comments'], [Engagement.sequelize.fn('SUM', Engagement.sequelize.col('shares')), 'total_shares'], [Engagement.sequelize.fn('SUM', Engagement.sequelize.col('views')), 'total_views'], [Engagement.sequelize.fn('AVG', Engagement.sequelize.col('engagement_score')), 'avg_engagement_score'], [Engagement.sequelize.fn('AVG', Engagement.sequelize.col('engagement_rate')), 'avg_engagement_rate']],
        group: ['platform'],
        raw: true
      });
      return summary;
    } catch (error) {
      throw new Error(`Error getting engagement summary: ${error.message}`);
    }
  }
  async bulkUpdateEngagement(engagements) {
    try {
      const results = [];
      for (const engagement of engagements) {
        try {
          const result = await this.updateEngagementFromData(engagement);
          results.push({
            success: true,
            data: result
          });
        } catch (error) {
          results.push({
            success: false,
            error: error.message,
            data: engagement
          });
        }
      }
      return {
        total_processed: engagements.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results: results
      };
    } catch (error) {
      throw new Error(`Error bulk updating engagement: ${error.message}`);
    }
  }
  async calculateEngagementScore(likes, comments, shares, views) {
    try {
      // Simple engagement score calculation
      // This can be customized based on business requirements
      const score = likes * 1 + comments * 3 + shares * 5 + views * 0.1;
      return Math.round(score);
    } catch (error) {
      throw new Error(`Error calculating engagement score: ${error.message}`);
    }
  }
  async getLowEngagementPosts(threshold = 5) {
    try {
      const lowEngagementPosts = await Engagement.findAll({
        where: {
          engagement_score: {
            [Op.lt]: threshold
          }
        },
        include: [{
          model: PlatformPost,
          as: 'platformPost',
          include: [{
            model: require('../models').Post,
            as: 'post'
          }]
        }],
        order: [['engagement_score', 'ASC']]
      });
      return lowEngagementPosts;
    } catch (error) {
      throw new Error(`Error fetching low engagement posts: ${error.message}`);
    }
  }
  async getTopPerformingPosts(limit = 10) {
    try {
      const topPosts = await Engagement.findAll({
        include: [{
          model: PlatformPost,
          as: 'platformPost',
          include: [{
            model: require('../models').Post,
            as: 'post'
          }]
        }],
        order: [['engagement_score', 'DESC']],
        limit: limit
      });
      return topPosts;
    } catch (error) {
      throw new Error(`Error fetching top performing posts: ${error.message}`);
    }
  }
}
module.exports = new EngagementService();