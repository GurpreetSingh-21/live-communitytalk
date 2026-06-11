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

// 🔒 F-46: Mask email for logs — never log full PII to stdout/CloudWatch
function maskEmail(email) {
  if (typeof email !== 'string' || !email.includes('@')) return '***';
  const [local, domain] = email.split('@');
  const visible = local.slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(2, local.length - 2))}@${domain}`;
}

/**
 * Sends a verification email to a new user using Resend.
 * @param {string} userEmail - The new user's email address.
 * @param {string} verificationCode - The 6-digit verification code.
 */
async function sendVerificationEmail(userEmail, verificationCode) {
  try {
    console.log(`📧 [Email] Sending verification code to ${maskEmail(userEmail)}...`);
    
    const { data, error } = await resend.emails.send({
      from: 'Campustry <noreply@debugdragons.com>',
      to: [userEmail],
      subject: 'Your Campustry Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; text-align: center; padding: 20px;">
          <div style="border: 1px solid #ddd; border-radius: 10px; padding: 30px; max-width: 400px; margin: auto;">
            <h2 style="color: #333;">Welcome to Campustry!</h2>
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

    console.log(`✅ [Email] Verification code sent to ${maskEmail(userEmail)}`, { id: data.id });
  } catch (error) {
    console.error(`❌ [Email] FAILED to send verification code to ${maskEmail(userEmail)}`);
    
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
    console.log(`📧 [Email] Sending New Device Verification to ${maskEmail(userEmail)}...`);
    
    const { data, error } = await resend.emails.send({
      from: 'Campustry Security <noreply@debugdragons.com>',
      to: [userEmail],
      subject: 'Unrecognized Device Sign-In Attempt',
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; text-align: center; padding: 20px;">
          <div style="border: 1px solid #ddd; border-radius: 10px; padding: 30px; max-width: 400px; margin: auto;">
            <h2 style="color: #D32F2F;">New Device Detected!</h2>
            <p style="color: #555;">A new device (${deviceModel || "Unknown Device"}) attempted to log into your Campustry account.</p>
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

    console.log(`✅ [Email] New device code sent to ${maskEmail(userEmail)}`, { id: data.id });
  } catch (error) {
    console.error(`❌ [Email] FAILED to send new device code to ${maskEmail(userEmail)}`, error.message);
    throw new Error(`Failed to send verification email: ${error.message}`);
  }
}

/**
 * Sends a password reset OTP email using Resend.
 * @param {string} userEmail - The user's email address.
 * @param {string} resetCode - The 6-digit OTP reset code.
 */
async function sendPasswordResetEmail(userEmail, resetCode) {
  try {
    console.log(`📧 [Email] Sending password reset code to ${maskEmail(userEmail)}...`);

    const { data, error } = await resend.emails.send({
      from: 'Campustry <noreply@debugdragons.com>',
      to: [userEmail],
      subject: 'Reset Your Campustry Password',
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; background: #f9fafb; padding: 40px 20px;">
          <div style="border: 1px solid #e5e7eb; border-radius: 16px; padding: 40px; max-width: 420px; margin: auto; background: #ffffff;">
            <div style="text-align: center; margin-bottom: 32px;">
              <div style="display: inline-block; background: #16a34a15; border-radius: 16px; padding: 16px; margin-bottom: 16px;">
                <span style="font-size: 36px;">🔑</span>
              </div>
              <h2 style="color: #111827; margin: 0; font-size: 24px;">Reset Your Password</h2>
            </div>
            <p style="color: #6b7280; text-align: center; margin-bottom: 8px;">Use the code below to reset your Campustry password:</p>
            <p style="font-size: 42px; font-weight: bold; color: #16a34a; letter-spacing: 8px; margin: 24px 0; text-align: center; background: #f0fdf4; padding: 20px; border-radius: 12px;">
              ${resetCode}
            </p>
            <p style="color: #9ca3af; font-size: 13px; text-align: center;">This code expires in <strong>15 minutes</strong>.</p>
            <p style="color: #9ca3af; font-size: 13px; text-align: center;">If you did not request a password reset, you can safely ignore this email — your account is secure.</p>
            <hr style="border: none; border-top: 1px solid #f3f4f6; margin: 24px 0;" />
            <p style="color: #d1d5db; font-size: 11px; text-align: center;">Campustry — The Verified Campus Network</p>
          </div>
        </div>
      `,
    });

    if (error) throw error;

    console.log(`✅ [Email] Password reset code sent to ${maskEmail(userEmail)}`, { id: data.id });
  } catch (error) {
    console.error(`❌ [Email] FAILED to send reset code to ${maskEmail(userEmail)}`, error.message);
    throw new Error(`Failed to send password reset email: ${error.message}`);
  }
}

module.exports = { sendVerificationEmail, sendNewDeviceEmail, sendPasswordResetEmail };