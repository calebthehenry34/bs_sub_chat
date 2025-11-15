# Quick Start Guide - Chat Enhancements

Get all the new chat features up and running in 15 minutes!

## Prerequisites

- Node.js 14.x or higher
- A Vercel account (free tier works)
- A Shopify store with admin access
- Basic knowledge of environment variables

---

## Step 1: Backend Setup (5 minutes)

### 1.1 Install Dependencies

```bash
cd chat-logger-backend
npm install
```

This will install:
- nodemailer (email)
- @shopify/shopify-api (Shopify integration)
- express-rate-limit (rate limiting)
- jsonwebtoken (authentication)
- bcryptjs (password hashing)

### 1.2 Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```bash
# Required - Email for reports
EMAIL_TO=your-email@example.com
EMAIL_FROM=noreply@yourshop.com

# Required - SMTP (Gmail example)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-gmail@gmail.com
SMTP_PASS=your-app-password

# Required - Shopify
SHOPIFY_SHOP_DOMAIN=yourshop.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_xxxxxxxxxxxxx

# Optional - GDPR
GDPR_SECRET=generate-a-random-secret-key

# Optional - Storage (defaults to /tmp)
STORAGE_PATH=/tmp/chat-logs
HISTORY_PATH=/tmp/chat-history
CUSTOMER_DATA_PATH=/tmp/customer-data
```

### 1.3 Get Shopify Access Token

1. Go to Shopify Admin → Settings → Apps and sales channels
2. Click "Develop apps"
3. Click "Create an app"
4. Name it "Chat Integration"
5. Click "Configure Admin API scopes"
6. Select these scopes:
   - `read_orders`
   - `read_customers`
   - `read_products`
   - `read_fulfillments`
7. Click "Save"
8. Click "Install app"
9. Copy the "Admin API access token"
10. Paste it into `SHOPIFY_ACCESS_TOKEN` in `.env`

### 1.4 Deploy to Vercel

```bash
# Install Vercel CLI if you haven't
npm install -g vercel

# Deploy
cd chat-logger-backend
vercel deploy --prod
```

When prompted:
- Set up and deploy? **Y**
- Which scope? Choose your account
- Link to existing project? **N**
- Project name? **chat-logger-backend**
- Directory? **./chat-logger-backend** (press Enter)
- Override settings? **N**

After deployment:
1. Go to Vercel dashboard
2. Click on your project
3. Go to Settings → Environment Variables
4. Add all variables from your `.env` file
5. Redeploy: `vercel deploy --prod`

**Save your deployment URL:** `https://your-project.vercel.app`

---

## Step 2: Frontend Setup (5 minutes)

### 2.1 Upload JavaScript File

1. Go to Shopify Admin → Online Store → Themes
2. Click "Actions" → "Edit code"
3. Click "Assets"
4. Click "Add a new asset"
5. Upload `chat-enhancements.js`

### 2.2 Add to Theme

In your theme's main template file (usually `theme.liquid`), add before `</body>`:

```liquid
<script src="{{ 'chat-enhancements.js' | asset_url }}"></script>

<script>
// Initialize chat enhancements
const chatEnhancements = new ChatEnhancements({
  backendUrl: 'https://your-project.vercel.app', // YOUR VERCEL URL
  shopDomain: '{{ shop.domain }}',
  enablePersistence: true,
  enableAutoComplete: true,
  enableQuickReplies: true,
  enableHistory: true,
  enableShopify: true,
  enableGDPR: true
});

// If customer is logged in, set their email
{% if customer %}
  chatEnhancements.setCustomerEmail('{{ customer.email }}');
{% endif %}

// Integration with existing chat
// (Modify based on your current implementation)
const originalSendMessage = window.sendChatMessage;
window.sendChatMessage = function(message) {
  // Call original function
  if (originalSendMessage) {
    originalSendMessage(message);
  }

  // Update enhancements context
  chatEnhancements.conversationContext.messages.push({
    sender: 'user',
    message: message,
    timestamp: new Date().toISOString()
  });

  // Save session
  chatEnhancements.saveSession();
};
</script>
```

### 2.3 Save and Test

1. Click "Save"
2. Go to your store
3. Open the chat widget
4. Test the features!

---

## Step 3: Verify Everything Works (5 minutes)

### 3.1 Test Chat Persistence

1. Open chat widget
2. Type a message
3. Refresh the page
4. ✅ Message should still be there

### 3.2 Test Auto-Complete

1. Type "track my" in chat input
2. ✅ Should see suggestions dropdown

### 3.3 Test Quick Replies

1. Send a message about subscriptions
2. ✅ Should see quick action buttons appear

