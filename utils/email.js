const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

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

    console.log('Message sent:', info.messageId);
};

const getResetPasswordTemplate = (url, name) => {
    return `
    <!DOCTYPE html>
        <html lang="en">
            <head>
                <meta charset="UTF-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <title>Reset Your Password</title>

                <style>
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }

                    body {
                        background-color: #f4f7fb;
                        font-family: Arial, Helvetica, sans-serif;
                        color: #1f2937;
                        padding: 30px 15px;
                        -webkit-font-smoothing: antialiased;
                    }

                    .email-wrapper {
                        max-width: 620px;
                        margin: 0 auto;
                        background: #ffffff;
                        border-radius: 20px;
                        overflow: hidden;
                        box-shadow: 0 10px 35px rgba(0, 0, 0, 0.06);
                    }

                    .header {
                        background: linear-gradient(135deg, #111827, #1f2937);
                        padding: 50px 40px;
                        text-align: center;
                    }

                    .logo {
                        color: #ffffff;
                        font-size: 30px;
                        font-weight: 800;
                        letter-spacing: 2px;
                        margin-bottom: 12px;
                    }

                    .header h1 {
                        color: #ffffff;
                        font-size: 30px;
                        font-weight: 700;
                    }

                    .content {
                        padding: 45px 40px;
                    }

                    .greeting {
                        font-size: 22px;
                        font-weight: 700;
                        margin-bottom: 20px;
                        color: #111827;
                    }

                    .text {
                        font-size: 16px;
                        line-height: 1.8;
                        color: #4b5563;
                        margin-bottom: 22px;
                    }

                    .security-box {
                        background: #fff7ed;
                        border: 1px solid #fed7aa;
                        border-radius: 14px;
                        padding: 18px 20px;
                        margin: 30px 0;
                    }

                    .security-box p {
                        font-size: 14px;
                        line-height: 1.7;
                        color: #9a3412;
                    }

                    .button-wrapper {
                        text-align: center;
                        margin: 40px 0;
                    }

                    .button {
                        display: inline-block;
                        background: #111827;
                        color: #ffffff !important;
                        text-decoration: none;
                        padding: 16px 38px;
                        border-radius: 12px;
                        font-size: 16px;
                        font-weight: 700;
                    }

                    .link-box {
                        margin-top: 30px;
                        background: #f9fafb;
                        border-radius: 12px;
                        padding: 16px;
                        word-break: break-word;
                    }

                    .link-box a {
                        color: #2563eb;
                        font-size: 14px;
                        text-decoration: none;
                    }

                    .footer {
                        border-top: 1px solid #e5e7eb;
                        background: #f9fafb;
                        padding: 30px 25px;
                        text-align: center;
                    }

                    .footer p {
                        font-size: 13px;
                        color: #6b7280;
                        line-height: 1.7;
                    }

                    .footer .brand {
                        font-weight: 700;
                        color: #111827;
                    }

                    @media only screen and (max-width: 600px) {
                        .header,
                        .content,
                        .footer {
                                padding: 30px 22px;
                        }

                        .header h1 {
                            font-size: 26px;
                        }

                        .greeting {
                            font-size: 20px;
                        }

                        .button {
                            width: 100%;
                            text-align: center;
                        }
                    }
                </style>
            </head>

            <body>
                <div class="email-wrapper">

                    <div class="header">
                        <div class="logo">CARTIVO</div>
                        <h1>Password Reset Request</h1>
                    </div>

                    <div class="content">

                        <div class="greeting">
                            Hello ${name},
                        </div>

                        <p class="text">
                            We received a request to reset the password for your Cartivo account.
                            Click the button below to create a new password and regain access to your account securely.
                        </p>

                        <div class="security-box">
                            <p>
                                ⚠️ For security reasons, this password reset link will expire in
                                <strong>2 minutes</strong>.
                                If you did not request a password reset, you can safely ignore this email.
                            </p>
                        </div>

                        <div class="button-wrapper">
                            <a href="${url}" class="button">
                                Reset Password
                            </a>
                        </div>

                        <p class="text" style="margin-bottom: 12px;">
                            If the button above does not work, copy and paste the following link into your browser:
                        </p>

                        <div class="link-box">
                            <a href="${url}">
                                ${url}
                            </a>
                        </div>

                    </div>

                    <div class="footer">
                        <p class="brand">Cartivo</p>

                        <p>
                            Secure shopping experience for modern customers.
                        </p>

                        <p style="margin-top: 10px;">
                            © 2026 Cartivo. All rights reserved.
                        </p>
                    </div>

                </div>
            </body>
        </html>
`;
};

module.exports = { sendEmail, getResetPasswordTemplate };