import nodemailer from "nodemailer";
import "dotenv/config";

let cachedTransporter = null;

async function getTransporter() {
  if (cachedTransporter) return cachedTransporter;

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && user && pass) {
    cachedTransporter = nodemailer.createTransport({
      host,
      port: parseInt(process.env.SMTP_PORT || "587", 10),
      secure: process.env.SMTP_SECURE === "true" || process.env.SMTP_PORT === "465",
      auth: { user, pass },
    });
    return cachedTransporter;
  }

  // Fallback for development / testing when SMTP is not configured
  // Uses ethereal test account or json transport
  try {
    const testAccount = await nodemailer.createTestAccount();
    cachedTransporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    return cachedTransporter;
  } catch {
    // If network to ethereal fails, fallback to stream/logger transport
    cachedTransporter = nodemailer.createTransport({
      jsonTransport: true,
    });
    return cachedTransporter;
  }
}

/**
 * Sends a customized habit reminder email when the habit is not completed before deadline
 */
export async function sendHabitReminder({
  to,
  habitTitle,
  habitIcon = "🎯",
  streak = 0,
  deadlineTime = "20:00",
  customMessage = "",
  appUrl = process.env.FRONTEND_URL || "http://localhost:5173",
  isTest = false,
}) {
  if (!to || typeof to !== "string" || !to.includes("@")) {
    throw new Error("A valid recipient email address is required");
  }

  const transporter = await getTransporter();
  const fromAddress = process.env.SMTP_FROM || `"Aloft Habits" <reminders@aloft.local>`;

  const subject = isTest
    ? `[TEST] Habit Reminder: "${habitTitle}"`
    : `⚠️ Reminder: You haven't completed "${habitTitle}" today!`;

  const fallbackWarning =
    "You haven't done anything about your habit today! Complete it before the day ends to protect your streak.";
  const displayMessage = (customMessage && customMessage.trim()) || fallbackWarning;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #fff4f4; margin: 0; padding: 24px; color: #4a3535; }
    .container { max-width: 520px; margin: 0 auto; background: #ffffff; border: 2px solid #ffcbcb; border-radius: 24px; padding: 32px 24px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); }
    .header { text-align: center; margin-bottom: 24px; }
    .logo { display: inline-block; width: 44px; height: 44px; line-height: 44px; background: #ffcbcb; border-radius: 16px; font-size: 22px; font-weight: bold; }
    .title { font-size: 22px; font-weight: 700; margin: 12px 0 4px; color: #4a3535; }
    .subtitle { font-size: 13px; color: #8a6c6c; margin: 0; }
    .habit-card { background: #fff4f4; border: 2px solid #ffcbcb; border-radius: 18px; padding: 18px; margin: 20px 0; text-align: center; }
    .habit-icon { font-size: 36px; margin-bottom: 8px; }
    .habit-name { font-size: 18px; font-weight: bold; color: #4a3535; margin: 0; }
    .streak-badge { display: inline-block; background: #c9fdff; border: 1px solid #a8f5f7; color: #285558; font-size: 12px; font-weight: 600; padding: 4px 12px; border-radius: 999px; margin-top: 8px; }
    .warning-box { background: #fff1f2; border: 1.5px solid #fecdd3; border-radius: 16px; padding: 16px; margin: 20px 0; }
    .warning-title { font-size: 12px; font-weight: 700; text-transform: uppercase; color: #e11d48; letter-spacing: 0.5px; margin: 0 0 6px; }
    .warning-text { font-size: 14px; font-weight: 500; color: #881337; margin: 0; line-height: 1.5; white-space: pre-wrap; }
    .cta-container { text-align: center; margin-top: 28px; }
    .btn { display: inline-block; background: #ffa7a7; color: #ffffff !important; font-size: 14px; font-weight: 600; text-decoration: none; padding: 12px 28px; border-radius: 14px; box-shadow: 0 4px 12px rgba(255, 167, 167, 0.4); }
    .footer { text-align: center; margin-top: 24px; font-size: 11px; color: #8a6c6c; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">☁️</div>
      <h1 class="title">Aloft Habit Reminder</h1>
      <p class="subtitle">Daily deadline: ${deadlineTime}</p>
    </div>

    <div class="habit-card">
      <div class="habit-icon">${habitIcon}</div>
      <h2 class="habit-name">${habitTitle}</h2>
      <div class="streak-badge">🔥 Current Streak: ${streak} day${streak === 1 ? "" : "s"}</div>
    </div>

    <div class="warning-box">
      <div class="warning-title">Action Required</div>
      <p class="warning-text">${displayMessage}</p>
    </div>

    <div class="cta-container">
      <a href="${appUrl}" class="btn" target="_blank">Open Aloft & Check Off Habit</a>
    </div>

    <div class="footer">
      <p>You received this email because you configured a daily reminder in Aloft.</p>
    </div>
  </div>
</body>
</html>
`;

  const text = `
Aloft Habit Reminder
--------------------
Habit: ${habitIcon} ${habitTitle}
Streak: ${streak} days
Deadline: ${deadlineTime}

${displayMessage}

Open Aloft to check off your habit: ${appUrl}
`;

  const info = await transporter.sendMail({
    from: fromAddress,
    to,
    subject,
    text,
    html,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) {
    console.log(`[Habit Reminder Email Preview]: ${previewUrl}`);
  }

  return {
    success: true,
    messageId: info.messageId,
    previewUrl: previewUrl || null,
  };
}

export default {
  sendHabitReminder,
};
