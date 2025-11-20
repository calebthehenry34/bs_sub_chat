# Knowledge Center for Shopify - SEO Optimized

The **SEO-optimized version** of the Knowledge Center uses **real Shopify Pages** for articles, giving you perfect SEO with individual URLs, proper meta tags, and full Google indexing.

## 🎯 Why This Version?

| Feature | SEO Version (Pages) | Simple Version (JSON) |
|---------|---------------------|----------------------|
| **Individual URLs** | ✅ `/pages/kb-article-name` | ❌ Shared page URL |
| **SEO Meta Tags** | ✅ Title, description, Open Graph | ⚠️ Limited |
| **Google Indexing** | ✅ Perfect | ⚠️ JavaScript-dependent |
| **Sitemap** | ✅ Automatic | ❌ Not included |
| **Rich Snippets** | ✅ Schema.org markup | ❌ No |
| **Social Sharing** | ✅ OG/Twitter cards | ❌ No |
| **Page Speed** | ✅ Fast | ✅ Fast |
| **Gated Content** | ✅ Customer tags | ✅ Customer tags |
| **Management** | Create in Shopify Admin | Admin HTML tool |
| **Best For** | SEO-focused, public KB | Quick setup, internal KB |

**Choose this version if:**
- You want Google to index your articles
- You need individual URLs for each article
- SEO is a priority
- You want proper social sharing
- You're okay with creating pages in Shopify Admin

## 📦 What's Included

| File | Description |
|------|-------------|
| `knowledge-center-seo.js` | Main JavaScript (loads articles from Shopify pages) |
| `knowledge-center-seo-section.liquid` | Section for the hub/index page |
| `page.kb-article.liquid` | Template for individual article pages |
| `knowledge-center-seo-admin.html` | Admin tool to generate article content |
| `KNOWLEDGE_CENTER_SEO_README.md` | This documentation |

## 🚀 Quick Start (15 Minutes)

### Step 1: Upload Files

1. **In Shopify Admin:** Online Store → Themes → Edit code

2. **Upload JavaScript:**
   - Go to **Assets** folder
   - Add new asset → Upload `knowledge-center-seo.js`

3. **Create Page Template:**
   - Go to **Templates** folder
   - Add new template → **Page**
   - Name it: `page.kb-article`
   - Paste content from `page.kb-article.liquid`
   - Save

4. **Create Section:**
   - Go to **Sections** folder
   - Add new section
   - Name it: `knowledge-center-seo`
   - Paste content from `knowledge-center-seo-section.liquid`
   - Save

### Step 2: Create Knowledge Center Hub Page

1. **In Shopify Admin:** Online Store → Pages → Add page

2. **Page Settings:**
   - **Title:** `Knowledge Center`
   - **Handle:** `knowledge-center` (important!)
   - **Content:** Leave empty or add intro text
   - **Visibility:** Visible
   - Save

3. **Add Section:**
   - In theme customizer, open the knowledge-center page
   - Add section → **Knowledge Center (SEO)**
   - Configure colors and settings
   - Save

### Step 3: Create Your First Article

1. **Open Admin Tool:**
   - Open `knowledge-center-seo-admin.html` in browser

2. **Fill in Article:**
   - Title: "How to Track Your Order"
   - Category: Tutorials
   - Content: Write your article in HTML
   - Tags: tracking, orders, shipping
   - Click **✨ Generate Shopify Page Content**

3. **Create Page in Shopify:**
   - Copy the generated content
   - In Shopify Admin: Online Store → Pages → Add page
   - **Title:** How to Track Your Order
   - **Handle:** `kb-how-to-track-your-order`
   - **Content:** Paste the generated content
   - **Template:** Select `page.kb-article` ⚠️ Important!
   - **SEO description:** First 155 characters of content
   - Save

4. **View Your Article:**
   - Visit `/pages/knowledge-center` to see it listed
   - Click to view the full article at `/pages/kb-how-to-track-your-order`

