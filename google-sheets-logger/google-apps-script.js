/**
 * Google Apps Script - Chat Logger
 *
 * This script receives chat logs and appends them to a Google Sheet.
 * No backend server, no email setup - just a simple spreadsheet!
 *
 * SETUP INSTRUCTIONS:
 *
 * 1. Create a new Google Sheet: https://sheets.google.com
 *    Name it: "Chat Logs" or whatever you prefer
 *
 * 2. Open the sheet, click Extensions → Apps Script
 *
 * 3. Delete any existing code and paste this entire file
 *
 * 4. Click the "Deploy" button (top right) → New Deployment
 *    - Type: Web app
 *    - Description: Chat Logger
 *    - Execute as: Me
 *    - Who has access: Anyone
 *    - Click "Deploy"
 *
 * 5. Copy the Web App URL (looks like: https://script.google.com/macros/s/ABC123.../exec)
 *
 * 6. Paste that URL into your Shopify liquid file (line 1966)
 *    endpoint: 'YOUR_WEB_APP_URL_HERE'
 *
 * That's it! Chat logs will now appear in your Google Sheet automatically.
 */

// Configuration
const CONFIG = {
  SHEET_NAME: 'Chat Logs',  // Name of the sheet tab (will be created if it doesn't exist)
  TIMEZONE: 'America/New_York',  // Your timezone
  MAX_ROWS: 10000  // Archive old logs after this many rows
};

/**
 * Handle OPTIONS requests (CORS preflight)
 * This is required for browser requests to work
 */
function doOptions(e) {
  return createCorsResponse();
}

/**
 * Main function - handles incoming POST requests
 */
function doPost(e) {
  try {
    // Check if we have postData
    if (!e || !e.postData) {
      console.error('No postData received. Event object:', JSON.stringify(e));
      return createResponse(400, { error: 'No data received' });
    }

    // Parse incoming data
    let data;
    try {
      data = JSON.parse(e.postData.contents);
    } catch (parseError) {
      console.error('Failed to parse JSON:', parseError);
      console.error('Raw postData:', e.postData.contents);
      return createResponse(400, { error: 'Invalid JSON: ' + parseError.toString() });
    }

    // Validate required fields
    if (!data.sessionId || !data.sender || !data.message || !data.timestamp) {
      console.error('Missing required fields. Received data:', JSON.stringify(data));
      return createResponse(400, { error: 'Missing required fields' });
    }

    // Get or create the sheet
    const sheet = getOrCreateSheet(CONFIG.SHEET_NAME);

    // Append the log entry
    appendLog(sheet, data);

    console.log('Successfully logged message from:', data.sender);
    return createResponse(200, { success: true, message: 'Log stored' });

  } catch (error) {
    console.error('Error logging chat:', error);
    console.error('Stack trace:', error.stack);
    return createResponse(500, { error: error.toString() });
  }
}

/**
 * Handle GET requests - now used for logging to avoid CORS issues
 */
function doGet(e) {
  try {
    // If no parameters, return test message
    if (!e || !e.parameter || Object.keys(e.parameter).length === 0) {
      return ContentService
        .createTextOutput('Chat Logger is running! Send GET requests with query parameters to log chats.')
        .setMimeType(ContentService.MimeType.TEXT);
    }

    // Extract data from query parameters
    const data = {
      sessionId: e.parameter.sessionId,
      sender: e.parameter.sender,
      message: e.parameter.message,
      timestamp: e.parameter.timestamp,
      topic: e.parameter.topic || '',
      userAgent: e.parameter.userAgent || '',
      shopDomain: e.parameter.shopDomain || ''
    };

    // Validate required fields
    if (!data.sessionId || !data.sender || !data.message || !data.timestamp) {
      console.error('Missing required fields. Received data:', JSON.stringify(data));
      return createResponse(400, { error: 'Missing required fields' });
    }

    // Get or create the sheet
    const sheet = getOrCreateSheet(CONFIG.SHEET_NAME);

    // Append the log entry
    appendLog(sheet, data);

    console.log('Successfully logged message from:', data.sender);
    return createResponse(200, { success: true, message: 'Log stored' });

  } catch (error) {
    console.error('Error logging chat:', error);
    console.error('Stack trace:', error.stack);
    return createResponse(500, { error: error.toString() });
  }
}

/**
 * Get or create a sheet with headers
 */
function getOrCreateSheet(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);

  // Create sheet if it doesn't exist
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);

    // Add headers
    const headers = [
      'Timestamp',
      'Date',
      'Time',
      'Session ID',
      'Sender',
      'Message',
      'Topic',
      'User Agent',
      'Shop Domain'
    ];

    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

    // Format header row
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#4285f4')
      .setFontColor('#ffffff');

    // Set column widths
    sheet.setColumnWidth(1, 180); // Timestamp
    sheet.setColumnWidth(2, 100); // Date
    sheet.setColumnWidth(3, 80);  // Time
    sheet.setColumnWidth(4, 200); // Session ID
    sheet.setColumnWidth(5, 80);  // Sender
    sheet.setColumnWidth(6, 400); // Message
    sheet.setColumnWidth(7, 150); // Topic
    sheet.setColumnWidth(8, 120); // User Agent
    sheet.setColumnWidth(9, 200); // Shop Domain

    // Freeze header row
    sheet.setFrozenRows(1);
  }

  // Archive old logs if needed
  archiveOldLogsIfNeeded(sheet);

  return sheet;
}

