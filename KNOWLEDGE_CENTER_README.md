# Knowledge Center Component

A comprehensive, responsive knowledge base system with gated access, media support, search functionality, and full theme customization for Shopify stores.

## Features

✅ **Multi-format Content Support**
- Rich text/HTML content
- Video embeds (YouTube, Vimeo, etc.)
- Images with captions
- Custom embeds

✅ **Gated Access Control**
- User tag-based access (e.g., affiliates, VIP, premium)
- Public/private articles
- Per-article access control
- Email-based specific access

✅ **Search & Discovery**
- Full-text search across titles, descriptions, and content
- Category-based filtering
- Tag-based organization
- Featured articles

✅ **Analytics**
- View tracking
- Popular articles
- User engagement metrics
- Time-series data

✅ **Theme Customization**
- Fully customizable colors
- Adjustable spacing and borders
- Custom fonts
- Responsive design
- Theme editor integration

✅ **Admin Interface**
- Easy article management
- WYSIWYG-style editing
- Media upload and management
- Category organization
- Access control settings

## Architecture

```
├── Backend (Node.js/Serverless)
│   ├── /api/knowledge-center.js    # API endpoint
│   └── /lib/knowledge-base.js      # Storage & business logic
│
├── Frontend (Vanilla JavaScript)
│   └── knowledge-center.js         # Main component class
│
├── Templates
│   ├── knowledge-center.liquid     # Shopify template
│   └── knowledge-center-admin.html # Admin interface
│
└── Documentation
    └── KNOWLEDGE_CENTER_README.md  # This file
```

## Installation

### Step 1: Deploy Backend

1. The backend is already part of your `chat-logger-backend` system
2. Deploy to Vercel (or your serverless provider):

```bash
cd chat-logger-backend
vercel --prod
```

3. Note your deployment URL (e.g., `https://your-backend.vercel.app`)

### Step 2: Upload Frontend to Shopify

1. In Shopify Admin, go to **Online Store → Themes → Actions → Edit code**
2. In the **Assets** folder, click **Add a new asset**
3. Upload `knowledge-center.js`
4. The file will be accessible at: `{{ 'knowledge-center.js' | asset_url }}`

### Step 3: Create Knowledge Center Page

**Option A: Using Template File**

1. In Shopify Theme Editor, go to **Templates**
2. Create a new template: **Add a new template → Page**
3. Name it `page.knowledge-center`
4. Paste the content from `knowledge-center.liquid`
5. Save the template

6. Create a new page in Shopify Admin:
   - **Online Store → Pages → Add page**
   - Title: "Knowledge Center"
   - Assign template: `page.knowledge-center`

**Option B: Using Section (Recommended for flexibility)**

1. Create a new section in **Sections** folder
2. Add the knowledge center container and script from the template
3. Add the section to any page via the theme customizer

### Step 4: Configure User Tags

The knowledge center uses Shopify customer tags for access control. To set up:

1. **Add tags to customers** in Shopify Admin:
   - Go to **Customers**
   - Select a customer
   - Add tags like: `affiliates`, `vip`, `premium`

2. **Configure automatic tagging** (optional):
   - Use Shopify Flow (Shopify Plus)
   - Use a third-party app
   - Use customer metafields

### Step 5: Configure Backend URL

Update the Liquid template with your backend URL:

```liquid
backendUrl: 'https://your-backend.vercel.app',
```

## Usage

### Basic Implementation