That's it! Your SEO-optimized knowledge center is live! 🎉

## 📝 Creating Articles

### Using the Admin Tool

The admin tool (`knowledge-center-seo-admin.html`) generates properly formatted content:

**Basic Fields:**
- **Title**: Article headline (becomes page title and H1)
- **Category**: Organize articles (getting-started, tutorials, faq, etc.)
- **Content**: Full HTML content
- **Tags**: For search and organization
- **Author**: Attribution
- **Featured**: Show first in lists
- **Order**: Display priority (lower = higher)
- **Required Tags**: For gated content (e.g., `affiliates`)

**HTML Formatting:**

```html
<h2>Main Section</h2>
<p>Paragraph with <strong>bold</strong> and <em>italic</em> text.</p>

<h3>Subsection</h3>
<ul>
  <li>Bullet point</li>
  <li>Another point</li>
</ul>

<ol>
  <li>Numbered item</li>
  <li>Another item</li>
</ol>

<!-- Images -->
<img src="https://cdn.shopify.com/s/files/..." alt="Description">

<!-- YouTube Videos -->
<iframe width="560" height="315" src="https://www.youtube.com/embed/VIDEO_ID" frameborder="0" allowfullscreen></iframe>

<!-- Vimeo Videos -->
<iframe src="https://player.vimeo.com/video/VIDEO_ID" width="640" height="360" frameborder="0" allowfullscreen></iframe>

<!-- Links -->
<a href="https://example.com">Link text</a>

<!-- Blockquotes -->
<blockquote>Important quote or callout</blockquote>

<!-- Code -->
<code>inline code</code>

<pre>
Multi-line code block
Line 2
Line 3
</pre>
```

### Article Metadata

The admin tool generates a metadata block that controls article behavior:

```html
<!--KB_METADATA
category: tutorials
tags: tracking, orders, shipping
featured: true
order: 1
required_tags: affiliates
author: Support Team
-->
```

This metadata is:
- Hidden from visitors (HTML comment)
- Parsed by the page template
- Used to control display and access

## 🗂️ Custom Categories

### Managing Categories

1. Open `knowledge-center-seo-admin.html`
2. Go to **Manage Categories** tab
3. Edit existing categories or add new ones
4. Each category needs:
   - **ID**: Unique identifier (e.g., `product-guides`)
   - **Name**: Display name (e.g., `Product Guides`)
   - **Icon**: Emoji (e.g., `📦`)
   - **Description**: Short description

### Export to Shopify

1. Click **📤 Generate Categories JSON**
2. Copy the JSON
3. In Shopify theme customizer:
   - Open Knowledge Center section settings
   - Find **Custom Categories (JSON)**
   - Paste the JSON
   - Save

**Example Categories JSON:**

```json
[
  {
    "id": "product-guides",
    "name": "Product Guides",
    "icon": "📦",
    "description": "Learn about our products"
  },
  {
    "id": "shipping",
    "name": "Shipping Info",
    "icon": "🚚",
    "description": "Delivery and tracking"
  },
  {
    "id": "returns",
    "name": "Returns & Refunds",
    "icon": "🔄",
    "description": "Return policy"
  }
]
```

## 🔒 Gated Content (Affiliates, VIP, etc.)

### How It Works

Articles can be restricted based on **Shopify customer tags**:

1. **In Article**: Set required_tags: `affiliates`
2. **In Shopify**: Add `affiliates` tag to customers
3. **Result**: Only tagged customers see the article

### Setting Up Gated Articles

**1. Create a Gated Article:**

In the admin tool:
- Fill in article details
- Set **Required Customer Tags** to: `affiliates`
- Generate and create the page in Shopify

**2. Tag Customers:**

In Shopify Admin:
- Go to **Customers**
- Select a customer
- Add tags: `affiliates`, `vip`, `premium`, etc.
- Save

