# Simple Knowledge Center - Tile Based

**Super simple. No complexity. Just tiles.**

## What This Is

A single Shopify section where you add tiles/cards. Each tile can either:
1. **Have rich-text content** (expands when clicked)
2. **Link to a URL** (navigates to page/video/PDF)

Configure everything in the Shopify theme editor.

## Installation (2 Minutes)

1. **Shopify Admin** → **Online Store** → **Themes** → **Edit code**
2. **Sections** folder → **Add a new section**
3. Name it: `knowledge-center-tiles`
4. Copy/paste the entire `knowledge-center-tiles.liquid` file
5. **Save**

Done! Now add it to any page.

## How Tiles Work

### Option 1: Expandable Tile (With Rich-Text Content)

Add content in the **Content (Rich Text)** field:
- Tile shows with a **+ icon** in the corner
- Click tile → Content expands below
- Click again → Collapses
- Perfect for FAQs, guides, tutorials

**Example:**
```
Title: How to Track Your Order
Description: Find out where your package is
Content: [Add rich text with steps, images, videos]
Category: FAQ
```

Result: Click tile → Full guide expands below with formatting

### Option 2: Link Tile (Navigates to URL)

Leave **Content** empty, add a **Link**:
- Tile shows with **↗ arrow icon** in the corner
- Click tile → Navigates to URL
- Perfect for external pages, videos, PDFs

**Example:**
```
Title: Video Tutorial
Description: Watch our setup guide
Link: https://youtube.com/watch?v=abc123
Category: Tutorials
```

Result: Click tile → Opens YouTube video

## Features

✅ **Rich-Text Content** - Add formatted text, images, lists, links
✅ **Expandable Tiles** - Content appears below when clicked
✅ **Link Tiles** - Navigate to any URL (with arrow icon)
✅ **Search** - Real-time search by title/description
✅ **Filter** - Category buttons
✅ **Gated Access** - Hide tiles based on customer tags
✅ **Responsive** - Mobile-friendly, content adapts
✅ **Images** - Add custom images to tiles
✅ **Customizable** - Colors, sizes, layout via theme editor

## Add A Tile

1. In the section, click **Add block** → **Tile**
2. Fill in:
   - **Title**: "How to Track Orders"
   - **Description**: "Learn how to track your shipments"
   - **Content**: [Add rich text] OR leave empty
   - **Link**: Leave empty OR add URL (only if Content is empty)
   - **Image**: Upload an image
   - **Category**: "Tutorials"
   - **Required Tags**: Leave empty (or add `affiliates` for gated)
3. Save

## Examples

### Example 1: FAQ (Expandable)

```
Title: What is your return policy?
Description: Learn about our 30-day return policy
Content (Rich Text):
  We accept returns within 30 days of delivery.

  Items must be:
  • Unused and in original packaging
  • Include all original tags
  • Not on final sale

  To start a return:
  1. Log in to your account
  2. Go to Orders
  3. Click "Return Item"

Link: [leave empty]
Category: FAQ
Required Tags: [leave empty - public]
```

**Result:** Click tile → Policy expands below with full details

### Example 2: Video Link

```
Title: Setup Guide Video
Description: Watch our quick start guide
Content: [leave empty]
Link: https://youtube.com/watch?v=abc123
Image: [video thumbnail]
Category: Getting Started
Required Tags: [leave empty - public]
```

**Result:** Click tile → Opens YouTube video (arrow icon visible)

### Example 3: Affiliate Guide (Gated + Expandable)

```
Title: Affiliate Marketing Guide
Description: Exclusive guide for our partners
Content (Rich Text):
  Welcome to our affiliate program!

  Commission Structure:
  • 15% on all sales
  • 20% for top performers

  Marketing Materials:
  Download our assets [link]

Link: [leave empty]
Category: Affiliates
Required Tags: affiliates
```

**Result:**
- Only customers with `affiliates` tag see this tile
- Click tile → Guide expands with full content

### Example 4: External Resource Link

```
Title: Product Manual (PDF)
Description: Download the complete manual
Content: [leave empty]
Link: https://cdn.shopify.com/files/manual.pdf
Category: Getting Started
```

**Result:** Click tile → Downloads PDF (arrow icon visible)

## Gated Access (Hide Content For Non-Members)

### How It Works

Set **Required Customer Tags** on any tile. Only customers with those tags will see it.

### Setup

**1. Create Gated Tile:**
```
Title: Affiliate Dashboard
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
| Requires multiple tags | `affiliates, verified` |

## Visual Indicators

### Expandable Tiles (With Content)
- Shows **+ icon** (blue circle) in top-right corner
- Click to expand → icon rotates to ×
- Content appears below tile
- Fully responsive on mobile

### Link Tiles (External URLs)
- Shows **↗ arrow icon** (blue circle) in top-right corner
- Indicates "will navigate away"
- Hovering moves arrow slightly
- Opens in same or new tab (browser default)

### No Icon
- If tile has neither content nor link
- Just displays as a card (no interaction)

## Rich-Text Formatting

The **Content** field supports:
- **Headings** (H2, H3, H4)
- **Bold** and *italic* text
- Bullet lists
- Numbered lists
- Links
- Images
- Line breaks
- Paragraphs

**Pro tip:** Use Shopify's rich-text editor for easy formatting!

## Responsive Design

### Desktop
- Grid layout (3-4 tiles per row depending on size)
- Expanded content appears below tile
- Smooth animations

### Mobile
- Single column (1 tile per row)
- Full-width tiles
- Touch-friendly
- Expanded content fits screen
- Categories scroll horizontally

## Customization (Theme Editor)

### Welcome Section
- Title: "Knowledge Center"
- Description text
- Show/hide toggle

### Search
- Enable/disable
- Placeholder text

### Categories
- Comma-separated list: "FAQ, Tutorials, Getting Started"
- Enable/disable
- Filters tiles automatically

### Layout
- Max width (800-1600px)
- Tile minimum width (200-400px)
- Grid gap spacing
- Section padding
- Image aspect ratio (16:9, square, portrait)
- Border radius (0-20px for rounded corners)

### Colors
- Primary color (buttons, links, icons)
- Heading color
- Text color
- Border color

## Tips & Best Practices

### When to Use Expandable Tiles

✅ FAQs (question/answer format)
✅ Step-by-step guides
✅ Policies (return, shipping, privacy)
✅ Short tutorials
✅ Product specs
✅ Troubleshooting tips

### When to Use Link Tiles

✅ Videos (YouTube, Vimeo)
✅ External resources
✅ Shopify pages (`/pages/about`)
✅ Blog articles
✅ PDF downloads
✅ Products/collections
✅ Contact forms

### Writing Good Tiles

**Title:**
- Keep it short (3-8 words)
- Use action words ("How to...", "Learn about...")
- Be specific

**Description:**
- 1-2 sentences max
- Summarize what's inside
- Make it scannable

**Content (for expandable tiles):**
- Use headings to organize
- Keep paragraphs short
- Add images for clarity
- Use bullet points
- Include links to related content

### Images

- Size: 800x450px (16:9) or 600x600px (square)
- Compress images for fast loading
- Use consistent style across tiles
- Icons or photos both work

### Organization

**Categories:**
- 4-6 categories max
- Clear, simple names
- Group related content
- Examples: "Getting Started, FAQ, Tutorials, Support, Affiliates"

**Order:**
- Most important first
- Beginner content at top
- Group related tiles together

## That's It!

No complexity. No admin tools. No backend. Just:
1. Add section to page
2. Add tiles
3. Each tile either expands or links
4. Done!

**Simple, powerful, and fully customizable.**
