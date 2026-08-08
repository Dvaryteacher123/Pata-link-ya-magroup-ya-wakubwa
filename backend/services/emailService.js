// ==========================================
// EMAIL SERVICE
// ==========================================

const nodemailer = require('nodemailer');

const EMAIL_CONFIG = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_PORT === '465',
  user: process.env.SMTP_USER,
  pass: process.env.SMTP_PASS,
  supportEmail: process.env.SUPPORT_EMAIL || 'dullamanyama0@gmail.com'
};

let transporter = null;

const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: EMAIL_CONFIG.host,
      port: EMAIL_CONFIG.port,
      secure: EMAIL_CONFIG.secure,
      auth: {
        user: EMAIL_CONFIG.user,
        pass: EMAIL_CONFIG.pass
      },
      tls: {
        rejectUnauthorized: false
      }
    });
  }
  return transporter;
};

class EmailService {
  
  static async sendEmail(to, subject, html, text = null) {
    try {
      const transporter = getTransporter();

      const mailOptions = {
        from: `"Pata Link WhatsApp" <${EMAIL_CONFIG.supportEmail}>`,
        to: to,
        subject: subject,
        html: html,
        text: text || html.replace(/<[^>]*>/g, ''),
        replyTo: EMAIL_CONFIG.supportEmail
      };

      const info = await transporter.sendMail(mailOptions);
      
      return {
        success: true,
        messageId: info.messageId,
        message: 'Email sent successfully'
      };

    } catch (error) {
      console.error('Email send error:', error);
      return {
        success: false,
        error: error.message || 'Failed to send email'
      };
    }
  }

  static async sendWelcomeEmail(user) {
    const subject = 'Welcome to Pata Link WhatsApp Groups! 🎉';
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; background: #0a0a0a; color: #ffffff; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #1a1a2e; padding: 40px; border-radius: 20px; }
          .header { text-align: center; border-bottom: 2px solid #4F46E5; padding-bottom: 20px; }
          .title { color: #4F46E5; font-size: 28px; }
          .content { padding: 20px 0; }
          .button { display: inline-block; background: linear-gradient(135deg, #4F46E5, #7C3AED); color: white; padding: 12px 30px; border-radius: 10px; text-decoration: none; margin-top: 15px; }
          .footer { border-top: 1px solid #333; padding-top: 20px; text-align: center; color: #888; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 class="title">👋 Welcome to Pata Link WhatsApp Groups!</h1>
          </div>
          <div class="content">
            <p>Hello <strong>${user.fullName || 'there'}</strong>,</p>
            <p>Thank you for joining <strong>Pata Link WhatsApp Groups</strong>!</p>
            <p>We're excited to help you find the best WhatsApp groups for your interests.</p>
            <div style="text-align: center;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" class="button">🚀 Explore Groups</a>
            </div>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Pata Link WhatsApp Groups</p>
            <p>Need help? Contact us at ${EMAIL_CONFIG.supportEmail}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail(user.email, subject, html);
  }

  static async sendPaymentConfirmationEmail(order) {
    const subject = '✅ Payment Confirmed - Your WhatsApp Group Link';
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; background: #0a0a0a; color: #ffffff; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #1a1a2e; padding: 40px; border-radius: 20px; }
          .header { text-align: center; border-bottom: 2px solid #10B981; padding-bottom: 20px; }
          .title { color: #10B981; font-size: 28px; }
          .content { padding: 20px 0; }
          .order-details { background: #16213e; padding: 15px; border-radius: 10px; margin: 15px 0; }
          .link-button { display: inline-block; background: linear-gradient(135deg, #10B981, #34D399); color: white; padding: 15px 40px; border-radius: 10px; text-decoration: none; font-size: 18px; margin-top: 20px; }
          .footer { border-top: 1px solid #333; padding-top: 20px; text-align: center; color: #888; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 class="title">✅ Payment Confirmed!</h1>
          </div>
          <div class="content">
            <p>Hello <strong>${order.userName || 'there'}</strong>,</p>
            <p>Your payment has been confirmed successfully!</p>
            
            <div class="order-details">
              <h3>📋 Order Details</h3>
              <p><strong>Order ID:</strong> ${order.orderId}</p>
              <p><strong>Product:</strong> ${order.productTitle}</p>
              <p><strong>Amount:</strong> ${order.amount} TSh</p>
              <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
            </div>

            <p><strong>🎉 Your WhatsApp Group Link is ready!</strong></p>
            
            <div style="text-align: center;">
              <a href="${order.whatsappLink}" class="link-button">💬 Join WhatsApp Group</a>
            </div>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Pata Link WhatsApp Groups</p>
            <p>Need help? Contact us at ${EMAIL_CONFIG.supportEmail}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail(order.email, subject, html);
  }

  static async sendResetPasswordEmail(email, resetToken, userName = 'there') {
    const subject = '🔑 Reset Your Password - Pata Link WhatsApp';
    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; background: #0a0a0a; color: #ffffff; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #1a1a2e; padding: 40px; border-radius: 20px; }
          .header { text-align: center; border-bottom: 2px solid #F59E0B; padding-bottom: 20px; }
          .title { color: #F59E0B; font-size: 28px; }
          .content { padding: 20px 0; }
          .reset-button { display: inline-block; background: linear-gradient(135deg, #F59E0B, #FBBF24); color: white; padding: 12px 30px; border-radius: 10px; text-decoration: none; margin-top: 15px; }
          .warning { background: #1e1e3f; padding: 15px; border-radius: 10px; margin: 15px 0; border-left: 4px solid #F59E0B; }
          .footer { border-top: 1px solid #333; padding-top: 20px; text-align: center; color: #888; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 class="title">🔑 Reset Your Password</h1>
          </div>
          <div class="content">
            <p>Hello <strong>${userName}</strong>,</p>
            <p>We received a request to reset your password.</p>
            <div class="warning">
              <p>🔒 This link will expire in <strong>1 hour</strong></p>
              <p>If you didn't request this, please ignore this email.</p>
            </div>
            <div style="text-align: center;">
              <a href="${resetLink}" class="reset-button">🔐 Reset Password</a>
            </div>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Pata Link WhatsApp Groups</p>
            <p>Need help? Contact us at ${EMAIL_CONFIG.supportEmail}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail(email, subject, html);
  }

  static async sendNotificationEmail(email, subject, message, userName = 'there') {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; background: #0a0a0a; color: #ffffff; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #1a1a2e; padding: 40px; border-radius: 20px; }
          .header { text-align: center; border-bottom: 2px solid #EC4899; padding-bottom: 20px; }
          .title { color: #EC4899; font-size: 28px; }
          .content { padding: 20px 0; }
          .message-box { background: #16213e; padding: 15px; border-radius: 10px; margin: 15px 0; }
          .footer { border-top: 1px solid #333; padding-top: 20px; text-align: center; color: #888; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 class="title">🔔 New Notification</h1>
          </div>
          <div class="content">
            <p>Hello <strong>${userName}</strong>,</p>
            <div class="message-box">
              <h3>${subject}</h3>
              <p>${message}</p>
            </div>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Pata Link WhatsApp Groups</p>
            <p>Need help? Contact us at ${EMAIL_CONFIG.supportEmail}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail(email, subject, html);
  }
}

module.exports = EmailService;
