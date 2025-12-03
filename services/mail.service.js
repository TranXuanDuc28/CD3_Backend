const nodemailer = require('nodemailer');

class MailService {
  constructor() {
    this.transporter = nodemailer.createTransporter({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: process.env.EMAIL_PORT || 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    this.templates = {
      lowEngagement: {
        subject: 'Thông báo: Bài đăng có lượt tương tác thấp!',
        template: (data) => `
          <h2>Thông báo về bài đăng</h2>
          <p>Bài đăng của bạn với tiêu đề "<strong>${data.title}</strong>" có tương tác thấp sau 1 ngày.</p>
          <ul>
            <li>Lượt thích: ${data.engagement.likes}</li>
            <li>Bình luận: ${data.engagement.comments}</li>
            <li>Chia sẻ: ${data.engagement.shares}</li>
            <li>Điểm tương tác: ${data.engagement.engagementScore}</li>
          </ul>
          <p>Hãy xem xét tối ưu hóa nội dung để tăng tương tác.</p>
        `
      },
      postPublished: {
        subject: 'Bài đăng đã được xuất bản thành công',
        template: (data) => `
          <h2>Bài đăng đã được xuất bản</h2>
          <p>Bài đăng "<strong>${data.title}</strong>" đã được xuất bản thành công trên ${data.platform}.</p>
          <p>Thời gian xuất bản: ${data.published_at}</p>
        `
      },
      postFailed: {
        subject: 'Lỗi xuất bản bài đăng',
        template: (data) => `
          <h2>Lỗi xuất bản bài đăng</h2>
          <p>Bài đăng "<strong>${data.title}</strong>" không thể xuất bản trên ${data.platform}.</p>
          <p>Lỗi: ${data.error}</p>
          <p>Vui lòng kiểm tra và thử lại.</p>
        `
      }
    };
  }

  async sendMail(mailOptions) {
    try {
      const { to, subject, text, html, attachments } = mailOptions;

      const mailConfig = {
        from: process.env.EMAIL_USER,
        to: to,
        subject: subject,
        text: text,
        html: html,
        attachments: attachments
      };

      const result = await this.transporter.sendMail(mailConfig);

      return {
        success: true,
        messageId: result.messageId,
        response: result.response,
        sent_at: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Error sending email: ${error.message}`);
    }
  }

  async sendNotification(type, data, recipients) {
    try {
      const template = this.templates[type];
      
      if (!template) {
        throw new Error(`Template not found for type: ${type}`);
      }

      if (!recipients || recipients.length === 0) {
        throw new Error('Recipients are required');
      }

      const results = [];

      for (const recipient of recipients) {
        try {
          const html = template.template(data);
          
          const result = await this.sendMail({
            to: recipient,
            subject: template.subject,
            html: html
          });

          results.push({
            recipient: recipient,
            success: true,
            messageId: result.messageId
          });
        } catch (error) {
          results.push({
            recipient: recipient,
            success: false,
            error: error.message
          });
        }
      }

      return {
        type: type,
        total_recipients: recipients.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results: results
      };
    } catch (error) {
      throw new Error(`Error sending notification: ${error.message}`);
    }
  }

  async sendBulkMail(emails) {
    try {
      if (!emails || !Array.isArray(emails)) {
        throw new Error('Emails array is required');
      }

      const results = [];

      for (const email of emails) {
        try {
          const result = await this.sendMail(email);
          results.push({
            success: true,
            to: email.to,
            messageId: result.messageId
          });
        } catch (error) {
          results.push({
            success: false,
            to: email.to,
            error: error.message
          });
        }
      }

      return {
        total_emails: emails.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results: results
      };
    } catch (error) {
      throw new Error(`Error sending bulk mail: ${error.message}`);
    }
  }

  async getMailTemplates() {
    try {
      return Object.keys(this.templates).map(key => ({
        type: key,
        subject: this.templates[key].subject,
        description: this.getTemplateDescription(key)
      }));
    } catch (error) {
      throw new Error(`Error getting mail templates: ${error.message}`);
    }
  }

  async createMailTemplate(templateData) {
    try {
      const { type, subject, template } = templateData;

      if (!type || !subject || !template) {
        throw new Error('type, subject, and template are required');
      }

      this.templates[type] = {
        subject: subject,
        template: template
      };

      return {
        type: type,
        subject: subject,
        created_at: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Error creating mail template: ${error.message}`);
    }
  }

  getTemplateDescription(type) {
    const descriptions = {
      lowEngagement: 'Thông báo khi bài đăng có tương tác thấp',
      postPublished: 'Thông báo khi bài đăng được xuất bản thành công',
      postFailed: 'Thông báo khi có lỗi xuất bản bài đăng'
    };

    return descriptions[type] || 'Custom template';
  }

  async testConnection() {
    try {
      await this.transporter.verify();
      return {
        success: true,
        message: 'Email connection verified successfully'
      };
    } catch (error) {
      throw new Error(`Email connection test failed: ${error.message}`);
    }
  }

  async sendLowEngagementAlert(postData, engagementData) {
    try {
      const recipients = [process.env.ADMIN_EMAIL || 'admin@example.com'];
      
      const data = {
        title: postData.title,
        engagement: engagementData
      };

      return await this.sendNotification('lowEngagement', data, recipients);
    } catch (error) {
      throw new Error(`Error sending low engagement alert: ${error.message}`);
    }
  }

  async sendPostStatusNotification(postData, status) {
    try {
      const recipients = [process.env.ADMIN_EMAIL || 'admin@example.com'];
      
      const data = {
        title: postData.title,
        platform: postData.platform,
        published_at: postData.published_at,
        error: postData.error
      };

      const notificationType = status === 'published' ? 'postPublished' : 'postFailed';
      return await this.sendNotification(notificationType, data, recipients);
    } catch (error) {
      throw new Error(`Error sending post status notification: ${error.message}`);
    }
  }
}

module.exports = new MailService();