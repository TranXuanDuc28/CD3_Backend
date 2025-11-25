"use strict";

const {
  Token
} = require('../models');
const TokensService = require('../services/tokensService');
class TokensController {
  // GET /api/tokens/active
  async getActiveTokens(req, res) {
    try {
      const tokens = await Token.findAll({
        where: {
          is_active: true,
          [require('sequelize').Op.or]: [{
            expires_at: null
          }, {
            expires_at: {
              [require('sequelize').Op.gt]: new Date()
            }
          }]
        }
      });

      // Format tokens for n8n workflow
      const formattedTokens = {};
      tokens.forEach(token => {
        formattedTokens[token.platform] = {
          // access_token: token.access_token,
          token_type: token.token_type,
          expires_at: token.expires_at,
          scope: token.scope,
          user_id: token.user_id
        };
      });
      res.json(formattedTokens);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  async createToken(req, res) {
    try {
      const tokenData = req.body;
      const token = await TokensService.createToken(tokenData);
      res.json(token);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}
module.exports = new TokensController();