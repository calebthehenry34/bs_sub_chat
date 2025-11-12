# Google Sheets Chat Logger - Setup Guide

Log all your Shopify chat conversations directly to a Google Sheet!

**✨ No backend, no email setup, no deployment needed - just 5 minutes of setup!**

---

## ✅ What You Get

- **Live chat logs** in a Google Sheet you can access anytime
- **Automatic formatting** - color-coded by sender (user/bot/system)
- **Searchable & filterable** - use Google Sheets' built-in tools
- **Anonymous** - no customer emails or PII stored
- **Free** - uses Google's free tier
- **Accessible anywhere** - view on phone, tablet, desktop
- **Shareable** - easily share the sheet with your team

---

## 📋 5-Minute Setup

### Step 1: Create a Google Sheet

1. Go to https://sheets.google.com
2. Click **+ Blank** to create a new spreadsheet
3. Name it **"Chat Logs"** (or whatever you prefer)
4. Leave it open - you'll need it in a moment

### Step 2: Add the Apps Script

1. In your Google Sheet, click **Extensions** → **Apps Script**
2. You'll see a code editor with some default code
3. **Delete all the existing code**
4. Open the file `google-sheets-logger/google-apps-script.js` from this repo
5. **Copy all the code** from that file
6. **Paste it** into the Apps Script editor
7. Click the **💾 Save** icon (or Ctrl/Cmd + S)
8. Name the project: **"Chat Logger"**

### Step 3: Deploy as Web App

1. In the Apps Script editor, click **Deploy** (top right) → **New deployment**
2. Click the gear icon ⚙️ → Select **Web app**
3. Fill in the settings:
   - **Description:** Chat Logger
   - **Execute as:** Me (your email)
   - **Who has access:** Anyone ⚠️ (this is necessary for your Shopify site to send logs)
4. Click **Deploy**
5. You may be prompted to authorize the app:
   - Click **Authorize access**
   - Choose your Google account
   - Click **Advanced** → **Go to Chat Logger (unsafe)** ← This is safe, it's your own script!
   - Click **Allow**
6. **Copy the Web App URL** - it looks like:
   ```
   https://script.google.com/macros/s/AKfycbz.../exec
   ```
   Keep this URL handy!

### Step 4: Update Shopify Theme

1. Open `subscription-support-guide.liquid` in your Shopify theme
2. Find line **1968** (search for `CHAT_LOG_CONFIG`)
3. Replace this:
   ```javascript
   endpoint: 'YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL',
   ```
   With this (paste your URL from Step 3):
   ```javascript
   endpoint: 'https://script.google.com/macros/s/AKfycbz.../exec',
   ```
4. Save the file
5. Deploy to Shopify

### Step 5: Test It!

1. Go to your Shopify store
2. Open the chat widget
3. Send a test message: "Hello, this is a test!"
4. Go back to your Google Sheet
5. **Refresh the page** - you should see a new row with your message! 🎉

---

## 📊 What the Spreadsheet Looks Like

Your Google Sheet will have these columns:

| Timestamp | Date | Time | Session ID | Sender | Message | Topic | User Agent | Shop Domain |
|-----------|------|------|------------|--------|---------|-------|------------|-------------|
| 2024-01-15 14:30:22 | 2024-01-15 | 14:30:22 | session_1705... | user | Hello! | - | Mozilla | myshop.com |
| 2024-01-15 14:30:23 | 2024-01-15 | 14:30:23 | session_1705... | bot | Hi! How can I help? | - | Mozilla | myshop.com |

**Color Coding:**
- 🔵 **Light Blue** - User messages
- ⚪ **Light Gray** - Bot messages
- 🟡 **Light Yellow** - System messages

---

## 🔍 Using Your Chat Logs

### Search for Specific Text

1. Press **Ctrl/Cmd + F** in Google Sheets
2. Type your search term
3. Google Sheets highlights all matches

### Filter by Date

1. Click on the **Date** column header (Column B)
2. Click the filter icon (funnel)
3. Choose "Filter by condition" → "Date is"
4. Select your date range

### Filter by Session