**3. Test:**
- Log out
- Visit `/pages/knowledge-center`
- Article is hidden
- Log in as tagged customer
- Article appears!

### Common Access Patterns

| Use Case | Required Tag | Example |
|----------|--------------|---------|
| Affiliate partners | `affiliates` | Partner marketing guides |
| VIP customers | `vip` | Exclusive product info |
| Premium members | `premium` | Advanced tutorials |
| Wholesale buyers | `wholesale` | B2B pricing guides |
| Beta testers | `beta` | Unreleased features |

### Multiple Required Tags

Require multiple tags by comma-separating:

```
required_tags: affiliates, verified
```

Customer needs BOTH tags to view.

## 🎨 Theme Customization

All settings available in Shopify theme customizer:

### Colors
- **Primary Color**: Links, buttons, accents
- **Secondary Color**: Meta info, secondary text
- **Background Color**: Card backgrounds
- **Text Color**: Main content text

### Layout
- **Border Radius**: Card roundness (8px = rounded, 0px = square)
- **Spacing**: Base spacing unit
- **Section Margins**: Top/bottom spacing
- **Section Padding**: Left/right spacing

### Features
- **Enable Search**: Show/hide search bar
- **Enable Categories**: Show/hide category filters
- **Show Featured First**: Featured articles at top
- **Articles Per Page**: Pagination (6-24)

### Typography
- **Font Family**: CSS font-family value
- Examples:
  - System: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
  - Serif: `Georgia, serif`
  - Mono: `'Courier New', monospace`

## 🔍 SEO Features

Each article page includes:

### HTML Meta Tags

```html
<title>Article Title - Your Store</title>
<meta name="description" content="First 155 characters...">
<link rel="canonical" href="https://store.com/pages/kb-article">
```

### Open Graph (Facebook, LinkedIn)

```html
<meta property="og:title" content="Article Title">
<meta property="og:description" content="Description...">
<meta property="og:url" content="https://store.com/pages/kb-article">
<meta property="og:type" content="article">
```

### Twitter Cards

```html
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="Article Title">
<meta name="twitter:description" content="Description...">
```

### Schema.org Structured Data

```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Article Title",
  "author": { "@type": "Organization", "name": "Your Store" },
  "publisher": { ... },
  "datePublished": "2024-01-01T00:00:00Z",
  "dateModified": "2024-01-15T00:00:00Z"
}
```

### Additional SEO Benefits

✅ **Automatic Sitemap Inclusion**: Shopify adds pages to `sitemap.xml`
✅ **Fast Page Load**: No API calls, instant rendering
✅ **Mobile Optimized**: Responsive design, mobile-first
✅ **Crawlable Links**: Standard `<a href>` tags, no JavaScript routing
✅ **Image Alt Text**: Proper alt attributes for accessibility
✅ **Semantic HTML**: Proper heading hierarchy (H1, H2, H3)
✅ **Clean URLs**: SEO-friendly slugs

### Google Search Console

After setup:
1. Submit your sitemap: `https://yourstore.com/sitemap.xml`
2. Google will discover and index your KB pages
3. Monitor in Search Console → Coverage

## 📊 Bulk Operations

### Creating Multiple Articles

**Method 1: Batch in Admin Tool**
1. Create article → Generate content → Copy
2. Save to text file
3. Repeat for all articles
4. Bulk create pages in Shopify

**Method 2: Shopify CSV Import**
Not directly supported, but you can:
1. Use Shopify API
2. Or hire a developer for bulk import

### Updating Existing Articles

1. Edit the page in Shopify Admin
2. Update the content
3. Update the metadata block if needed
4. Save

### Backing Up Articles

**Export Method:**
1. Shopify Admin → Settings → Files → Export
2. Or use Shopify Admin API
3. Or manually copy content

## 🔧 Advanced Customization

### Custom Page Template Styling

Edit `page.kb-article.liquid` to customize article page styling:

