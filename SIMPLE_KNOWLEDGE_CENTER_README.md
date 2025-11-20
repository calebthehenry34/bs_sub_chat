# Simple Knowledge Center - Tile Based

**Super simple. No complexity. Just tiles.**

## What This Is

A single Shopify section where you add tiles/cards that link to your content. Configure everything in the Shopify theme editor.

## Installation (2 Minutes)

1. **Shopify Admin** → **Online Store** → **Themes** → **Edit code**
2. **Sections** folder → **Add a new section**
3. Name it: `knowledge-center-tiles`
4. Copy/paste the entire `knowledge-center-tiles.liquid` file
5. **Save**

Done! Now add it to any page.

## How To Use

### Add The Section To A Page

1. Go to a page in your theme customizer
2. Click **Add section**
3. Select **Knowledge Center**
4. Configure settings
5. Add tiles (blocks)

### Add A Tile

1. In the section, click **Add block** → **Tile**
2. Fill in:
   - **Title**: "How to Track Orders"
   - **Description**: "Learn how to track your shipments"
   - **Link**: `/pages/track-orders` (or any URL)
   - **Image**: Upload an image
   - **Category**: "Tutorials"
   - **Required Tags**: Leave empty (or add `affiliates` for gated)
3. Save

### Configure Categories

In section settings:
```
Categories: Getting Started, Tutorials, FAQ, Troubleshooting, Affiliates
```

Visitors can filter by these categories.

### Configure Colors & Layout

All in the theme editor:
- Primary color
- Text colors
- Tile size
- Grid spacing
- Border radius
- Image aspect ratio

## Gated Access (Hide Content For Non-Members)

### How It Works

Each tile has a **Required Customer Tags** field. If you add tags like `affiliates`, only customers with that tag will see the tile.

### Setup

**1. Create Gated Tile:**
```
Title: Affiliate Marketing Guide
Link: /pages/affiliate-guide
Required Customer Tags: affiliates
```

**2. Tag Customers:**
- Shopify Admin → **Customers**
- Select customer
- Add tag: `affiliates`
- Save

**3. Result:**
- Customer WITH tag: Sees the tile
- Customer WITHOUT tag: Tile is hidden
- Not logged in: Tile is hidden

### Examples

| Use Case | Required Tags |
|----------|---------------|
| Public content | [leave empty] |
| Affiliates only | `affiliates` |
| VIP only | `vip` |
| Premium members | `premium` |
| Multiple tags | `affiliates, verified` |

## What You Can Link To

**Shopify Pages:**
```
Link: /pages/shipping-policy
```

**Blog Articles:**
```
Link: /blogs/news/article-name
```

**Products:**
```
Link: /products/product-name
```

**Collections:**
```
Link: /collections/all
```

**External URLs:**
```
Link: https://youtube.com/watch?v=...
```

**Videos (YouTube, Vimeo):**
```
Link: https://youtube.com/watch?v=abc123
```

**PDFs:**
```
Link: https://cdn.shopify.com/files/file.pdf
```

Literally any URL works!

## Example Setup

### Welcome Page With Categories

**Section Settings:**
- Welcome Title: "Help Center"
- Welcome Text: "How can we help you today?"
- Categories: "Getting Started, Account, Orders, Returns, Contact"
- Enable Search: ✓
- Enable Categories: ✓

### Tiles:

**Tile 1:**
- Title: "Track Your Order"
- Description: "Find out where your package is"
- Link: `/pages/track-orders`
- Image: [tracking icon]
- Category: "Orders"

**Tile 2:**
- Title: "Return Policy"
- Description: "Easy returns within 30 days"
- Link: `/pages/returns`
- Image: [return icon]
- Category: "Returns"

**Tile 3 (Gated):**
- Title: "Affiliate Dashboard"
- Description: "Track your commissions"
- Link: `/pages/affiliate-dashboard`
- Image: [dashboard icon]
- Category: "Contact"
- Required Tags: `affiliates`

**Tile 4:**
- Title: "Setup Guide Video"
- Description: "Watch our quick start video"
- Link: `https://youtube.com/watch?v=abc123`
- Image: [video thumbnail]
- Category: "Getting Started"

## Features

✅ **Search** - Real-time search by title/description
✅ **Filter** - Category buttons
✅ **Gated Access** - Hide tiles based on customer tags
✅ **Responsive** - Mobile-friendly grid
✅ **Images** - Add custom images to tiles
✅ **Links** - Link to anything (pages, external, videos)
✅ **Customizable** - Colors, sizes, layout all in theme editor
✅ **No Admin Tool** - Everything in Shopify theme customizer

## Styling

All styling is built-in and customizable via theme editor:

- **Colors**: Primary, heading, text, border
- **Layout**: Max width, padding, tile size, grid gap
- **Images**: Aspect ratio (16:9, 4:3, square, portrait)
- **Borders**: Border radius (0-20px)

## Tips

### Organize By Use Case

**Support Tiles:**
- "FAQ" → `/pages/faq`
- "Contact Us" → `/pages/contact`
- "Live Chat" → External chat URL

**Product Tiles:**
- "User Manual" → PDF link
- "Video Tutorial" → YouTube
- "Product Page" → `/products/item`

**Marketing Tiles:**
- "Blog" → `/blogs/news`
- "About Us" → `/pages/about`
- "Careers" → `/pages/careers`

### Use Good Images

- Size: 800x450px (16:9) or 600x600px (square)
- Icons or photos work great
- Use consistent style
- Compress for fast loading

### Write Clear Titles

✅ Good: "How to Track Your Order"
❌ Bad: "Tracking"

✅ Good: "Return Policy & Process"
❌ Bad: "Returns"

### Categories

Keep it simple:
- 3-6 categories max
- Clear names
- Group related content

## That's It!

No complexity. No admin tools. No backend. Just a simple section that displays tiles you configure in the Shopify theme editor.

**Add it to a page → Add tiles → Done.**
