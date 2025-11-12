/**
 * Anonymous Chat Logger - Serverless Function
 *
 * This function receives anonymous chat logs from the Shopify theme
 * and stores them for daily email reports.
 *
 * Deploy to: Vercel, AWS Lambda, Netlify Functions, or Google Cloud Functions
 */

const fs = require('fs').promises;
const path = require('path');
const nodemailer = require('nodemailer');

// Configuration from environment variables
const CONFIG = {
  EMAIL_TO: process.env.EMAIL_TO || 'caleb@wild-inc.com',
  EMAIL_FROM: process.env.EMAIL_FROM || 'noreply@bluesky-cbd.com',
  SMTP_HOST: process.env.SMTP_HOST || 'smtp.gmail.com',
  SMTP_PORT: process.env.SMTP_PORT || 587,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  STORAGE_PATH: process.env.STORAGE_PATH || '/tmp/chat-logs',
  TIMEZONE: process.env.TIMEZONE || 'America/New_York'
};

/**
 * Main handler for serverless platforms
 */
async function handler(event, context) {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: getCorsHeaders(),
      body: ''
    };
  }

  // Only accept POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: getCorsHeaders(),
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Parse incoming chat log
    const chatLog = JSON.parse(event.body);

    // Validate required fields
    if (!chatLog.sessionId || !chatLog.sender || !chatLog.message || !chatLog.timestamp) {
      return {
        statusCode: 400,
        headers: getCorsHeaders(),
        body: JSON.stringify({ error: 'Missing required fields' })
      };
    }

    // Store the chat log
    await storeChatLog(chatLog);

    return {
      statusCode: 200,
      headers: getCorsHeaders(),
      body: JSON.stringify({ success: true, message: 'Chat log stored' })
    };
  } catch (error) {
    console.error('Error processing chat log:', error);
    return {
      statusCode: 500,
      headers: getCorsHeaders(),
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
}

/**
 * Store chat log to file system (or database in production)
 */
async function storeChatLog(chatLog) {
  // Create storage directory if it doesn't exist
  await fs.mkdir(CONFIG.STORAGE_PATH, { recursive: true });

  // Create daily log file
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const logFile = path.join(CONFIG.STORAGE_PATH, `chat-logs-${today}.jsonl`);

  // Append log entry (JSONL format - one JSON object per line)
  const logEntry = JSON.stringify(chatLog) + '\n';
  await fs.appendFile(logFile, logEntry);
}

/**
 * Send daily email report (called by cron job)
 */
async function sendDailyReport() {
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];

    const logFile = path.join(CONFIG.STORAGE_PATH, `chat-logs-${dateStr}.jsonl`);

    // Read chat logs
    let logs = [];
    try {
      const content = await fs.readFile(logFile, 'utf8');
      logs = content.trim().split('\n').map(line => JSON.parse(line));
    } catch (error) {
      console.log('No logs found for', dateStr);
      return;
    }

    if (logs.length === 0) {
      console.log('No chat logs to report for', dateStr);
      return;
    }

    // Generate email content
    const emailBody = generateEmailReport(logs, dateStr);

    // Send email
    const transporter = nodemailer.createTransporter({
      host: CONFIG.SMTP_HOST,
      port: CONFIG.SMTP_PORT,
      secure: false,
      auth: {
        user: CONFIG.SMTP_USER,
        pass: CONFIG.SMTP_PASS
      }
    });

    await transporter.sendMail({
      from: CONFIG.EMAIL_FROM,
      to: CONFIG.EMAIL_TO,
      subject: `Anonymous Chat Logs Report - ${dateStr}`,
      html: emailBody,
      text: emailBody.replace(/<[^>]*>/g, '') // Strip HTML for text version
    });

    console.log('Daily report sent successfully for', dateStr);

    // Archive or delete old log file
    const archiveFile = path.join(CONFIG.STORAGE_PATH, `archived-chat-logs-${dateStr}.jsonl`);
    await fs.rename(logFile, archiveFile);

  } catch (error) {
    console.error('Error sending daily report:', error);
    throw error;
  }
}

