# Backend API - Facebook Comment Auto-Reply

Backend service xử lý logic cho hệ thống tự động reply Facebook comments.

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

## 📡 API Endpoints

### Health Check
```http
GET /api/health
```

### Process Comments
```http
POST /api/comments/process
Content-Type: application/json

{
  "comments": [...],
  "session_id": "session_123"
}
```

### Mark as Handled
```http
POST /api/comments/mark-handled
Content-Type: application/json

{
  "handled_comments": [...]
}
```

### Check Handled Status
```http
POST /api/comments/check-handled
Content-Type: application/json

{
  "comment_ids": ["123", "456"]
}
```

### Get Unhandled Comments
```http
GET /api/comments/unhandled?limit=50
```

### Save Posts
```http
POST /api/posts/save
Content-Type: application/json

{
  "posts": [...]
}
```

### Generate AI Response
```http
POST /api/ai/generate-response
Content-Type: application/json

{
  "message": "User question",
  "user_name": "John",
  "user_id": "123",
  "post_id": "456",
  "session_id": "session_123"
}
```

## 🗄️ Database Models

### facebook_posts
- post_id (unique)
- page_id
- content
- created_time

### facebook_comments
- comment_id (unique)
- post_id (FK)
- parent_comment_id (nullable)
- from_id
- from_name
- message
- created_time
- comment_level (1, 2, 3)

### handled_comments
- comment_id (unique)
- reply_id
- ai_response
- session_id
- handled_at

### chat_history
- session_id
- user_id
- user_name
- user_message
- ai_response
- context_data (JSON)
- created_at

### system_logs
- log_level (info, warning, error, debug)
- source
- message
- metadata (JSON)
- created_at

### ai_prompts
- prompt_name (unique)
- system_message
- is_active
- created_at
- updated_at

## 🔧 Development

### Run tests
```bash
npm test
```

### Lint code
```bash
npm run lint
```

### Database migrations
```bash
npm run init-db
```

### View logs
```bash
# Real-time logs
tail -f logs/app.log

# Or query database
mysql -u root -p fb_comment_db -e "SELECT * FROM system_logs ORDER BY created_at DESC LIMIT 50;"
```

## 🐛 Debugging

Enable debug logs:
```env
NODE_ENV=development
```

Check database connection:
```bash
mysql -u root -p -e "USE fb_comment_db; SHOW TABLES;"
```

Test Gemini API:
```bash
curl -X POST http://localhost:3000/api/ai/generate-response \
  -H "Content-Type: application/json" \
  -d '{"message":"Test","user_name":"Test","user_id":"1","session_id":"test"}'
```

## 📦 Dependencies

- **express** - Web framework
- **mysql2** - MySQL driver with promise support
- **dotenv** - Environment variables
- **cors** - CORS middleware
- **body-parser** - Request body parsing
- **@google/generative-ai** - Google Gemini API
- **axios** - HTTP client

## 🚀 Deployment

### Production setup

1. Set environment:
```env
NODE_ENV=production
```

2. Use process manager:
```bash
npm install -g pm2
pm2 start server.js --name fb-backend
pm2 startup
pm2 save
```

3. Setup reverse proxy (nginx):
```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

4. Enable SSL (Let's Encrypt):
```bash
certbot --nginx -d api.yourdomain.com
```

## 📊 Monitoring

Check service status:
```bash
pm2 status
pm2 logs fb-backend
```

Database stats:
```sql
-- Total comments
SELECT COUNT(*) FROM facebook_comments;

-- Handled vs unhandled
SELECT 
  (SELECT COUNT(*) FROM handled_comments) as handled,
  (SELECT COUNT(*) FROM facebook_comments) - (SELECT COUNT(*) FROM handled_comments) as unhandled;

-- Today's activity
SELECT COUNT(*) FROM facebook_comments WHERE DATE(created_time) = CURDATE();
```

## 🔐 Security

- API keys in `.env` (never commit!)
- Rate limiting (add express-rate-limit)
- Input validation
- SQL injection prevention (parameterized queries)
- CORS configuration

## 📝 License

MIT