### 3.4 Test Order Lookup

1. Quick reply button "Track order" or type "Where is order #1234?"
2. ✅ Should fetch and display order info

### 3.5 Test Loyalty Points

1. Sign in as a customer
2. Click quick reply "Check points" or type "loyalty points"
3. ✅ Should display points and tier

### 3.6 Test GDPR Tools

1. Look for "Privacy & Data" button (top-right of chat)
2. Click it
3. ✅ Should see export/delete/consent options

---

## Common Issues & Fixes

### Issue: "Rate limit exceeded"

**Fix:** Adjust rate limits in `chat-logger-backend/lib/rate-limiter.js`:

```javascript
const config = {
  maxRequests: 50,  // Increase from 30
  // ...
};
```

Redeploy: `vercel deploy --prod`

### Issue: "Shopify API error"

**Fix:**
1. Verify access token in Vercel environment variables
2. Check scopes are correct
3. Make sure shop domain format: `yourshop.myshopify.com`

### Issue: Auto-complete not showing

**Fix:**
1. Check browser console for errors
2. Verify backend URL is correct
3. Test endpoint: `https://your-backend.vercel.app/api/suggestions?action=autocomplete&input=test`

### Issue: Session not persisting

**Fix:**
1. Check localStorage is enabled in browser
2. Verify CORS headers in backend responses
3. Test endpoint: `https://your-backend.vercel.app/api/session?sessionId=test123`

---

## Optional Enhancements

### Use PostgreSQL Instead of File Storage

1. Add Vercel Postgres:
   ```bash
   vercel postgres create
   ```

2. Update `lib/storage.js` to use Postgres instead of file system

### Use Redis for Rate Limiting

1. Add Vercel KV (Redis):
   ```bash
   vercel redis create
   ```

2. Update `lib/rate-limiter.js` to use Redis

### Enable Analytics

Track usage metrics:

```javascript
chatEnhancements.on('message', (msg) => {
  // Send to Google Analytics, Mixpanel, etc.
  gtag('event', 'chat_message', {
    intent: msg.intent,
    customer_type: msg.customerId ? 'returning' : 'new'
  });
});
```

---

## Feature Configuration

### Disable Specific Features

```javascript
const chatEnhancements = new ChatEnhancements({
  backendUrl: 'https://your-backend.vercel.app',
  enablePersistence: true,
  enableAutoComplete: true,
  enableQuickReplies: true,
  enableHistory: true,
  enableShopify: false,  // Disable if not using Shopify integration
  enableGDPR: true
});
```

### Customize Quick Replies

Edit `lib/suggestions.js` to add your own suggestions:

```javascript
this.templates = {
  subscription: [
    'Your custom suggestion here',
    // ...
  ]
};
```

### Customize Rate Limits

Edit `lib/rate-limiter.js`:

```javascript
this.config = {
  windowMs: 60 * 1000,      // Time window
  maxRequests: 30,          // Max requests per window
  blacklistThreshold: 5     // Violations before blacklist
};
```

---

## Testing Checklist

- [ ] Chat messages persist across page refresh
- [ ] Auto-complete shows suggestions
- [ ] Quick replies appear contextually
- [ ] Order lookup works
- [ ] Subscription info displays
- [ ] Loyalty points show correctly
- [ ] Product recommendations appear
- [ ] GDPR export downloads JSON file
- [ ] GDPR delete removes data
- [ ] Rate limiting blocks after 30 requests
- [ ] Email reports still work

---

## Next Steps

1. **Read Full Documentation:** See `FEATURES_DOCUMENTATION.md`
2. **Customize UI:** Match your brand colors and style
3. **Add Analytics:** Track feature usage
4. **Monitor Performance:** Check Vercel logs
5. **Gather Feedback:** Ask customers what they think!

---

## Support

**Questions?**
- Check `FEATURES_DOCUMENTATION.md` for detailed docs
- Review code comments in source files
- Check Vercel logs for errors

**Found a bug?**
- Open an issue on GitHub
- Include error messages and steps to reproduce

---

## What You Just Built

🎉 **Congratulations!** You now have:

- ✅ Persistent chat sessions
- ✅ Smart auto-complete
- ✅ Context-aware quick replies
- ✅ Full Shopify integration
- ✅ GDPR compliance tools
- ✅ Abuse prevention
- ✅ Customer chat history
- ✅ Loyalty program features
- ✅ Product recommendations

**Impact:**
- Faster customer support
- Better user experience
- Reduced support tickets
- Increased customer satisfaction
- Full GDPR compliance

Enjoy your enhanced chat system! 🚀