```html
<!-- Add container -->
<div id="knowledge-center-container"></div>

<!-- Load script -->
<script src="{{ 'knowledge-center.js' | asset_url }}"></script>

<!-- Initialize -->
<script>
  const knowledgeCenter = new KnowledgeCenter({
    backendUrl: 'https://your-backend.vercel.app',
    userEmail: '{{ customer.email }}',
    userTags: ['affiliates'], // User's access tags
    theme: {
      primaryColor: '#2563eb',
      secondaryColor: '#64748b'
    }
  });
</script>
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `backendUrl` | string | required | Your backend API URL |
| `userEmail` | string | null | Current customer email |
| `userTags` | array | [] | User's access tags |
| `containerId` | string | 'knowledge-center' | Container element ID |
| `enableSearch` | boolean | true | Enable search functionality |
| `enableCategories` | boolean | true | Show category filters |
| `enableAnalytics` | boolean | true | Track article views |
| `articlesPerPage` | number | 12 | Pagination size |
| `showFeaturedFirst` | boolean | true | Featured articles first |
| `theme.primaryColor` | string | '#2563eb' | Primary brand color |
| `theme.secondaryColor` | string | '#64748b' | Secondary text color |
| `theme.backgroundColor` | string | '#ffffff' | Background color |
| `theme.textColor` | string | '#1e293b' | Main text color |
| `theme.borderRadius` | string | '8px' | Border radius |
| `theme.fontFamily` | string | system | Font family |

### Theme Editor Integration

Add these settings to your `settings_schema.json`:

```json
{
  "name": "Knowledge Center",
  "settings": [
    {
      "type": "text",
      "id": "kc_backend_url",
      "label": "Backend URL",
      "default": "https://your-backend.vercel.app"
    },
    {
      "type": "color",
      "id": "kc_primary_color",
      "label": "Primary Color",
      "default": "#2563eb"
    },
    {
      "type": "color",
      "id": "kc_secondary_color",
      "label": "Secondary Color",
      "default": "#64748b"
    },
    {
      "type": "checkbox",
      "id": "kc_enable_search",
      "label": "Enable Search",
      "default": true
    }
  ]
}
```

Then use in your template:

```liquid
const knowledgeCenter = new KnowledgeCenter({
  backendUrl: '{{ settings.kc_backend_url }}',
  theme: {
    primaryColor: '{{ settings.kc_primary_color }}',
    secondaryColor: '{{ settings.kc_secondary_color }}'
  }
});
```

## Managing Content

### Using the Admin Interface

1. Open `knowledge-center-admin.html` in a browser
2. Enter your backend URL
3. Click "Refresh" to load articles
4. Create, edit, or delete articles

### Article Structure

```javascript
{
  title: "Article Title",
  description: "Short description for preview",
  content: {
    type: "rich",
    body: "<h2>Content</h2><p>HTML content...</p>",
    media: [
      {
        type: "video",
        url: "https://youtube.com/embed/...",
        caption: "Video description"
      },
      {
        type: "image",
        url: "https://cdn.shopify.com/...",
        alt: "Image description"
      }
    ]
  },
  category: "getting-started",
  tags: ["tutorial", "beginner"],
  access: {
    public: true,
    requiredTags: ["affiliates"], // Only users with 'affiliates' tag can view
    allowedCustomers: [] // Specific emails (optional)
  },
  metadata: {
    author: "Admin",
    featured: true,
    order: 0 // Lower numbers appear first
  }
}
```

### Categories

Default categories:
- 🚀 Getting Started
- 📚 Tutorials
- ❓ FAQ
- 🔧 Troubleshooting
- ⚡ Advanced
- 🎯 Affiliates (gated)

Edit categories in `/lib/knowledge-base.js` → `getAllCategories()`

## Access Control

### How It Works

1. **Public Articles**: Anyone can view (set `access.public = true`)
2. **Tag-based Access**: Only users with matching tags can view
3. **Specific Customers**: Restrict to specific email addresses

### Example: Affiliates-Only Article

```javascript
{
  title: "Affiliate Marketing Guide",
  access: {
    public: false,
    requiredTags: ["affiliates"],
    allowedCustomers: []
  }
}
```

Only customers with the `affiliates` tag can view this article.

### Setting Customer Tags in Shopify

**Method 1: Manual (Shopify Admin)**
1. Go to **Customers**
2. Click on a customer
3. In the "Tags" field, add: `affiliates`
4. Save

**Method 2: Automated (Shopify Flow - Plus only)**
```
Trigger: Customer created
Condition: Order total > $1000
Action: Add customer tag "vip"
```

**Method 3: API or App**
Use Shopify Admin API or apps like:
- Customer Tagger
- Auto Tags
- Custom app integration

### Checking Tags in Liquid

```liquid
{% if customer.tags contains 'affiliates' %}
  <script>
    userTags.push('affiliates');
  </script>
{% endif %}
```

## API Endpoints

All endpoints are at: `https://your-backend.vercel.app/api/knowledge-center`

### Get Articles

```javascript
GET /api/knowledge-center?action=get-articles&userTags=["affiliates"]&userEmail=customer@example.com

Response:
{
  "success": true,
  "articles": [...],
  "total": 15
}
```

### Get Single Article

```javascript
GET /api/knowledge-center?action=get-article&id=kb_123&userTags=["affiliates"]

Response:
{
  "success": true,
  "article": {...}
}

// Access Denied:
{
  "error": "Access denied",
  "requiredTags": ["affiliates"]
}
```

### Search

```javascript
GET /api/knowledge-center?action=search&query=shipping&userTags=[]

Response:
{
  "success": true,
  "results": [...],
  "total": 5,
  "query": "shipping"
}
```

### Track View

```javascript
POST /api/knowledge-center?action=track-view
Body: {
  "articleId": "kb_123",
  "userEmail": "customer@example.com",
  "userTags": ["affiliates"]
}
```

### Create Article (Admin)

```javascript
POST /api/knowledge-center?action=create-article
Body: {
  "article": {...}
}

Response:
{
  "success": true,
  "article": {...}
}
```

### Update Article (Admin)

```javascript
POST /api/knowledge-center?action=update-article
Body: {
  "id": "kb_123",
  "article": {...}
}
```

### Delete Article (Admin)

