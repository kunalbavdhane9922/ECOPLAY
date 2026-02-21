const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

const sendOTPEmail = async (email, otp, name) => {
    const mailOptions = {
        from: `"Eco Platform" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: '🌿 Your OTP for Eco Platform',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #0a4d2e, #1a7a50);">
                <div style="background: white; border-radius: 16px; padding: 40px; text-align: center;">
                    <div style="font-size: 40px; margin-bottom: 20px;">🌿</div>
                    <h1 style="color: #0a4d2e; margin-bottom: 10px;">Hello, ${name}!</h1>
                    <p style="color: #666; font-size: 16px;">Your OTP for Eco Platform verification:</p>
                    <div style="background: linear-gradient(135deg, #0a4d2e, #1a7a50); border-radius: 12px; padding: 20px; margin: 20px 0;">
                        <span style="font-size: 42px; font-weight: bold; color: white; letter-spacing: 12px;">${otp}</span>
                    </div>
                    <p style="color: #999; font-size: 14px;">This OTP expires in 10 minutes.</p>
                    <p style="color: #999; font-size: 12px;">If you didn't request this, please ignore this email.</p>
                </div>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        return true;
    } catch (error) {
        console.error('Email send error:', error);
        return false;
    }
};

const sendNotificationEmail = async (email, subject, message) => {
    const mailOptions = {
        from: `"Eco Platform" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: subject,
        html: `<div style="font-family: Arial, sans-serif; padding: 20px;"><p>${message}</p></div>`
    };

    try {
        await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error('Notification email error:', error);
    }
};

module.exports = { generateOTP, sendOTPEmail, sendNotificationEmail };