```liquid
<style>
  .kb-article-container {
    max-width: 900px; /* Wider articles */
    font-size: 18px; /* Larger text */
  }

  .kb-article-title {
    color: #ff6b6b; /* Custom color */
    font-family: Georgia, serif; /* Different font */
  }
</style>
```

### Add Related Articles Section

Add to `page.kb-article.liquid` before `</div>` closing tag:

```liquid
<div class="kb-related-articles">
  <h3>Related Articles</h3>
  <!-- Add logic to show related articles by category or tags -->
</div>
```

### Add Breadcrumbs

```liquid
<nav class="breadcrumbs">
  <a href="/">Home</a> →
  <a href="/pages/knowledge-center">Knowledge Center</a> →
  <span>{{ page.title }}</span>
</nav>
```

### Add Print Stylesheet

```html
<style media="print">
  .kb-back-link,
  header,
  footer { display: none; }

  .kb-article-content {
    font-size: 12pt;
    color: black;
  }
</style>
```

## 🐛 Troubleshooting

### Articles Not Appearing in Knowledge Center

**Check:**
1. Page handle starts with `kb-` (or your custom prefix)
2. Page uses `page.kb-article` template
3. Page has the metadata block with `data-kb-article` attribute
4. Page is visible (not hidden)
5. Customer has required tags (if gated)

**Debug:**
- View page source, look for `data-kb-article` attribute
- Check browser console for JavaScript errors

### Access Denied for Articles

**Check:**
1. Customer is logged in
2. Customer has the required tags
3. Tags match exactly (case-sensitive)
4. Metadata block has correct `required_tags`

**Test:**
- Create a public article (no required_tags)
- View as guest to verify system works

### SEO: Pages Not Indexed

**Check:**
1. Pages are published (not drafts)
2. Pages are visible in navigation
3. Sitemap includes pages: `/sitemap.xml`
4. No `noindex` meta tag
5. robots.txt allows crawling

**Fix:**
- Submit sitemap to Google Search Console
- Request indexing for specific URLs
- Wait 1-2 weeks for Google to discover

### Styling Issues

**Check:**
1. Theme CSS conflicts
2. Browser dev tools (F12) for CSS issues
3. Template file has correct CSS

**Fix:**
- Add `!important` to styles in template
- Use more specific CSS selectors
- Check theme's global styles

### Slow Page Loads

**Optimize:**
1. Compress images before adding
2. Use external video embeds (YouTube, Vimeo)
3. Minimize inline styles
4. Use Shopify's CDN for images

## 📈 Best Practices

### Content Strategy

**✅ Do:**
- Write clear, descriptive titles (50-60 characters)
- Keep descriptions under 155 characters
- Use proper heading hierarchy (H2 → H3 → H4)
- Add alt text to all images
- Link to related articles
- Update content regularly
- Use simple, clear language

**❌ Don't:**
- Stuff keywords unnaturally
- Use duplicate titles
- Create thin/short content
- Ignore mobile users
- Skip image optimization

### SEO Optimization

1. **Title Format**: `[Main Topic] - [Secondary] | Store Name`
   - Good: "How to Track Orders - Shipping Guide | MyStore"
   - Bad: "Track | MyStore"

2. **Description**: Answer the searcher's question
   - Good: "Learn how to track your order with our step-by-step guide. Find tracking numbers, check delivery status, and get shipping updates."
   - Bad: "Tracking info."

3. **Headings**: Use questions as H2s
   - "How do I find my tracking number?"
   - "What if my tracking isn't updating?"

4. **Internal Linking**: Link between articles
   - "For more info, see our [Returns Policy] guide"

5. **Images**: Descriptive alt text
   - Good: `alt="Screenshot of order tracking page showing delivery status"`
   - Bad: `alt="image"`

### Organization

- **Use Categories**: Group related content
- **Tag Consistently**: Use standard tags across articles
- **Feature Important Articles**: Use featured flag for key content
- **Set Order**: Prioritize beginner content (lower order numbers)
- **Update Regularly**: Mark outdated info, refresh content