/**
 * Generate HTML email report
 */
function generateEmailReport(logs, date) {
  // Group logs by session
  const sessions = {};
  logs.forEach(log => {
    if (!sessions[log.sessionId]) {
      sessions[log.sessionId] = [];
    }
    sessions[log.sessionId].push(log);
  });

  const sessionCount = Object.keys(sessions).length;
  const messageCount = logs.length;

  let html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1 { color: #2c5aa0; border-bottom: 3px solid #2c5aa0; padding-bottom: 10px; }
    h2 { color: #555; margin-top: 30px; }
    .summary { background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0; }
    .summary-stat { display: inline-block; margin-right: 30px; }
    .summary-stat strong { color: #2c5aa0; font-size: 24px; }
    .session { background: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .session-header { font-weight: bold; color: #2c5aa0; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #eee; }
    .message { margin: 10px 0; padding: 10px; border-radius: 5px; }
    .message.user { background: #e3f2fd; border-left: 3px solid #2196F3; }
    .message.bot { background: #f5f5f5; border-left: 3px solid #757575; }
    .message.system { background: #fff3cd; border-left: 3px solid #ffc107; }
    .message-meta { font-size: 12px; color: #666; margin-bottom: 5px; }
    .message-text { margin-left: 10px; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; text-align: center; }
  </style>
</head>
<body>
  <h1>Anonymous Chat Logs Report</h1>
  <p><strong>Date:</strong> ${date}</p>

  <div class="summary">
    <div class="summary-stat">
      <strong>${sessionCount}</strong><br>
      <span>Chat Sessions</span>
    </div>
    <div class="summary-stat">
      <strong>${messageCount}</strong><br>
      <span>Total Messages</span>
    </div>
    <div class="summary-stat">
      <strong>${(messageCount / sessionCount).toFixed(1)}</strong><br>
      <span>Avg Messages/Session</span>
    </div>
  </div>

  <h2>Chat Sessions</h2>
`;

  // Add each session
  Object.entries(sessions).forEach(([sessionId, messages], index) => {
    const firstMessage = messages[0];
    const sessionStart = new Date(firstMessage.timestamp).toLocaleString();

    html += `
  <div class="session">
    <div class="session-header">
      Session ${index + 1} (${sessionId.substring(0, 20)}...)
      <br><small>Started: ${sessionStart} | Topic: ${firstMessage.topic || 'N/A'} | Domain: ${firstMessage.shopDomain}</small>
    </div>
`;

    messages.forEach(msg => {
      const time = new Date(msg.timestamp).toLocaleTimeString();
      html += `
    <div class="message ${msg.sender}">
      <div class="message-meta">
        <strong>${msg.sender.toUpperCase()}</strong> at ${time}
      </div>
      <div class="message-text">${escapeHtml(msg.message)}</div>
    </div>
`;
    });

    html += `  </div>\n`;
  });

  html += `
  <div class="footer">
    <p>This is an automated report of anonymous chat interactions.<br>
    No personally identifiable information (PII) is included in this report.</p>
  </div>
</body>
</html>
`;

  return html;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * Get CORS headers
 */
function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };
}

// Export handlers for different platforms
module.exports = { handler, sendDailyReport };

// For AWS Lambda direct invocation
exports.handler = handler;

// For local testing
if (require.main === module) {
  const testEvent = {
    httpMethod: 'POST',
    body: JSON.stringify({
      sessionId: 'session_test_123',
      sender: 'user',
      message: 'Hello, I need help with my subscription',
      timestamp: new Date().toISOString(),
      topic: 'subscription_management',
      userAgent: 'Mozilla',
      shopDomain: 'test.myshopify.com'
    })
  };

  handler(testEvent, {}).then(response => {
    console.log('Test response:', response);
  });
}
