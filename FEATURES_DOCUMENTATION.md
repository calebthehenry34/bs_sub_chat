# Chat Enhancement Features Documentation

This document describes all the new features added to the subscription support chat system.

## Table of Contents

1. [Overview](#overview)
2. [Backend Features](#backend-features)
3. [Frontend Features](#frontend-features)
4. [API Endpoints](#api-endpoints)
5. [Configuration](#configuration)
6. [Integration Guide](#integration-guide)
7. [Security & Privacy](#security--privacy)

---

## Overview

The chat system has been significantly enhanced with the following capabilities:

### New Features

✅ **Chat Persistence** - Sessions persist across page reloads
✅ **Rate Limiting & Abuse Prevention** - Protects against spam and bots
✅ **GDPR Compliance Toolkit** - Data export, deletion, and consent management
✅ **Chat History for Returning Customers** - Personalized welcome back messages
✅ **Auto-Complete Suggestions** - Smart input suggestions as users type
✅ **Smart Quick Replies** - Context-aware quick action buttons
✅ **Shopify Order Lookup** - Look up orders by number
✅ **Subscription Management** - Pause/cancel/modify subscriptions via chat
✅ **Product Recommendations** - Personalized product suggestions
✅ **Loyalty Program Integration** - Check points and redeem rewards

---

## Backend Features

### 1. Chat Persistence & History Storage

**File:** `lib/storage.js`

Handles persistent storage of chat sessions with customer identification.

**Key Functions:**

```javascript
// Store a message with history tracking
await Storage.storeMessage({
  sessionId: 'session_123',
  customerId: 'customer@example.com',
  sender: 'user',
  message: 'Hello',
  timestamp: new Date().toISOString()
});

// Get customer's chat history
const history = await Storage.getCustomerHistory('customer@example.com', 100);
// Returns: { customerId, totalSessions, recentSessions, lastInteraction }

// Get last session for context
const lastSession = await Storage.getLastSession('customer@example.com');

// Store customer preferences
await Storage.storeCustomerData('customer@example.com', {
  preferences: { theme: 'dark' },
  gdprConsent: true
});
```

**Features:**
- Hashed customer IDs for privacy (SHA-256)
- Groups messages by session
- Tracks conversation history per customer
- Supports customer preferences and metadata

---

### 2. Rate Limiting & Abuse Prevention

**File:** `lib/rate-limiter.js`

Prevents spam, bot attacks, and abuse.

**Configuration:**

```javascript
const config = {
  windowMs: 60 * 1000,           // 1 minute window
  maxRequests: 30,               // 30 requests per minute
  maxMessagesPerSession: 100,    // 100 messages per session
  blacklistThreshold: 5,         // Blacklist after 5 violations
  cleanupInterval: 5 * 60 * 1000 // Cleanup every 5 minutes
};
```

**Features:**
- IP-based rate limiting
- Session message count limits
- Suspicious pattern detection (spam, URLs, repeated chars)
- Automatic blacklisting for repeated violations
- In-memory storage (upgrade to Redis for production)

**Usage:**

```javascript
// Check rate limit
const result = rateLimiter.checkRateLimit(ipAddress, { type: 'chat' });
if (!result.allowed) {
  // Return 429 error
}

// Detect abuse
const abuseCheck = rateLimiter.detectAbuse(message, metadata);
if (abuseCheck.suspicious && abuseCheck.riskScore > 60) {
  // Reject message
}
```

---

### 3. GDPR Compliance Toolkit

**File:** `lib/gdpr.js`

Comprehensive GDPR compliance tools.

**Features:**

**Data Export (Articles 15 & 20):**
```javascript
const exportResult = await GDPRCompliance.requestDataExport(email, {
  shopName: 'My Shop',
  contactEmail: 'support@example.com'
});
// Returns: Complete JSON export of all customer data
```

**Data Deletion (Article 17):**
```javascript
const deleteResult = await GDPRCompliance.requestDataDeletion(email, {
  requireVerification: true,
  verified: true,
  ipAddress: req.ip,
  reason: 'User requested'
});
// Permanently deletes all customer data
```

**Consent Management (Article 7):**
```javascript
// Update consent
await GDPRCompliance.updateConsent(email, {
  chatLogging: true,
  dataProcessing: true,
  marketing: false,
  thirdPartySharing: false
});

// Get consent status
const consent = await GDPRCompliance.getConsent(email);
```

**Privacy Policy Summary:**
```javascript
const policy = GDPRCompliance.getPrivacyPolicySummary({
  name: 'My Shop',
  email: 'privacy@example.com'
});
// Returns: Detailed privacy policy information
```

---

### 4. Shopify Integration

**File:** `lib/shopify.js`

Deep integration with Shopify for e-commerce features.

**Setup:**

```javascript
const shopify = new ShopifyIntegration({
  shopDomain: 'myshop.myshopify.com',
  accessToken: process.env.SHOPIFY_ACCESS_TOKEN,
  apiVersion: '2024-01'
});
```

**Order Lookup:**

```javascript
// Look up order by number
const result = await shopify.lookupOrder('#1234', 'customer@example.com');
if (result.found) {
  console.log(result.order);
  // Returns: orderNumber, status, total, items, etc.
}

// Get tracking information
const tracking = await shopify.getOrderTracking(orderId);
// Returns: tracking numbers, URLs, estimated delivery
```

**Subscription Management:**

```javascript
// Get subscriptions
const subs = await shopify.getSubscriptions('customer@example.com');

// Manage subscription
const result = await shopify.manageSubscription('pause', subscriptionId, {
  pauseUntil: '2025-12-01'
});

// Available actions:
// - pause, cancel, updateFrequency, updateAddress, updatePayment
```

**Product Recommendations:**

```javascript
const recommendations = await shopify.getRecommendations(
  'customer@example.com',
  { currentProduct: 'product_id_123' }
);
// Returns: Array of recommended products with images, prices, URLs
```

**Loyalty Program:**

```javascript
// Get points
const points = await shopify.getLoyaltyPoints('customer@example.com');
// Returns: { points: 1500, tier: 'Gold' }

// Redeem points
const redemption = await shopify.redeemPoints(
  'customer@example.com',
  1000,
  'discount'
);
// Returns: { discountCode: 'LOYALTY1234', discountValue: 10 }
```

---

### 5. Auto-Complete & Quick Replies

**File:** `lib/suggestions.js`

Intelligent suggestions and context-aware quick actions.

**Auto-Complete:**

```javascript
const suggestions = suggestionsEngine.getSuggestions('track my', 5);
// Returns: Array of matching suggestions with categories and icons
```

**Smart Quick Replies:**

```javascript
const quickReplies = await suggestionsEngine.getQuickReplies({
  lastIntent: 'subscription_info',
  customerEmail: 'customer@example.com',
  sessionId: 'session_123'
});
// Returns: Context-aware quick action buttons
```

**Follow-Up Questions:**

```javascript
const followUps = suggestionsEngine.getFollowUpQuestions('subscription_cancel');
// Returns: Array of relevant follow-up questions
```

---

## API Endpoints

All endpoints support CORS and include rate limiting.

### Chat History API

**Endpoint:** `/api/chat-history`

**GET - Retrieve History:**
```
GET /api/chat-history?customerId=customer@example.com&limit=100
```

**POST - Store Message:**
```javascript
POST /api/chat-history
{
  "sessionId": "session_123",
  "customerId": "customer@example.com",
  "sender": "user",
  "message": "Hello",
  "timestamp": "2025-11-15T10:00:00Z"
}
```

---

### GDPR API

**Endpoint:** `/api/gdpr`

**Export Data:**
```
POST /api/gdpr?action=export
{
  "email": "customer@example.com",
  "shopName": "My Shop"
}
```

**Delete Data:**
```
POST /api/gdpr?action=delete
{
  "email": "customer@example.com",
  "verified": true,
  "reason": "User request"
}
```

**Manage Consent:**
```
POST /api/gdpr?action=consent
{
  "email": "customer@example.com",
  "consent": {
    "chatLogging": true,
    "dataProcessing": true,
    "marketing": false
  }
}
```

**Get Privacy Policy:**
```
GET /api/gdpr?action=privacy-policy&shopName=MyShop
```

---

### Shopify API

**Endpoint:** `/api/shopify`

**Lookup Order:**
```
GET /api/shopify?action=lookup-order&orderNumber=1234&customerEmail=customer@example.com
```

**Track Order:**
```
GET /api/shopify?action=track-order&orderId=123456789
```

**Order History:**
```
GET /api/shopify?action=order-history&email=customer@example.com&limit=10
```

**Get Subscriptions:**
```
GET /api/shopify?action=subscriptions&email=customer@example.com
```

**Manage Subscription:**
```
POST /api/shopify?action=manage-subscription
{
  "subscriptionAction": "pause",
  "subscriptionId": "sub_123",
  "params": {
    "pauseUntil": "2025-12-01"
  }
}
```

**Get Recommendations:**
```
GET /api/shopify?action=recommendations&email=customer@example.com
```

**Get Loyalty Points:**
```
GET /api/shopify?action=loyalty-points&email=customer@example.com
```

**Redeem Points:**
```
POST /api/shopify?action=redeem-points
{
  "email": "customer@example.com",
  "points": 1000,
  "rewardType": "discount"
}
```

---

### Suggestions API

**Endpoint:** `/api/suggestions`

**Auto-Complete:**
```
GET /api/suggestions?action=autocomplete&input=track%20my&limit=5
```

**Quick Replies:**
```
POST /api/suggestions?action=quick-replies
{
  "lastIntent": "order_tracking",
  "email": "customer@example.com",
  "sessionId": "session_123"
}
```

**Follow-Up Questions:**
```
GET /api/suggestions?action=follow-up&intent=subscription_cancel
```

**Conversational Prompts:**
```
GET /api/suggestions?action=prompt&state=initial
```

---

### Session API

**Endpoint:** `/api/session`

**GET - Retrieve Session:**
```
GET /api/session?sessionId=session_123
```

**POST - Save Session:**
```
POST /api/session?sessionId=session_123
{
  "conversationContext": { "lastIntent": "order_tracking" },
  "customerEmail": "customer@example.com",
  "messages": [...]
}
```

**DELETE - Clear Session:**
```
DELETE /api/session?sessionId=session_123
```

---

## Frontend Integration

### Basic Setup

Add the chat enhancements script to your Shopify theme:

```html
<script src="{{ 'chat-enhancements.js' | asset_url }}"></script>

<script>
// Initialize with configuration
const chatEnhancements = new ChatEnhancements({
  backendUrl: 'https://your-backend.vercel.app',
  shopDomain: '{{ shop.domain }}',
  enablePersistence: true,
  enableAutoComplete: true,
  enableQuickReplies: true,
  enableHistory: true,
  enableShopify: true,
  enableGDPR: true
});

// Set customer email when user signs in
{% if customer %}
  chatEnhancements.setCustomerEmail('{{ customer.email }}');
{% endif %}

// Update context when intent is detected
function onIntentDetected(intent, metadata) {
  chatEnhancements.updateContext(intent, metadata);
}

// Hook up to existing chat functions
window.sendChatMessage = function(message) {
  // Your existing send logic
  // ...

  // Update context
  chatEnhancements.conversationContext.messages.push({
    sender: 'user',
    message: message,
    timestamp: new Date().toISOString()
  });
};
</script>
```

### Integration with Existing Chat

The enhancement module expects these functions to exist:

```javascript
// Required functions (implement in your theme):
window.restoreChatMessages(messages)   // Restore messages to UI
window.getChatMessages()               // Get current messages
window.addChatMessage(msg, sender, isHtml) // Add message to UI
window.addBotMessage(message)          // Add bot message
window.sendChatMessage(message)        // Send user message
```

---

## Configuration

### Environment Variables

Add these to your backend `.env` file:

```bash
# Email Configuration
EMAIL_TO=your-email@example.com
EMAIL_FROM=noreply@yourshop.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password

# Storage Paths
STORAGE_PATH=/tmp/chat-logs
HISTORY_PATH=/tmp/chat-history
CUSTOMER_DATA_PATH=/tmp/customer-data

# Shopify Configuration
SHOPIFY_SHOP_DOMAIN=yourshop.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_xxxxxxxxxxxxx
SHOPIFY_API_VERSION=2024-01

# GDPR
GDPR_SECRET=your-random-secret-key-here

# Timezone
TIMEZONE=America/New_York
```

### Shopify Access Token

To use Shopify integration features, you need a private app access token with these permissions:

- `read_orders` - For order lookup
- `read_customers` - For customer data
- `read_products` - For recommendations
- `read_fulfillments` - For tracking info

**Setup:**
1. Go to Shopify Admin > Apps > Develop apps
2. Create a private app
3. Set the required permissions
4. Copy the access token to `SHOPIFY_ACCESS_TOKEN`

---

## Security & Privacy

### Data Protection

1. **Customer IDs are hashed** using SHA-256 before storage
2. **No PII in logs** - existing sanitization remains active
3. **Rate limiting** prevents abuse and DoS attacks
4. **CORS protection** on all endpoints
5. **Input validation** on all user inputs

### GDPR Compliance

- ✅ **Right to Access** (Article 15) - Data export
- ✅ **Right to Erasure** (Article 17) - Data deletion
- ✅ **Right to Data Portability** (Article 20) - JSON export
- ✅ **Consent Management** (Article 7) - Granular consent
- ✅ **Privacy by Design** - Minimal data collection

### Data Retention

- **Chat logs:** 30 days (then archived)
- **Customer history:** Until deletion requested
- **Anonymous sessions:** 90 days
- **GDPR deletion logs:** 30 days (for compliance)

---

## Deployment

### 1. Install Dependencies

```bash
cd chat-logger-backend
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your settings
```

### 3. Deploy to Vercel

```bash
vercel deploy --prod
```

### 4. Update Frontend

Add the chat enhancements script to your Shopify theme and configure as shown above.

---

## Testing

### Test Rate Limiting

```bash
# Send 35 requests rapidly (should get rate limited after 30)
for i in {1..35}; do
  curl -X POST https://your-backend.vercel.app/api/index \
    -H "Content-Type: application/json" \
    -d '{"sessionId":"test","sender":"user","message":"test","timestamp":"2025-11-15T10:00:00Z"}'
done
```

### Test GDPR Export

```bash
curl -X POST https://your-backend.vercel.app/api/gdpr?action=export \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

### Test Order Lookup

```bash
curl "https://your-backend.vercel.app/api/shopify?action=lookup-order&orderNumber=1234&customerEmail=customer@example.com"
```

---

## Troubleshooting

### Rate Limiting Issues

If legitimate users are getting rate limited:

```javascript
// Adjust limits in lib/rate-limiter.js
const config = {
  windowMs: 60 * 1000,
  maxRequests: 50,  // Increase from 30
  // ...
};
```

### Shopify API Errors

- Verify access token has correct permissions
- Check API version compatibility (2024-01)
- Ensure shop domain is correct format

### Session Persistence Not Working

- Check localStorage is enabled
- Verify backend `/api/session` endpoint is accessible
- Check CORS headers are set correctly

---

## Performance Optimization

### Production Recommendations

1. **Use Redis for rate limiting**
   - Replace in-memory storage
   - Shared state across serverless instances

2. **Use PostgreSQL for storage**
   - Better than file system for production
   - Easier queries and analytics

3. **Enable caching**
   - Cache common suggestions
   - Cache product recommendations
   - Reduce OpenAI API calls

4. **CDN for frontend assets**
   - Serve chat-enhancements.js via CDN
   - Faster global load times

---

## Cost Estimates

### API Costs (per 1000 messages)

- **OpenAI (intent classification):** ~$0.15
- **Auto-complete suggestions:** Free (local processing)
- **Shopify API calls:** Free (no rate limits on private apps)
- **Storage (file system):** Free
- **Storage (PostgreSQL/Redis):** ~$0.01

### Total: ~$0.16 per 1000 messages

---

## Support

For questions or issues:

1. Check this documentation
2. Review code comments in source files
3. Check error logs in Vercel dashboard
4. Open an issue on GitHub

---

## License

MIT License - See LICENSE file for details

---

## Changelog

### Version 2.0.0 (2025-11-15)

**Added:**
- Chat persistence across page loads
- Rate limiting and abuse prevention
- GDPR compliance toolkit
- Chat history for returning customers
- Auto-complete suggestions
- Smart quick replies
- Shopify order lookup
- Subscription management
- Product recommendations
- Loyalty program integration

**Improved:**
- Better error handling
- Enhanced security
- More comprehensive logging
- Better documentation

**Breaking Changes:**
- New environment variables required
- New API endpoints (old endpoints still work)
- Frontend requires ChatEnhancements initialization