### Accessibility

- **Alt Text**: All images need descriptive alt text
- **Heading Order**: Don't skip levels (H2 → H4)
- **Link Text**: Descriptive ("Read our guide") not generic ("Click here")
- **Color Contrast**: Ensure text is readable
- **Keyboard Navigation**: Test with Tab key

## 🆚 Comparison: SEO vs Simple Version

Choose based on your needs:

### Choose SEO Version (This One) If:
- ✅ You want Google to index your articles
- ✅ Each article needs its own URL
- ✅ You want social sharing with proper previews
- ✅ SEO is important for your business
- ✅ You're okay creating pages in Shopify Admin
- ✅ You have external links pointing to articles

### Choose Simple Version If:
- ✅ Quick setup is priority (5 min vs 15 min)
- ✅ KB is for internal/customer-only use
- ✅ You want to manage everything in one tool
- ✅ You prefer JSON-based content management
- ✅ SEO doesn't matter (logged-in users only)
- ✅ You want bulk import/export via JSON

## 📚 Additional Resources

### Shopify Documentation
- [Creating Pages](https://help.shopify.com/en/manual/online-store/themes/theme-structure/templates)
- [Page Templates](https://shopify.dev/docs/themes/architecture/templates/page)
- [Customer Tags](https://help.shopify.com/en/manual/customers/customer-segmentation)
- [SEO Best Practices](https://help.shopify.com/en/manual/promoting-marketing/seo)

### SEO Tools
- [Google Search Console](https://search.google.com/search-console)
- [Google Page Speed Insights](https://pagespeed.web.dev/)
- [Schema Markup Validator](https://validator.schema.org/)
- [Open Graph Debugger](https://developers.facebook.com/tools/debug/)

### HTML/CSS Resources
- [MDN Web Docs](https://developer.mozilla.org/)
- [HTML5 Elements Reference](https://developer.mozilla.org/en-US/docs/Web/HTML/Element)
- [CSS-Tricks](https://css-tricks.com/)

## 🎓 Example Articles

### Example 1: Tutorial Article

```html
<!--KB_METADATA
category: tutorials
tags: tracking, orders, shipping, beginner
featured: true
order: 1
required_tags:
author: Support Team
-->

<h2>How to Track Your Order</h2>
<p>Tracking your order is easy! Follow these simple steps to see where your package is.</p>

<h3>Step 1: Find Your Order Number</h3>
<p>Your order number is in the confirmation email we sent you. It looks like this: <strong>#1234</strong></p>

<h3>Step 2: Go to Your Account</h3>
<ol>
  <li>Log in to your account</li>
  <li>Click "My Orders"</li>
  <li>Find your order in the list</li>
</ol>

<h3>Step 3: View Tracking Info</h3>
<p>Click on your order to see:</p>
<ul>
  <li>Tracking number</li>
  <li>Current status</li>
  <li>Estimated delivery date</li>
</ul>

<h2>Need Help?</h2>
<p>If you can't find your order, <a href="/pages/contact">contact our support team</a>.</p>
```

### Example 2: FAQ Article

```html
<!--KB_METADATA
category: faq
tags: returns, refunds, policy
featured: false
order: 10
required_tags:
author: Admin
-->

<h2>Returns & Refunds Policy</h2>
<p>We want you to love your purchase! Here's everything you need to know about returns.</p>

<h3>Can I return my order?</h3>
<p>Yes! We accept returns within <strong>30 days</strong> of delivery.</p>

<h3>What items can't be returned?</h3>
<ul>
  <li>Customized products</li>
  <li>Final sale items</li>
  <li>Opened beauty products</li>
</ul>

<h3>How do I start a return?</h3>
<ol>
  <li>Go to <a href="/pages/returns">our returns page</a></li>
  <li>Enter your order number and email</li>
  <li>Select items to return</li>
  <li>Print the return label</li>
</ol>

<h3>When will I get my refund?</h3>
<p>Refunds are processed within <strong>5-7 business days</strong> after we receive your return.</p>

<h2>Questions?</h2>
<p>Check out our <a href="/pages/kb-shipping-info">Shipping Info</a> or <a href="/pages/contact">contact us</a>.</p>
```

### Example 3: Gated Article (Affiliates Only)

```html
<!--KB_METADATA
category: affiliates
tags: affiliate, marketing, commission, partners
featured: true
order: 1
required_tags: affiliates
author: Partnerships Team
-->

<h2>Affiliate Marketing Guide</h2>
<p>Welcome to our affiliate program! This guide covers everything you need to succeed as a partner.</p>

<h3>Commission Structure</h3>
<p>You earn <strong>15% commission</strong> on all sales generated through your unique link.</p>

<h3>How to Promote</h3>
<ul>
  <li>Share your affiliate link on social media</li>
  <li>Write product reviews on your blog</li>
  <li>Create YouTube videos featuring our products</li>
  <li>Email your subscribers (with their consent)</li>
</ul>

<h3>Marketing Materials</h3>
<p>Download our <a href="/pages/affiliate-assets">marketing assets</a> including:</p>
<ul>
  <li>Product images</li>
  <li>Banner ads</li>
  <li>Logo files</li>
  <li>Email templates</li>
</ul>

<h3>Tracking Your Earnings</h3>
<p>Log in to your <a href="/pages/affiliate-dashboard">affiliate dashboard</a> to see:</p>
<ul>
  <li>Clicks on your links</li>
  <li>Conversions and sales</li>
  <li>Commission earned</li>
  <li>Payment history</li>
</ul>

<h2>Questions?</h2>
<p>Email our partnerships team at <a href="mailto:affiliates@yourstore.com">affiliates@yourstore.com</a></p>
```

## ✅ Setup Checklist

Before going live:

### Files Uploaded
- [ ] `knowledge-center-seo.js` uploaded to Assets
- [ ] `page.kb-article` template created in Templates
- [ ] `knowledge-center-seo` section created in Sections

### Pages Created
- [ ] Hub page created (`/pages/knowledge-center`)
- [ ] Section added to hub page
- [ ] At least 3 articles created for testing

### Configuration
- [ ] Colors customized to match brand
- [ ] Categories configured (custom or default)
- [ ] Page prefix set (default: `kb-`)

### SEO Setup
- [ ] Article titles are descriptive
- [ ] Meta descriptions under 155 characters
- [ ] Images have alt text
- [ ] Internal links between articles
- [ ] Sitemap submitted to Google

### Access Control (if using gated content)
- [ ] Customer tags created in Shopify
- [ ] Customers tagged appropriately
- [ ] Articles have correct required_tags
- [ ] Tested with tagged and untagged users

### Testing
- [ ] Hub page loads correctly
- [ ] Articles appear in list
- [ ] Search works
- [ ] Categories filter correctly
- [ ] Articles open and display properly
- [ ] Back button returns to hub
- [ ] Mobile responsive
- [ ] Gated content hides/shows correctly

### Analytics
- [ ] Google Search Console connected
- [ ] Sitemap verified
- [ ] Shopify Analytics tracking enabled

## 🎉 You're Ready!

Your SEO-optimized knowledge center is now live with:
- ✅ Individual URLs for each article
- ✅ Perfect Google indexing
- ✅ Rich social media previews
- ✅ Custom categories
- ✅ Gated content for affiliates/VIPs
- ✅ Full theme customization
- ✅ Mobile responsive design

**Next Steps:**
1. Create 5-10 core articles
2. Submit sitemap to Google
3. Share article URLs on social media
4. Monitor Search Console for indexing
5. Update articles based on customer questions

---

Made with ❤️ for better customer support and SEO. Each article is a real page with full SEO power.