1. Click the **Session ID** column (Column D)
2. Click filter icon
3. Select specific sessions to view complete conversations

### View Specific Sender

1. Click the **Sender** column (Column E)
2. Filter by "user", "bot", or "system"

### Export Data

1. **File** → **Download** → Choose format:
   - Excel (.xlsx)
   - CSV (.csv)
   - PDF (.pdf)

---

## 🎯 Advanced Features (Optional)

### Daily Email Summary

Want an email summary of chat logs sent to you each day?

1. In the Apps Script editor, click the **⏰ clock icon** (Triggers)
2. Click **+ Add Trigger**
3. Settings:
   - Function to run: `sendDailySummary`
   - Event source: **Time-driven**
   - Type of time-based trigger: **Day timer**
   - Time of day: **9am to 10am** (or your preference)
4. Click **Save**

Now you'll get a daily email summary automatically!

### Share with Your Team

1. In Google Sheets, click **Share** (top right)
2. Add team members' emails
3. Choose permission level:
   - **Viewer** - can only view logs
   - **Commenter** - can add comments
   - **Editor** - can edit (be careful!)
4. Click **Send**

### Auto-Archive Old Logs

The script automatically archives logs when you hit 10,000 rows (configurable). It creates a new sheet tab called "Chat Logs - Archive YYYY-MM-DD" and clears the main sheet.

To change the limit, edit line 17 in the Apps Script:
```javascript
MAX_ROWS: 10000  // Change this number
```

### Create a Dashboard

Use Google Sheets' built-in charts:

1. Select your data
2. Click **Insert** → **Chart**
3. Choose chart type (pie chart for sender distribution, line chart for messages over time, etc.)
4. Customize as needed

---

## 🔧 Troubleshooting

### ❌ No logs appearing in sheet

**Check 1: Is the URL correct?**
- Verify you copied the **entire** Web App URL
- Make sure it ends with `/exec`
- No extra spaces or characters

**Check 2: Is the script deployed?**
- Go to Apps Script → Deploy → Manage deployments
- Verify deployment is active
- Status should be "Active"

**Check 3: Test the endpoint directly**

Open Terminal and run:
```bash
curl -X POST 'YOUR_WEB_APP_URL_HERE' \
  -H 'Content-Type: application/json' \
  -d '{
    "sessionId": "test123",
    "sender": "user",
    "message": "Test message",
    "timestamp": "2024-01-15T10:00:00Z",
    "topic": "test",
    "userAgent": "Test",
    "shopDomain": "test.com"
  }'
```

You should see: `{"success":true,"message":"Log stored"}`

If this works but Shopify doesn't log, check browser console for errors.

**Check 4: Browser console errors**

1. Open your Shopify store
2. Press **F12** to open DevTools
3. Go to **Console** tab
4. Try sending a chat message
5. Look for red errors related to `logChatMessageAnonymously`

### ❌ "Authorization required" error

This means the script needs permission:

1. Go to Apps Script editor
2. Click **Run** → **doPost** (the play button)
3. Click **Review permissions**
4. Choose your Google account
5. Click **Advanced** → **Go to Chat Logger**
6. Click **Allow**

### ❌ Logs are duplicated

This can happen if the script is called twice. Check:

1. Is `CHAT_LOG_CONFIG.enabled` set to `true` only once?
2. Are you calling the live site, not a preview/dev environment?

### ❌ Wrong timezone in logs

Update line 16 in the Apps Script:

```javascript
TIMEZONE: 'America/New_York',  // Change to your timezone
```

Common timezones:
- `America/New_York` - Eastern
- `America/Chicago` - Central
- `America/Denver` - Mountain
- `America/Los_Angeles` - Pacific
- `America/Phoenix` - Arizona
- `Europe/London` - UK
- `Europe/Paris` - Central Europe
- `Asia/Tokyo` - Japan

Full list: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones

---

## 🔒 Security & Privacy

### Is this secure?

**Yes, with caveats:**

✅ The Web App URL is hard to guess (contains random characters)
✅ Only anonymous data is sent (no customer PII)
✅ You control the Google Sheet (only you and who you share with can access)
✅ Data is encrypted in transit (HTTPS)

