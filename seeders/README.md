# Database Seeders

This directory contains Sequelize seeders for initializing the database with default data.

## Overview

The seeders replace the raw SQL initialization scripts and provide a more maintainable way to seed the database with initial data.

## Available Seeders

### 1. AI Prompts Seeder (`ai-prompts-seeder.js`)
- Seeds the `ai_prompts` table with default watch sales prompt
- Contains the complete Golden Hour watch sales assistant prompt

### 2. Sentiment Keywords Seeder (`sentiment-keywords-seeder.js`)
- Seeds the `sentiment_keywords` table with Vietnamese sentiment analysis keywords
- Covers positive, negative, and neutral sentiment categories

### 3. Toxic Keywords Seeder (`toxic-keywords-seeder.js`)
- Seeds the `toxic_keywords` table with Vietnamese toxic content detection
- Includes profanity, insults, hate speech, and violence categories

## Usage

### Run All Seeders
```bash
npm run seed
# or
node seeders/index.js
```

### Run Individual Seeders
```bash
npm run seed:ai-prompts
npm run seed:sentiment
npm run seed:toxic
```

### Database Setup (Create DB + Tables + Seed)
```bash
npm run init-sequelize
```

### Database Reset (Re-seed data)
```bash
npm run db:reset
```

## Seeder Structure

Each seeder file exports a function that:
1. Uses Sequelize models to insert/update data
2. Uses `upsert()` to avoid duplicates
3. Provides detailed logging
4. Handles errors gracefully

## Data Sources

The seeders replicate the data from the original SQL files:
- `database/schema.sql` - AI prompts data
- `database/sentiment_analysis_update.sql` - Sentiment keywords
- `database/toxic_detection_update.sql` - Toxic keywords

## Migration from SQL

To migrate from the old SQL initialization:

1. **Old way (SQL files):**
   ```bash
   npm run init-all
   ```

2. **New way (Sequelize seeders):**
   ```bash
   npm run init-sequelize
   ```

## Benefits

- **Type Safety**: Uses Sequelize models with proper validation
- **Maintainability**: Easy to modify and extend
- **Idempotent**: Can be run multiple times safely
- **Logging**: Detailed progress and error reporting
- **Modular**: Individual seeders can be run independently
