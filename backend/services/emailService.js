// backend/services/emailService.js
const { Resend } = require('resend');
require("dotenv").config();

// Validate environment variables
if (!process.env.RESEND_API_KEY) {
  console.error('❌ [Email Service] CRITICAL: RESEND_API_KEY not configured!');
  console.error('❌ [Email Service] Get your API key from: https://resend.com/api-keys');
} else {
  console.log('📧 [Email Service] Configured with Resend');
}

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Sends a verification email to a new user using Resend.
 * @param {string} userEmail - The new user's email address.
 * @param {string} verificationCode - The 6-digit verification code.
 */
async function sendVerificationEmail(userEmail, verificationCode) {
  try {
    console.log(`📧 [Email] Attempting to send verification code to ${userEmail}...`);
    
    const { data, error } = await resend.emails.send({
      from: 'CommunityTalk <noreply@debugdragons.com>',
      to: [userEmail],
      subject: 'Your CommunityTalk Verification Code',
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
    });

    if (error) {
      throw error;
    }

    console.log(`✅ [Email] Verification code sent successfully to ${userEmail}`, {
      id: data.id
    });
  } catch (error) {
    console.error(`❌ [Email] FAILED to send verification code to ${userEmail}`);
    
    // Log the entire error object as JSON to see everything
    console.error(`❌ [Email] Full error object:`, JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    
    // Also log specific properties we care about
    console.error(`❌ [Email] Error details:`, {
      message: error.message,
      name: error.name,
      statusCode: error.statusCode,
      stack: error.stack?.substring(0, 300)
    });
    
    throw new Error(`Failed to send verification email: ${error.message}`);
  }
}
/**
 * Sends a verification email for new device sign-ins using Resend.
 * @param {string} userEmail - The user's email address.
 * @param {string} deviceModel - Information about the new device.
 * @param {string} verificationCode - The 6-digit OTP code.
 */
async function sendNewDeviceEmail(userEmail, deviceModel, verificationCode) {
  try {
    console.log(`📧 [Email] Sending New Device Verification to ${userEmail}...`);
    
    const { data, error } = await resend.emails.send({
      from: 'CommunityTalk Security <noreply@debugdragons.com>',
      to: [userEmail],
      subject: 'Unrecognized Device Sign-In Attempt',
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; text-align: center; padding: 20px;">
          <div style="border: 1px solid #ddd; border-radius: 10px; padding: 30px; max-width: 400px; margin: auto;">
            <h2 style="color: #D32F2F;">New Device Detected!</h2>
            <p style="color: #555;">A new device (${deviceModel || "Unknown Device"}) attempted to log into your CommunityTalk account.</p>
            <p style="color: #555;">To authorize this device, please enter the following verification code:</p>
            <p style="font-size: 36px; font-weight: bold; color: #D32F2F; letter-spacing: 5px; margin: 20px 0;">
              ${verificationCode}
            </p>
            <p style="color: #777; font-size: 14px;">This code will expire in 1 hour.</p>
            <p style="color: #555; font-size: 14px;">If you did not make this attempt, you can safely ignore this email.</p>
          </div>
        </div>
      `,
    });

    if (error) {
      throw error;
    }

    console.log(`✅ [Email] New device code sent successfully to ${userEmail}`, { id: data.id });
  } catch (error) {
    console.error(`❌ [Email] FAILED to send new device code to ${userEmail}`, error);
    throw new Error(`Failed to send verification email: ${error.message}`);
  }
}

module.exports = { sendVerificationEmail, sendNewDeviceEmail };