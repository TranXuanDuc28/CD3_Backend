# Template Engine Usage Guide

## Cách sử dụng Template Engine để thay thế biến trong prompt

### 1. Cú pháp Template

Hệ thống hỗ trợ các cú pháp sau:

```javascript
// Thay thế biến đơn giản
{{ content }}          // Thay thế bằng data.content
{{ message }}          // Thay thế bằng data.message

// Thay thế từ JSON object
{{ $json.content }}    // Thay thế bằng data.content
{{ $json.message }}    // Thay thế bằng data.message

// Thay thế từ workflow node
{{ $('Node Name').item.json.field }}  // Thay thế bằng data['Node Name'].field
```

### 2. Ví dụ Prompt trong Database

```sql
INSERT INTO ai_prompts (prompt_name, system_message) VALUES (
    'default_watch_sales',
    'TÊN PAGE: Golden Hour - Bán Đồng Hồ

ROLE
Bạn là Trợ lý ảo AI CSKH Online - chuyên gia bán đồng hồ và chăm sóc khách hàng trực tuyến.

TASK
Đọc nội dung bài viết: {{ $json.content }}
Đọc nội dung từ tin nhắn khách hàng: {{ $json.message }}

Hãy trả lời dựa trên thông tin này...'
);
```

### 3. Cách gửi dữ liệu từ Workflow

#### API Endpoint: POST /api/ai/process-template

```json
{
  "prompt_name": "default_watch_sales",
  "workflow_data": {
    "content": "Nội dung bài viết về đồng hồ Rolex...",
    "message": "Tôi muốn mua đồng hồ nam",
    "user_name": "Nguyễn Văn A",
    "user_id": "123456",
    "post_id": "post_123"
  }
}
```

#### Response:

```json
{
  "success": true,
  "processed_prompt": "TÊN PAGE: Golden Hour - Bán Đồng Hồ\n\nROLE\nBạn là Trợ lý ảo AI CSKH Online...\n\nTASK\nĐọc nội dung bài viết: Nội dung bài viết về đồng hồ Rolex...\nĐọc nội dung từ tin nhắn khách hàng: Tôi muốn mua đồng hồ nam\n\nHãy trả lời dựa trên thông tin này...",
  "original_data": {
    "content": "Nội dung bài viết về đồng hồ Rolex...",
    "message": "Tôi muốn mua đồng hồ nam",
    "user_name": "Nguyễn Văn A",
    "user_id": "123456",
    "post_id": "post_123"
  }
}
```

### 4. Sử dụng trong Generate Response

#### API Endpoint: POST /api/ai/generate-response

```json
{
  "message": "Tôi muốn mua đồng hồ nam",
  "user_name": "Nguyễn Văn A",
  "user_id": "123456",
  "post_id": "post_123",
  "session_id": "session_456",
  "workflow_data": {
    "content": "Nội dung bài viết về đồng hồ Rolex...",
    "custom_field": "Giá trị tùy chỉnh"
  }
}
```

### 5. Ví dụ Workflow Data từ n8n

Khi gửi dữ liệu từ n8n workflow:

```javascript
// Trong n8n, bạn có thể gửi:
{
  "message": "{{ $json.message }}",
  "user_name": "{{ $json.from_name }}",
  "user_id": "{{ $json.from_id }}",
  "post_id": "{{ $json.post_id }}",
  "workflow_data": {
    "content": "{{ $('Split Posts').item.json.content }}",
    "message": "{{ $('Split Comments').item.json.message }}",
    "custom_data": "{{ $json.custom_field }}"
  }
}
```

### 6. Template Variables được hỗ trợ

- `content`: Nội dung bài viết
- `message`: Tin nhắn từ khách hàng
- `user_name`: Tên người dùng
- `user_id`: ID người dùng
- `post_id`: ID bài viết
- `session_id`: ID phiên
- Bất kỳ field nào trong `workflow_data`

### 7. Debug Template

Để debug template, bạn có thể sử dụng:

```javascript
const TemplateEngine = require('./utils/templateEngine');

const template = "Đọc nội dung bài viết: {{ $json.content }}";
const data = { content: "Nội dung bài viết..." };

const result = TemplateEngine.processTemplate(template, data);
console.log(result); // "Đọc nội dung bài viết: Nội dung bài viết..."

// Kiểm tra variables
const variables = TemplateEngine.extractVariables(template);
console.log(variables); // ["content"]

// Validate template
const validation = TemplateEngine.validateTemplate(template, data);
console.log(validation.valid); // true/false
```