```javascript
POST /api/knowledge-center?action=delete-article
Body: {
  "id": "kb_123"
}
```

## Storage

Articles are stored in JSON files at:
- **Articles**: `/tmp/kb-articles/*.json`
- **Categories**: `/tmp/kb-categories/categories.json`
- **Analytics**: `/tmp/kb-analytics/views-YYYY-MM-DD.jsonl`

### Production Recommendations

For production, consider upgrading to a database:

**PostgreSQL (Recommended)**
```bash
vercel postgres create
```

Update `/lib/knowledge-base.js` to use Vercel Postgres SDK.

**MongoDB**
```javascript
// Use MongoDB Atlas or similar
const { MongoClient } = require('mongodb');
```

## Customization

### Custom Styling

Override CSS variables in your theme:

```css
.kc-container {
  --primary: #your-brand-color;
  --secondary: #your-secondary-color;
}
```

Or inject custom styles:

```javascript
const knowledgeCenter = new KnowledgeCenter({
  theme: {
    primaryColor: '#ff6b6b',
    secondaryColor: '#4ecdc4',
    fontFamily: 'Georgia, serif',
    borderRadius: '12px'
  }
});
```

### Custom Templates

Create custom article templates by modifying the `renderArticleView()` method:

```javascript
renderArticleView() {
  // Custom layout here
}
```

### Extending Functionality

Add custom methods:

```javascript
// Add to KnowledgeCenter class
async searchWithFilters(query, filters) {
  // Custom search logic
}
```

## Analytics

### View Article Analytics

```javascript
GET /api/knowledge-center?action=get-analytics&days=7

Response:
{
  "success": true,
  "analytics": {
    "totalViews": 150,
    "viewsByArticle": {
      "kb_123": 50,
      "kb_456": 30
    },
    "viewsByDay": {
      "2024-11-20": 25,
      "2024-11-19": 30
    },
    "popularArticles": [
      {
        "id": "kb_123",
        "title": "Getting Started",
        "views": 50
      }
    ]
  }
}
```

### Privacy

- User emails are SHA-256 hashed before storage
- GDPR-compliant data handling
- View data can be exported/deleted

## Troubleshooting

### Articles Not Loading

1. Check browser console for errors
2. Verify backend URL is correct
3. Test API directly: `curl https://your-backend.vercel.app/api/knowledge-center?action=get-articles`
4. Check CORS headers

### Access Denied Errors

1. Verify customer has required tags
2. Check tag spelling (case-sensitive)
3. Ensure `userTags` array is passed correctly
4. Test with `access.public = true`

### Styling Issues

1. Check for CSS conflicts with theme
2. Verify styles are injected (check `<head>` for `#knowledge-center-styles`)
3. Use browser dev tools to inspect elements
4. Try adding `!important` to custom styles

### Performance Issues

1. Enable caching (already built-in, 5-minute TTL)
2. Reduce `articlesPerPage` if too many articles
3. Optimize images (use CDN, compress)
4. Consider database upgrade for large datasets

## Security

### Rate Limiting

Built-in rate limiting:
- 30 requests per minute per IP
- Configurable in `/lib/rate-limiter.js`

### Authentication

Currently, admin endpoints are **unprotected**. For production:

1. Add authentication middleware:

```javascript
function requireAuth(req, res) {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}
```

2. Protect admin endpoints:

```javascript
case 'create-article':
  requireAuth(req, res);
  return await handleCreateArticle(req, res);
```

3. Set environment variable:

```bash
vercel env add ADMIN_API_KEY
```

### Input Validation

All user inputs are escaped to prevent XSS attacks. For additional security:

```javascript
const DOMPurify = require('isomorphic-dompurify');
article.content.body = DOMPurify.sanitize(article.content.body);
```

## Migration

### From Existing Knowledge Base

If you have existing articles in another format:

```javascript
// Example: Convert from JSON array
const existingArticles = [
  { title: 'Article 1', content: 'Content...' }
];

for (const article of existingArticles) {
  await fetch(`${backendUrl}/api/knowledge-center?action=create-article`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      article: {
        title: article.title,
        content: {
          type: 'rich',
          body: article.content,
          media: []
        },
        category: 'getting-started',
        tags: [],
        access: { public: true, requiredTags: [], allowedCustomers: [] },
        metadata: { author: 'Admin', featured: false, order: 999 }
      }
    })
  });
}
```

## Support

For issues, questions, or feature requests:
1. Check this documentation
2. Review the code comments
3. Test the admin interface at `knowledge-center-admin.html`
4. Contact your development team

## Changelog

### Version 1.0.0 (2024-11-20)
- Initial release
- Multi-format content support
- Gated access control
- Search and filtering
- Analytics tracking
- Theme customization
- Admin interface
- Shopify integration

## License

Part of the BS Sub Chat project. See main project license.

---

Built with ❤️ for better customer support and knowledge sharing.
