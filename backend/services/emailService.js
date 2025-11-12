// backend/services/emailService.js
const nodemailer = require("nodemailer");

async function getTestTransporter() {
  let testAccount = await nodemailer.createTestAccount();
  console.log("====================================");
  console.log(" ETHEREAL TEST ACCOUNT CREATED");
  console.log(` User: ${testAccount.user}`);
  console.log(` Pass: ${testAccount.pass}`);
  console.log("====================================");
  return nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    secure: false,
    auth: { user: testAccount.user, pass: testAccount.pass },
  });
}

async function sendVerificationEmail(toEmail, code) {
  try {
    const transporter = await getTestTransporter();
    const info = await transporter.sendMail({
      from: '"CommunityTalk" <noreply@communitytalk.app>',
      to: toEmail,
      subject: "Your Verification Code",
      html: `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #ddd;">
          <h1 style="color: #333;">Welcome to CommunityTalk!</h1>
          <p style="font-size: 16px;">Here is your verification code:</p>
          <p style="font-size: 32px; font-weight: bold; letter-spacing: 4px; margin: 20px 0; background: #f4f4f4; padding: 10px; text-align: center;">
            ${code}
          </p>
          <p style="font-size: 14px; color: #777;">This code will expire in 15 minutes.</p>
        </div>
      `,
    });
    console.log("====================================");
    console.log(" ✅ EMAIL SENT! PREVIEW URL:");
    console.log(` ${nodemailer.getTestMessageUrl(info)}`);
    console.log("====================================");
  } catch (error) {
    console.error("❌ Error sending email:", error);
  }
}
module.exports = { sendVerificationEmail };