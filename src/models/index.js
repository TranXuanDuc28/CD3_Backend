const { Sequelize } = require('sequelize');
require('dotenv').config();

// Create Sequelize instance using environment variables (MySQL)
const sequelize = new Sequelize(process.env.DB_NAME , process.env.DB_USER , process.env.DB_PASSWORD, {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306,
  dialect: 'mysql',
  timezone: '+07:00', // Vietnam timezone (UTC+7)
  logging: false,
  define: {
    charset: 'utf8mb4',
    collate: 'utf8mb4_general_ci',
    timestamps: true,
    underscored: false,
    paranoid: false
  },
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000
  },
  dialectOptions: {
    timezone: 'local',
    dateStrings: true,
    typeCast: true
  }
});
 

// Import all models (use exact filenames / casing)
const Post = require('./post');
const Token = require('./token');
const Engagement = require('./engagement');
const PlatformPost = require('./platformpost');
const AbTest = require('./AbTest');
const AbTestVariant = require('./AbTestVariant');
const Visual = require('./Visual');
const FacebookPost = require('./FacebookPost');
const FacebookComment = require('./FacebookComment');
const HandledComment = require('./HandledComment');
const SystemLog = require('./SystemLog');
const AIPromptSequelize = require('./AIPromptSequelize');
const ChatHistorySequelize = require('./ChatHistorySequelize');
const CommentAnalysis = require('./CommentAnalysis');
const SpamPattern = require('./SpamPattern');
const SentimentKeyword = require('./SentimentKeyword');
const ToxicKeyword = require('./ToxicKeyword');
const ModerationLog = require('./ModerationLog');
// ChatAI models
const ChatAIUser = require('./ChatAIUser');
const ChatAIConversation = require('./ChatAIConversation');
const ChatAIResponse = require('./ChatAIResponse');
const ChatAIAnalytics = require('./ChatAIAnalytics');

// Initialize models
const models = {
  Post: Post(sequelize),
  Token: Token(sequelize),
  Engagement: Engagement(sequelize),
  PlatformPost: PlatformPost(sequelize)
  ,AbTest: AbTest(sequelize)
  ,AbTestVariant: AbTestVariant(sequelize)
  ,Visual: Visual(sequelize)
  ,FacebookPost: FacebookPost(sequelize)
  ,FacebookComment: FacebookComment(sequelize)
  ,HandledComment: HandledComment(sequelize)
  ,SystemLog: SystemLog(sequelize)
  ,AIPrompt: AIPromptSequelize(sequelize)
  ,ChatHistory: ChatHistorySequelize(sequelize)
  ,CommentAnalysis: CommentAnalysis(sequelize)
  ,SpamPattern: SpamPattern(sequelize)
  ,SentimentKeyword: SentimentKeyword(sequelize)
  ,ToxicKeyword: ToxicKeyword(sequelize)
  ,ModerationLog: ModerationLog(sequelize)
  // ChatAI models
  ,ChatAIUser: ChatAIUser(sequelize)
  ,ChatAIConversation: ChatAIConversation(sequelize)
  ,ChatAIResponse: ChatAIResponse(sequelize)
  ,ChatAIAnalytics: ChatAIAnalytics(sequelize)
};

// Setup associations if provided by model definitions
Object.keys(models).forEach((name) => {
  if (typeof models[name].associate === 'function') {
    models[name].associate(models);
  }
});

module.exports = {
  sequelize,
  ...models
};