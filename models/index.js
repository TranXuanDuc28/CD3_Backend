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
// Initialize models
const models = {
  Post: Post(sequelize),
  Token: Token(sequelize),
  Engagement: Engagement(sequelize),
  PlatformPost: PlatformPost(sequelize)
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