const { Token } = require('../models');
const { Op } = require('sequelize');

class TokensService {
  async getActiveTokens() {
    try {
      const tokens = await Token.findAll({
        where: {
          is_active: true,
          [Op.or]: [
            { expires_at: null },
            { expires_at: { [Op.gt]: new Date() } }
          ]
        },
        order: [['platform', 'ASC']]
      });

      return tokens;
    } catch (error) {
      throw new Error(`Error fetching active tokens: ${error.message}`);
    }
  }

  async getAllTokens(options = {}) {
    try {
      const { platform, is_active } = options;
      
      const whereClause = {};
      if (platform) whereClause.platform = platform;
      if (is_active !== undefined) whereClause.is_active = is_active;

      const tokens = await Token.findAll({
        where: whereClause,
        order: [['created_at', 'DESC']]
      });

      return tokens;
    } catch (error) {
      throw new Error(`Error fetching tokens: ${error.message}`);
    }
  }

  async createToken(tokenData) {
    try {
      // Check if token already exists for this platform
      const existingToken = await Token.findOne({
        where: {
          platform: tokenData.platform,
          user_id: tokenData.user_id
        }
      });

      if (existingToken) {
        // Update existing token
        return await this.updateToken(existingToken.id, tokenData);
      }

      const token = await Token.create({
        ...tokenData,
        created_at: new Date(),
        updated_at: new Date()
      });

      return token;
    } catch (error) {
      throw new Error(`Error creating token: ${error.message}`);
    }
  }

  async updateToken(tokenId, updateData) {
    try {
      const [updatedRowsCount] = await Token.update(
        {
          ...updateData,
          updated_at: new Date()
        },
        {
          where: { id: tokenId }
        }
      );

      if (updatedRowsCount === 0) {
        return null;
      }

      return await Token.findByPk(tokenId);
    } catch (error) {
      throw new Error(`Error updating token: ${error.message}`);
    }
  }

  async deleteToken(tokenId) {
    try {
      const deletedRowsCount = await Token.destroy({
        where: { id: tokenId }
      });

      return deletedRowsCount > 0;
    } catch (error) {
      throw new Error(`Error deleting token: ${error.message}`);
    }
  }

  async refreshToken(platform, refreshToken) {
    try {
      // This would typically involve calling the platform's API to refresh the token
      // For now, we'll just return a mock response
      
      const token = await Token.findOne({
        where: {
          platform,
          refresh_token: refreshToken
        }
      });

      if (!token) {
        throw new Error('Token not found');
      }

      // In a real implementation, you would call the platform's refresh API here
      // For example:
      // const refreshedData = await this.callPlatformRefreshAPI(platform, refreshToken);
      
      // Mock refresh response
      const refreshedData = {
        access_token: 'new_access_token_' + Date.now(),
        expires_at: new Date(Date.now() + 3600 * 1000), // 1 hour from now
        token_type: 'Bearer'
      };

      const updatedToken = await this.updateToken(token.id, refreshedData);

      return updatedToken;
    } catch (error) {
      throw new Error(`Error refreshing token: ${error.message}`);
    }
  }

  async getTokenByPlatform(platform) {
    try {
      const token = await Token.findOne({
        where: {
          platform,
          is_active: true,
          [Op.or]: [
            { expires_at: null },
            { expires_at: { [Op.gt]: new Date() } }
          ]
        }
      });

      return token;
    } catch (error) {
      throw new Error(`Error fetching token by platform: ${error.message}`);
    }
  }

  async deactivateToken(tokenId) {
    try {
      const [updatedRowsCount] = await Token.update(
        {
          is_active: false,
          updated_at: new Date()
        },
        {
          where: { id: tokenId }
        }
      );

      return updatedRowsCount > 0;
    } catch (error) {
      throw new Error(`Error deactivating token: ${error.message}`);
    }
  }

  async checkTokenExpiry() {
    try {
      const expiredTokens = await Token.findAll({
        where: {
          is_active: true,
          expires_at: { [Op.lt]: new Date() }
        }
      });

      // Deactivate expired tokens
      for (const token of expiredTokens) {
        await this.deactivateToken(token.id);
      }

      return expiredTokens.length;
    } catch (error) {
      throw new Error(`Error checking token expiry: ${error.message}`);
    }
  }
}

module.exports = new TokensService();