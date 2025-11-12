# Google Sheets Chat Logger

**The simplest way to log Shopify chat conversations!**

No backend, no email setup, no server deployment. Just a Google Sheet.

---

## 🚀 Quick Start

**Total setup time: 5 minutes**

1. Create a Google Sheet: https://sheets.google.com
2. Extensions → Apps Script
3. Paste code from `google-apps-script.js`
4. Deploy as Web App
5. Copy the Web App URL
6. Paste URL into `subscription-support-guide.liquid` (line 1968)
7. Done!

👉 **[See detailed setup guide →](SETUP.md)**

---

## 📊 What It Does

Every chat message from your Shopify store is automatically logged to a Google Sheet:

```
Timestamp          | Date       | Time     | Session ID    | Sender | Message              | Topic
2024-01-15 14:30:22| 2024-01-15 | 14:30:22 | session_123...| user   | Hello!              | -
2024-01-15 14:30:23| 2024-01-15 | 14:30:23 | session_123...| bot    | Hi! How can I help? | -
```

- **Color-coded** by sender (blue=user, gray=bot, yellow=system)
- **Searchable** - Find any conversation instantly
- **Filterable** - By date, session, sender, topic
- **Exportable** - Download as Excel, CSV, PDF
- **Shareable** - Collaborate with your team
- **Free** - Uses Google's free tier

---

## 📁 Files in This Directory

- **`google-apps-script.js`** - The script to paste into Google Apps Script
- **`SETUP.md`** - Detailed setup instructions with screenshots
- **`README.md`** - This file

---

## ✨ Features

### Core Features
- ✅ Real-time logging to Google Sheets
- ✅ Anonymous session tracking
- ✅ PII sanitization (emails, phones, credit cards)
- ✅ Automatic color coding by sender
- ✅ Auto-archive after 10,000 rows

### Optional Features
- 📧 Daily email summaries
- 📊 Built-in analytics functions
- 🔍 Search by session ID or date
- 🗂️ Automatic archiving

---

## 🆚 Why Choose This Over the Backend Solution?

| Feature | Google Sheets | Backend + Email |
|---------|---------------|-----------------|
| Setup time | ⚡ 5 min | ⏰ 30-60 min |
| Search/filter | ✅ Easy | ❌ Email only |
| Real-time access | ✅ Yes | ❌ Daily digest |
| Deployment | ✅ None needed | ❌ Vercel/AWS/etc |
| Email config | ✅ None needed | ❌ SMTP setup |
| Cost | 💰 FREE | 💰 FREE-$20/mo |
| Team access | ✅ Easy sharing | ❌ Forward emails |
| Export data | ✅ One click | ⚠️ Manual |

**Use Google Sheets if:**
- You want the simplest setup
- You need to search/filter logs
- You want team access
- You don't want to deploy a backend

**Use Backend + Email if:**
- You prefer email notifications
- You need more control over storage
- You want to integrate with other services
- You need database storage

---

## 🔒 Privacy & Security

**Anonymous Data Only:**
- No customer names
- No customer emails
- No customer IDs
- No order numbers
- Phone numbers automatically redacted
- Credit cards automatically redacted

**Access Control:**
- Only you can access the Google Sheet (unless you share it)
- Web App URL is hard to guess
- Optional: Add secret key authentication (see SETUP.md)

---

## 📖 Documentation

**[→ Full Setup Guide (SETUP.md)](SETUP.md)**

Includes:
- Step-by-step instructions
- Troubleshooting guide
- Security tips
- Advanced features
- FAQs

---

## 🎯 Example Use Cases

**Customer Support:**
```
Filter by date → See all chats from yesterday
Search "cancel" → Find all cancellation requests
Filter by topic → See all subscription questions
```

**Analytics:**
```
Count messages per day → Track chat volume
Group by session → Measure conversation length
Search keywords → Find common pain points
```

**Team Collaboration:**
```
Share sheet with support team
Add comments to important conversations
Create summaries on separate tabs
```

---

## 🛠️ Customization

Edit the Apps Script to customize:

**Change timezone (line 16):**
```javascript
TIMEZONE: 'America/Los_Angeles',  // PST instead of EST
```

**Change sheet name (line 15):**
```javascript
SHEET_NAME: 'Customer Chats',  // Custom name
```

**Change archive threshold (line 17):**
```javascript
MAX_ROWS: 5000,  // Archive after 5,000 rows instead of 10,000
```

**Add custom fields:**

In the script, add to headers array (line 34):
```javascript
const headers = [
  'Timestamp', 'Date', 'Time', 'Session ID', 'Sender', 'Message',
  'Topic', 'User Agent', 'Shop Domain',
  'Custom Field'  // Add your field
];
```

Then update rowData (line 75):
```javascript
const rowData = [
  fullTimestamp, dateStr, timeStr, data.sessionId, data.sender, data.message,
  data.topic || '', data.userAgent || '', data.shopDomain || '',
  data.customField || ''  // Add your field
];
```

---

## 📊 Sample Data

Here's what your sheet will look like after some chats:

| Timestamp | Date | Time | Session ID | Sender | Message | Topic |
|-----------|------|------|------------|--------|---------|-------|
| 2024-01-15 14:30:22 | 2024-01-15 | 14:30:22 | session_1705332622_abc123 | user | I need help with my order | - |
| 2024-01-15 14:30:23 | 2024-01-15 | 14:30:23 | session_1705332622_abc123 | bot | I'd be happy to help! What's your order number? | order_tracking |
| 2024-01-15 14:30:45 | 2024-01-15 | 14:30:45 | session_1705332622_abc123 | user | #1234 | order_tracking |
| 2024-01-15 14:30:46 | 2024-01-15 | 14:30:46 | session_1705332622_abc123 | bot | [ORDER_CARD_DISPLAYED] | order_tracking |

Notice how order details are redacted to `[ORDER_CARD_DISPLAYED]` for privacy.

---

## 🎉 Get Started Now

1. **[Read the setup guide →](SETUP.md)**
2. Set up your Google Sheet (5 minutes)
3. Start logging chats automatically!

Questions? Check the [troubleshooting section](SETUP.md#-troubleshooting) in SETUP.md

---

**Made for Shopify merchants who want simple, effective chat logging without the complexity of backend deployments.**
