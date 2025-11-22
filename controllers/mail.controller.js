const nodemailer = require("nodemailer");

class MailController {
  constructor() {
    // Khởi tạo transporter 1 lần khi class được tạo
    this.transporter = nodemailer.createTransport({
      service: "gmail", // hoặc SMTP provider khác
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // ⚠️ Ràng buộc ngữ cảnh this cho sendMail
    this.sendMail = this.sendMail.bind(this);
  }

  async sendMail(req, res) {
    try {
      const { to, subject, html } = req.body;

      if (!to || !subject || !html) {
        return res.status(400).json({
          success: false,
          message: "to, subject, and text/html are required",
        });
      }

      const mailConfig = {
        from: process.env.EMAIL_USER,
        to,
        subject,
        html,
      };

      const result = await this.transporter.sendMail(mailConfig);

      return res.json({
        success: true,
        messageId: result.messageId,
        response: result.response,
        sent_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error("❌ Error sending email:", error);
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
}

// ✅ Tạo instance sẵn và export ra
module.exports = new MailController();