/**
 * Append a log entry to the sheet
 */
function appendLog(sheet, data) {
  // Parse timestamp
  const timestamp = new Date(data.timestamp);

  // Format date and time
  const dateStr = Utilities.formatDate(timestamp, CONFIG.TIMEZONE, 'yyyy-MM-dd');
  const timeStr = Utilities.formatDate(timestamp, CONFIG.TIMEZONE, 'HH:mm:ss');
  const fullTimestamp = Utilities.formatDate(timestamp, CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss');

  // Prepare row data
  const rowData = [
    fullTimestamp,
    dateStr,
    timeStr,
    data.sessionId,
    data.sender,
    data.message,
    data.topic || '',
    data.userAgent || '',
    data.shopDomain || ''
  ];

  // Append to sheet
  sheet.appendRow(rowData);

  // Color code by sender
  const lastRow = sheet.getLastRow();
  const range = sheet.getRange(lastRow, 1, 1, rowData.length);

  if (data.sender === 'user') {
    range.setBackground('#e3f2fd');  // Light blue
  } else if (data.sender === 'bot') {
    range.setBackground('#f5f5f5');  // Light gray
  } else if (data.sender === 'system') {
    range.setBackground('#fff3cd');  // Light yellow
  }
}

/**
 * Archive old logs if sheet gets too large
 */
function archiveOldLogsIfNeeded(sheet) {
  const rowCount = sheet.getLastRow();

  if (rowCount > CONFIG.MAX_ROWS) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const archiveName = `${CONFIG.SHEET_NAME} - Archive ${new Date().toISOString().split('T')[0]}`;

    // Copy current sheet
    const archiveSheet = sheet.copyTo(ss);
    archiveSheet.setName(archiveName);

    // Clear old data from main sheet (keep headers)
    sheet.deleteRows(2, rowCount - 1);

    console.log(`Archived ${rowCount} rows to ${archiveName}`);
  }
}

/**
 * Create HTTP response
 * Note: Google Apps Script web apps handle CORS automatically when deployed as "Anyone"
 */
function createResponse(statusCode, data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Create CORS preflight response
 */
function createCorsResponse() {
  return ContentService
    .createTextOutput(JSON.stringify({success: true}))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * BONUS: Create a daily summary email (optional)
 *
 * To use this, go to Apps Script editor:
 * 1. Click the clock icon (Triggers)
 * 2. Add Trigger
 * 3. Function: sendDailySummary
 * 4. Event source: Time-driven
 * 5. Type: Day timer
 * 6. Time: 9am-10am (or whenever you want)
 */
function sendDailySummary() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);

  if (!sheet) return;

  // Get yesterday's date
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = Utilities.formatDate(yesterday, CONFIG.TIMEZONE, 'yyyy-MM-dd');

  // Get all data
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const rows = data.slice(1);

  // Filter for yesterday
  const yesterdayLogs = rows.filter(row => row[1] === yesterdayStr);

  if (yesterdayLogs.length === 0) {
    console.log('No chat logs for yesterday');
    return;
  }

  // Count sessions
  const sessions = new Set(yesterdayLogs.map(row => row[3]));

  // Build email
  const subject = `Chat Logs Summary - ${yesterdayStr}`;
  const body = `
    Chat Logs Summary for ${yesterdayStr}

    Total Messages: ${yesterdayLogs.length}
    Unique Sessions: ${sessions.size}
    Average Messages per Session: ${(yesterdayLogs.length / sessions.size).toFixed(1)}

    View full logs: ${SpreadsheetApp.getActiveSpreadsheet().getUrl()}

    First few messages:
    ${yesterdayLogs.slice(0, 10).map(row =>
      `[${row[2]}] ${row[4]}: ${row[5]}`
    ).join('\n')}

    ${yesterdayLogs.length > 10 ? `\n...and ${yesterdayLogs.length - 10} more messages` : ''}
  `;

  // Send email to yourself
  MailApp.sendEmail({
    to: Session.getActiveUser().getEmail(),  // Your Google account email
    subject: subject,
    body: body
  });

  console.log('Daily summary sent');
}

/**
 * BONUS: Search logs by session ID
 */
function searchBySession(sessionId) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
  const data = sheet.getDataRange().getValues();

  return data.filter(row => row[3] === sessionId);
}

/**
 * BONUS: Get logs for a specific date
 */
function getLogsByDate(dateStr) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
  const data = sheet.getDataRange().getValues();

  return data.filter(row => row[1] === dateStr);
}
