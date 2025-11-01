# Backend API - Commnunication & PR

Backend service xử lý logic cho hệ thống.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Edit .env with your credentials
# DB_PASSWORD, GEMINI_API_KEY, FACEBOOK_ACCESS_TOKEN

# Initialize database
npm run init-db

# Start server
npm start

# Or development mode with auto-reload
npm run dev
```

Server chạy tại: http://localhost:3000

## 📁 Project Structure

```
backend/
├── config/
│   ├── database.js      # MySQL connection pool
│   └── gemini.js        # Google Gemini AI config
├── controllers/
│   └── CommentController.js  # Request handlers
├── models/
│   ├── Comment.js       # Comment model
│   ├── ChatHistory.js   # Chat history model
│   └── AIPrompt.js      # AI prompt model
├── routes/
│   └── api.js           # API routes
├── services/
│   └── CommentService.js # Business logic
├── scripts/
│   └── init-database.js # Database initialization
├── utils/
│   └── logger.js        # Logging utility
├── server.js            # Main server file
├── package.json
└── .env                 # Environment variables
```

## 🔑 Environment Variables

Required in `.env`:

```env
# Server
PORT=3000
NODE_ENV=development

# MySQL Database
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=fb_comment_db
DB_PORT=3306

# Google Gemini API
GEMINI_API_KEY=your_api_key

# Facebook
FACEBOOK_PAGE_ID=your_page_id
FACEBOOK_ACCESS_TOKEN=your_token

# Config
MAX_CHAT_HISTORY=20
DEFAULT_POSTS_LIMIT=10
```

