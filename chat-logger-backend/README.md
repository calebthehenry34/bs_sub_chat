# Anonymous Chat Logger Backend

This serverless function receives anonymous chat logs from your Shopify chat widget and sends daily email reports to `caleb@wild-inc.com`.

## Features

- ✅ **Anonymous logging** - No PII (emails, phone numbers, credit cards) stored
- ✅ **Daily email reports** - Automated digest of all chat sessions
- ✅ **Session tracking** - Groups messages by anonymous session ID
- ✅ **Easy deployment** - Works with Vercel, AWS Lambda, Netlify, or any Node.js serverless platform
- ✅ **Secure** - CORS-protected, validates inputs, sanitizes data

## Quick Start

### 1. Install Dependencies

```bash
cd chat-logger-backend
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your email settings:

```bash
cp .env.example .env
```

Edit `.env`:
```env
EMAIL_TO=caleb@wild-inc.com
EMAIL_FROM=noreply@bluesky-cbd.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-gmail-app-password
```

**Gmail Setup:**
1. Go to https://myaccount.google.com/apppasswords
2. Generate an "App Password" for "Mail"
3. Use that password in `SMTP_PASS`

### 3. Deploy to Vercel (Recommended)

Vercel is the easiest deployment option with built-in cron support.

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Set environment variables
vercel env add EMAIL_TO
vercel env add EMAIL_FROM
vercel env add SMTP_HOST
vercel env add SMTP_PORT
vercel env add SMTP_USER
vercel env add SMTP_PASS

# Deploy with environment variables
vercel --prod
```

After deployment, you'll get a URL like: `https://chat-logger-backend.vercel.app/api/index`

### 4. Set Up Daily Email Cron (Vercel)

Create `vercel.json`:

```json
{
  "functions": {
    "api/index.js": {
      "memory": 1024,
      "maxDuration": 10
    }
  },
  "crons": [{
    "path": "/api/cron-daily",
    "schedule": "0 9 * * *"
  }]
}
```

Create `api/cron-daily.js`:

```javascript
const { sendDailyReport } = require('../index');

module.exports = async (req, res) => {
  // Verify cron secret
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    await sendDailyReport();
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
```

### 5. Update Shopify Theme

In `subscription-support-guide.liquid`, update the endpoint URL (line 1966):

```javascript
const CHAT_LOG_CONFIG = {
  enabled: true,
  endpoint: 'https://YOUR-VERCEL-URL.vercel.app/api/index', // Replace with your deployed URL
  sessionId: null
};
```

## Alternative Deployments

### AWS Lambda

1. Install AWS CLI and configure credentials
2. Package the function:
   ```bash
   zip -r function.zip index.js node_modules package.json
   ```
3. Create Lambda function:
   ```bash
   aws lambda create-function \
     --function-name chat-logger \
     --runtime nodejs18.x \
     --handler index.handler \
     --zip-file fileb://function.zip \
     --role arn:aws:iam::YOUR-ACCOUNT:role/lambda-execution-role
   ```
4. Set up API Gateway to trigger the Lambda
5. Set up EventBridge rule for daily cron:
   ```bash
   aws events put-rule \
     --name daily-chat-report \
     --schedule-expression "cron(0 9 * * ? *)"
   ```

### Netlify Functions

1. Create `netlify.toml`:
   ```toml
   [build]
     functions = "functions"

   [[redirects]]
     from = "/api/*"
     to = "/.netlify/functions/:splat"
     status = 200
   ```

2. Move `index.js` to `functions/chat-logger.js`

3. Deploy:
   ```bash
   netlify deploy --prod
   ```

4. Set up scheduled function (requires Netlify Pro):
   - Go to Netlify Dashboard > Functions > Scheduled Functions
   - Add cron: `0 9 * * *`
   - Point to `cron-daily-report`

### Traditional Server (VPS, DigitalOcean, etc.)

1. Install Node.js on your server
2. Clone this directory to your server
3. Install dependencies: `npm install`
4. Set up systemd service or PM2 to run the API
5. Set up daily cron job:
   ```bash
   crontab -e
   # Add this line (runs daily at 9 AM):
   0 9 * * * /usr/bin/node /path/to/chat-logger-backend/cron-daily-report.js
   ```

## Testing

### Test Logging Endpoint

```bash
node index.js
```

Or with curl:

```bash
curl -X POST https://your-deployment-url.vercel.app/api/index \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "session_test_123",
    "sender": "user",
    "message": "Test message",
    "timestamp": "2024-01-15T10:30:00Z",
    "topic": "test",
    "userAgent": "Mozilla",
    "shopDomain": "test.myshopify.com"
  }'
```

### Test Daily Email

```bash
node cron-daily-report.js
```

## Email Report Format

The daily email includes:

- **Summary Statistics**
  - Total chat sessions
  - Total messages
  - Average messages per session

- **Individual Sessions**
  - Session ID (truncated for privacy)
  - Timestamp and topic
  - Full conversation transcript
  - Sender identification (user/bot/system)

## Data Privacy

This system is designed with privacy in mind:

- ❌ No customer emails stored
- ❌ No customer IDs stored
- ❌ No phone numbers stored
- ❌ No credit card numbers stored
- ✅ Only anonymous session IDs
- ✅ Message content sanitized
- ✅ PII automatically redacted

## Storage

By default, logs are stored in `/tmp/chat-logs` as JSONL files (one JSON object per line).

For production, consider upgrading to:
- **PostgreSQL** - Use `pg` package
- **MongoDB** - Use `mongodb` package
- **AWS S3** - Use `aws-sdk` package
- **Google Cloud Storage** - Use `@google-cloud/storage` package

## Monitoring

Check your serverless platform's logs:

**Vercel:**
```bash
vercel logs
```

**AWS Lambda:**
```bash
aws logs tail /aws/lambda/chat-logger --follow
```

**Netlify:**
- Dashboard > Functions > [your-function] > Logs

## Troubleshooting

### Email not sending

1. Check SMTP credentials are correct
2. For Gmail, ensure App Password is used (not regular password)
3. Check spam folder
4. Review serverless function logs

### Logs not being stored

1. Check `/tmp` permissions (may need different storage for some platforms)
2. Verify POST request is reaching the endpoint
3. Check CORS headers if browser shows errors

### Cron not running

1. Verify cron schedule syntax
2. Check timezone settings
3. Ensure cron secret/auth is configured
4. Review platform-specific cron documentation

## Cost Estimates

**Vercel (Recommended):**
- Free tier: 100GB bandwidth, 100GB-hours function execution
- Typical usage: FREE (well within limits)

**AWS Lambda:**
- Free tier: 1M requests/month, 400,000 GB-seconds compute
- Typical usage: $0-1/month

**Netlify:**
- Free tier: 125k requests/month
- Scheduled functions require Pro plan ($19/month)

## Support

For issues or questions:
- Check logs in your deployment platform
- Review error messages in browser console
- Test endpoint with curl
- Verify environment variables are set

## License

MIT
