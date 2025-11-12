# Quick Deployment Guide

Follow these steps to deploy the chat logger and start receiving daily email reports.

## Step 1: Deploy to Vercel (5 minutes)

### Option A: Deploy via Vercel CLI

```bash
# Install Vercel CLI (if not already installed)
npm install -g vercel

# Navigate to the backend directory
cd chat-logger-backend

# Install dependencies
npm install

# Login to Vercel
vercel login

# Deploy
vercel

# Follow prompts:
# - Set up and deploy? Yes
# - Which scope? Your account
# - Link to existing project? No
# - Project name? chat-logger-backend
# - Directory? ./
# - Override settings? No

# After deployment, set environment variables
vercel env add EMAIL_TO
# Enter: caleb@wild-inc.com

vercel env add EMAIL_FROM
# Enter: noreply@bluesky-cbd.com

vercel env add SMTP_HOST
# Enter: smtp.gmail.com

vercel env add SMTP_PORT
# Enter: 587

vercel env add SMTP_USER
# Enter: your Gmail address

vercel env add SMTP_PASS
# Enter: your Gmail App Password (see below)

vercel env add CRON_SECRET
# Enter: a random secret string (e.g., generate one at https://randomkeygen.com/)

# Deploy to production with env vars
vercel --prod
```

**Your endpoint URL will be:** `https://chat-logger-backend-XXXXX.vercel.app/api/index`

### Option B: Deploy via Vercel Website

1. Go to https://vercel.com
2. Click "Import Project"
3. Import from GitHub or upload the `chat-logger-backend` folder
4. Configure environment variables in dashboard:
   - `EMAIL_TO`: caleb@wild-inc.com
   - `EMAIL_FROM`: noreply@bluesky-cbd.com
   - `SMTP_HOST`: smtp.gmail.com
   - `SMTP_PORT`: 587
   - `SMTP_USER`: your-email@gmail.com
   - `SMTP_PASS`: your-app-password
   - `CRON_SECRET`: random-secret-string
5. Deploy

## Step 2: Set Up Gmail App Password

To send emails via Gmail:

1. Go to https://myaccount.google.com/apppasswords
2. Click "Select app" → Choose "Mail"
3. Click "Select device" → Choose "Other (Custom name)"
4. Enter "Chat Logger"
5. Click "Generate"
6. Copy the 16-character password
7. Use this password as `SMTP_PASS` (not your regular Gmail password)

**Alternative Email Providers:**

### SendGrid (Recommended for production)
- Sign up at https://sendgrid.com (Free tier: 100 emails/day)
- Get API key from Settings → API Keys
- Use these settings:
  ```
  SMTP_HOST=smtp.sendgrid.net
  SMTP_PORT=587
  SMTP_USER=apikey
  SMTP_PASS=your-sendgrid-api-key
  ```

### AWS SES
- Set up AWS SES and verify your domain
- Use SMTP credentials from AWS Console
- Settings: `email-smtp.us-east-1.amazonaws.com:587`

## Step 3: Update Shopify Theme

1. Open `subscription-support-guide.liquid`
2. Find line ~1966 (the `CHAT_LOG_CONFIG` section)
3. Replace the endpoint URL with your deployed Vercel URL:

```javascript
const CHAT_LOG_CONFIG = {
  enabled: true,
  endpoint: 'https://chat-logger-backend-XXXXX.vercel.app/api/index', // Your Vercel URL
  sessionId: null
};
```

4. Save and commit the file
5. Deploy to your Shopify store

## Step 4: Test the Setup

### Test 1: Chat Logging

1. Open your Shopify store
2. Start a chat conversation
3. Send a few messages
4. Check Vercel logs:
   ```bash
   vercel logs
   ```
5. You should see "Chat log stored" messages

### Test 2: Manual Email Report

Trigger the daily report manually to test email delivery:

```bash
# Get your deployed URL
vercel ls

# Call the cron endpoint (replace with your URL and CRON_SECRET)
curl -X POST https://chat-logger-backend-XXXXX.vercel.app/api/cron-daily \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Check your email (caleb@wild-inc.com) - you should receive a report!

### Test 3: Verify Cron Schedule

The cron job is configured to run daily at 9 AM UTC (4 AM EST / 1 AM PST).

To change the schedule:
1. Edit `vercel.json`
2. Modify the `schedule` field (uses cron syntax)
3. Redeploy: `vercel --prod`

Examples:
- `"0 9 * * *"` = 9 AM daily (current)
- `"0 17 * * *"` = 5 PM daily
- `"0 0 * * *"` = Midnight daily
- `"0 12 * * 1"` = Noon every Monday

## Step 5: Monitor and Maintain

### View Logs

```bash
vercel logs --follow
```

Or view in Vercel Dashboard → Your Project → Logs

### Check Cron Execution

Vercel Dashboard → Your Project → Deployments → Cron Logs

### Update Environment Variables

```bash
vercel env rm SMTP_PASS
vercel env add SMTP_PASS
vercel --prod
```

## Troubleshooting

### No emails received

1. **Check spam folder**
2. **Verify SMTP credentials:**
   ```bash
   vercel env ls
   ```
3. **Check cron execution logs** in Vercel Dashboard
4. **Test manual trigger:**
   ```bash
   curl -X POST https://YOUR-URL.vercel.app/api/cron-daily \
     -H "Authorization: Bearer YOUR_CRON_SECRET"
   ```

### Chat logs not being captured

1. **Check browser console** for errors
2. **Verify endpoint URL** in liquid file matches Vercel deployment
3. **Check CORS issues** - Vercel logs will show rejected requests
4. **Test endpoint directly:**
   ```bash
   curl -X POST https://YOUR-URL.vercel.app/api/index \
     -H "Content-Type: application/json" \
     -d '{"sessionId":"test","sender":"user","message":"test","timestamp":"2024-01-15T10:00:00Z","topic":"test","userAgent":"test","shopDomain":"test.com"}'
   ```

### Logs are being stored but no email

1. **Check you have messages from yesterday** (script emails previous day's logs)
2. **Verify email configuration** is correct
3. **Check Vercel function logs** for SMTP errors
4. **Try SendGrid** instead of Gmail (more reliable for automated emails)

## Cost Monitoring

Vercel free tier includes:
- ✅ 100GB bandwidth/month
- ✅ 100GB-hours serverless execution
- ✅ Unlimited cron jobs

For a typical Shopify chat:
- 100 chat sessions/day = ~3,000/month
- Each session: ~10 messages = 30,000 logs/month
- Storage: ~10 MB/month
- Bandwidth: <1 GB/month
- **Cost: FREE**

## Support

Questions? Check:
- Vercel Documentation: https://vercel.com/docs
- Nodemailer Docs: https://nodemailer.com/
- This project's README.md

## Next Steps

Want to enhance the system? Consider:

1. **Add database storage** (PostgreSQL, MongoDB)
2. **Add Slack notifications** instead of email
3. **Add analytics dashboard** (visualize chat trends)
4. **Add sentiment analysis** (analyze customer mood)
5. **Add keyword alerts** (notify on specific phrases)

Happy logging! 🎉