⚠️ The endpoint is publicly accessible (required for Shopify to send logs)
⚠️ If someone discovers your Web App URL, they could send fake logs

**To make it more secure:**

Add a secret key check in the Apps Script:

```javascript
function doPost(e) {
  const SECRET_KEY = 'your-secret-key-here';  // Change this!

  try {
    const data = JSON.parse(e.postData.contents);

    // Verify secret key
    if (data.secretKey !== SECRET_KEY) {
      return createResponse(401, { error: 'Unauthorized' });
    }

    // ... rest of code
  }
}
```

Then in your Shopify liquid file (line 1987), add:

```javascript
const anonymousLog = {
  secretKey: 'your-secret-key-here',  // Match the Apps Script
  sessionId: getAnonymousSessionId(),
  // ... rest of fields
};
```

### What data is stored?

- ✅ Anonymous session ID
- ✅ Message content (sanitized)
- ✅ Sender type (user/bot/system)
- ✅ Timestamp
- ✅ Topic
- ✅ Browser type (first part of user agent)
- ✅ Shop domain

**NOT stored:**
- ❌ Customer email
- ❌ Customer name
- ❌ Customer ID
- ❌ Order numbers
- ❌ Phone numbers (automatically redacted)
- ❌ Credit cards (automatically redacted)
- ❌ IP addresses

### Can I use this for GDPR compliance?

This tool is privacy-friendly, but:

- ⚠️ You should add a notice in your chat widget that conversations may be logged
- ⚠️ Messages are sanitized, but humans might still type personal info
- ⚠️ Consult a lawyer if GDPR compliance is critical for your business

---

## 📈 Comparing to Other Solutions

| Feature | Google Sheets | Backend + Email | Shopify App |
|---------|---------------|-----------------|-------------|
| Setup Time | 5 minutes | 30-60 minutes | Varies |
| Cost | FREE | FREE-$20/mo | $5-50/mo |
| Searchable | ✅ | ❌ (email only) | ✅ |
| Real-time | ✅ | ❌ (daily digest) | ✅ |
| No coding | ✅ | ❌ (deployment needed) | ✅ |
| No dependencies | ✅ | ❌ (SMTP, hosting) | ❌ (app install) |
| Shareable | ✅ | ❌ | ⚠️ (usually) |
| Export | ✅ | ⚠️ (manual) | ⚠️ (varies) |

**Winner: Google Sheets** for most use cases!

---

## 🚀 Next Steps

Now that you have chat logging set up:

1. **Monitor regularly** - Check your sheet daily for the first week
2. **Analyze trends** - What are customers asking about most?
3. **Improve responses** - Update bot responses based on common questions
4. **Train your team** - Share the sheet with support staff
5. **Set up alerts** - Use Google Sheets' notification rules to get alerts on specific keywords

---

## 💡 Tips & Best Practices

**Naming convention:**
- Keep the main sheet called "Chat Logs"
- Archived sheets will be named "Chat Logs - Archive 2024-01-15"

**Organization:**
- Use filters liberally to find specific conversations
- Create a separate tab for summaries/analysis
- Add comments to important conversations

**Backup:**
- Periodically export to CSV for backup
- Or set up automatic backups with Google Takeout

**Performance:**
- Google Sheets handles up to 10 million cells
- With 9 columns, that's ~1.1 million log entries
- For most stores, this is years of data!

**Sharing:**
- Give team members "Viewer" access, not "Editor"
- This prevents accidental deletions
- Commenters can still highlight important conversations

---

## 🤝 Support

Having issues?

1. Check the troubleshooting section above
2. Verify your Web App URL is correct
3. Test with curl (see troubleshooting)
4. Check browser console for errors
5. Review Apps Script execution logs (View → Executions)

---

## 🎉 You're Done!

Your chat logs are now flowing into Google Sheets automatically. Open your sheet anytime to see customer conversations!

**Bookmark your Google Sheet** for easy access:
- Click the ⭐ star icon in Chrome/Firefox
- Or use Ctrl/Cmd + D

Happy logging! 📊
