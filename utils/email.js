const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });

    const message = {
        from: `${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`,
        to: options.email,
        subject: options.subject,
        html: options.html,
    };

    const info = await transporter.sendMail(message);

    console.log('Message sent: %s', info.messageId);
};

const getResetPasswordTemplate = (url, name) => {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Password</title>
        <style>
            body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f7ff; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
            .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.05); }
            .header { background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 60px 40px; text-align: center; }
            .header h1 { color: #ffffff; margin: 0; font-size: 32px; font-weight: 800; letter-spacing: -0.02em; }
            .content { padding: 50px 40px; color: #1f2937; line-height: 1.6; }
            .content h2 { font-size: 24px; font-weight: 700; margin-bottom: 20px; color: #111827; }
            .content p { font-size: 16px; margin-bottom: 30px; color: #4b5563; }
            .button-container { text-align: center; margin: 40px 0; }
            .button { background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: #ffffff !important; padding: 18px 45px; text-decoration: none; border-radius: 16px; font-weight: 700; font-size: 16px; display: inline-block; box-shadow: 0 10px 20px rgba(79, 70, 229, 0.15); transition: all 0.3s ease; }
            .footer { background-color: #f9fafb; padding: 40px; text-align: center; border-top: 1px solid #f1f5f9; }
            .footer p { font-size: 14px; color: #9ca3af; margin: 0; }
            .warning { background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 20px; border-radius: 12px; margin-bottom: 30px; }
            .warning p { color: #92400e; font-size: 14px; margin: 0; font-weight: 500; }
            .logo { font-size: 28px; font-weight: 900; color: #ffffff; letter-spacing: -1px; margin-bottom: 15px; display: block; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <span class="logo">CARTIVO</span>
                <h1>Reset Your Password</h1>
            </div>
            <div class="content">
                <h2>Hello ${name},</h2>
                <p>We received a request to reset the password for your Cartivo account. No problem! Just click the button below to set a new one.</p>
                
                <div class="warning">
                    <p>⚠️ This link is only valid for <strong>2 minutes</strong> for security reasons. If you didn't request this, you can safely ignore this email.</p>
                </div>

                <div class="button-container">
                    <a href="${url}" class="button">Reset Password</a>
                </div>

                <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
                <p style="word-break: break-all; font-size: 14px; color: #6366f1;">${url}</p>
            </div>
            <div class="footer">
                <p>&copy; 2026 Cartivo E-commerce. All rights reserved.</p>
                <p>Curating the Best Collection for You.</p>
            </div>
        </div>
    </body>
    </html>
    `;
};

module.exports = { sendEmail, getResetPasswordTemplate };