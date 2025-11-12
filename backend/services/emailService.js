// backend/services/emailService.js
const nodemailer = require("nodemailer");
require("dotenv").config();

// 1. Configure the "transporter" (the email service)
// We use Gmail here. For this to work, you MUST:
// 1. Use a Gmail account.
// 2. Enable 2-Factor Authentication on it.
// 3. Create an "App Password" for "Mail" on "Mac".
// 4. Put that App Password in your .env file.
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER, // Your Gmail address (e.g., "my.app@gmail.com")
    pass: process.env.EMAIL_PASS, // Your 16-character App Password
  },
});

/**
 * Sends a verification email to a new user.
 * @param {string} userEmail - The new user's email address.
 * @param {string} verificationCode - The unique token to verify them.
 */
async function sendVerificationEmail(userEmail, verificationCode) {

  const mailOptions = {
    from: `"CommunityTalk" <${process.env.EMAIL_USER}>`,
    to: userEmail,
    subject: "Your CommunityTalk Verification Code",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; text-align: center; padding: 20px;">
        <div style="border: 1px solid #ddd; border-radius: 10px; padding: 30px; max-width: 400px; margin: auto;">
          <h2 style="color: #333;">Welcome to CommunityTalk!</h2>
          <p style="color: #555;">Your verification code is:</p>
          <p style="font-size: 36px; font-weight: bold; color: #6366F1; letter-spacing: 5px; margin: 20px 0;">
            ${verificationCode}
          </p>
          <p style="color: #777; font-size: 14px;">This code will expire in 1 hour.</p>
          <p style="color: #777; font-size: 14px;">If you did not create an account, you can safely ignore this email.</p>
        </div>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`[Email] Verification code sent to ${userEmail}`);
  } catch (error) {
    console.error(`[Email] Error sending verification code: ${error.message}`);
    throw new Error("Failed to send verification email.");
  }
}

module.exports = { sendVerificationEmail };