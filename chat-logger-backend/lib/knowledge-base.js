/**
 * Knowledge Base Storage and Management
 * Handles articles, categories, media, and access control
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class KnowledgeBase {
  constructor() {
    // Storage paths
    this.articlesPath = process.env.KB_ARTICLES_PATH || '/tmp/kb-articles';
    this.categoriesPath = process.env.KB_CATEGORIES_PATH || '/tmp/kb-categories';
    this.analyticsPath = process.env.KB_ANALYTICS_PATH || '/tmp/kb-analytics';

    // In-memory cache
    this.articlesCache = null;
    this.categoriesCache = null;
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes
    this.lastCacheTime = 0;
  }

  /**
   * Initialize storage directories
   */
  async init() {
    try {
      await fs.mkdir(this.articlesPath, { recursive: true });
      await fs.mkdir(this.categoriesPath, { recursive: true });
      await fs.mkdir(this.analyticsPath, { recursive: true });

      // Initialize with sample data if empty
      const articles = await this.getAllArticles();
      if (articles.length === 0) {
        await this.initializeSampleData();
      }
    } catch (error) {
      console.error('Error initializing KB storage:', error);
    }
  }

  /**
   * Generate unique ID
   */
  generateId() {
    return `kb_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Generate slug from title
   */
  generateSlug(title) {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Get all articles (with optional filtering)
   */
  async getAllArticles(filters = {}) {
    try {
      // Check cache
      if (this.articlesCache && (Date.now() - this.lastCacheTime < this.cacheTTL)) {
        return this.filterArticles(this.articlesCache, filters);
      }

      // Read from storage
      const files = await fs.readdir(this.articlesPath);
      const articles = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(this.articlesPath, file);
          const content = await fs.readFile(filePath, 'utf8');
          articles.push(JSON.parse(content));
        }
      }

      // Sort by order, then by date
      articles.sort((a, b) => {
        if (a.metadata.order !== b.metadata.order) {
          return (a.metadata.order || 999) - (b.metadata.order || 999);
        }
        return new Date(b.metadata.createdAt) - new Date(a.metadata.createdAt);
      });

      // Update cache
      this.articlesCache = articles;
      this.lastCacheTime = Date.now();

      return this.filterArticles(articles, filters);
    } catch (error) {
      console.error('Error reading articles:', error);
      return [];
    }
  }

  /**
   * Filter articles based on criteria
   */
  filterArticles(articles, filters) {
    let filtered = [...articles];

    // Filter by category
    if (filters.category) {
      filtered = filtered.filter(a => a.category === filters.category);
    }

    // Filter by tags
    if (filters.tags && filters.tags.length > 0) {
      filtered = filtered.filter(a =>
        filters.tags.some(tag => a.tags.includes(tag))
      );
    }

    // Filter by search query
    if (filters.search) {
      const query = filters.search.toLowerCase();
      filtered = filtered.filter(a =>
        a.title.toLowerCase().includes(query) ||
        a.description.toLowerCase().includes(query) ||
        a.content.body.toLowerCase().includes(query) ||
        a.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Filter by featured
    if (filters.featured) {
      filtered = filtered.filter(a => a.metadata.featured);
    }

    return filtered;
  }

  /**
   * Check if user has access to article
   */
  hasAccess(article, userTags = [], userEmail = null) {
    // Public articles are accessible to everyone
    if (article.access.public && article.access.requiredTags.length === 0) {
      return true;
    }

    // Check if user has required tags
    if (article.access.requiredTags.length > 0) {
      const hasRequiredTags = article.access.requiredTags.every(tag =>
        userTags.includes(tag)
      );
      if (!hasRequiredTags) {
        return false;
      }
    }

    // Check if user is in allowed customers list
    if (article.access.allowedCustomers && article.access.allowedCustomers.length > 0) {
      if (!userEmail || !article.access.allowedCustomers.includes(userEmail)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get articles accessible to user
   */
  async getAccessibleArticles(userTags = [], userEmail = null, filters = {}) {
    const allArticles = await this.getAllArticles(filters);
    return allArticles.filter(article => this.hasAccess(article, userTags, userEmail));
  }

  /**
   * Get single article by ID or slug
   */
  async getArticle(idOrSlug) {
    try {
      // Try by ID first
      const filePath = path.join(this.articlesPath, `${idOrSlug}.json`);
      try {
        const content = await fs.readFile(filePath, 'utf8');
        return JSON.parse(content);
      } catch (error) {
        // Not found by ID, try by slug
        const articles = await this.getAllArticles();
        return articles.find(a => a.slug === idOrSlug);
      }
    } catch (error) {
      console.error('Error reading article:', error);
      return null;
    }
  }

  /**
   * Create or update article
   */
  async saveArticle(article) {
    try {
      // Generate ID if new
      if (!article.id) {
        article.id = this.generateId();
        article.metadata.createdAt = new Date().toISOString();
      }

      // Update timestamp
      article.metadata.updatedAt = new Date().toISOString();

      // Generate slug if not provided
      if (!article.slug) {
        article.slug = this.generateSlug(article.title);
      }

      // Ensure slug is unique
      const existingArticles = await this.getAllArticles();
      let slug = article.slug;
      let counter = 1;
      while (existingArticles.some(a => a.id !== article.id && a.slug === slug)) {
        slug = `${article.slug}-${counter}`;
        counter++;
      }
      article.slug = slug;

      // Save to file
      const filePath = path.join(this.articlesPath, `${article.id}.json`);
      await fs.writeFile(filePath, JSON.stringify(article, null, 2), 'utf8');

      // Clear cache
      this.articlesCache = null;

      return article;
    } catch (error) {
      console.error('Error saving article:', error);
      throw error;
    }
  }

  /**
   * Delete article
   */
  async deleteArticle(id) {
    try {
      const filePath = path.join(this.articlesPath, `${id}.json`);
      await fs.unlink(filePath);

      // Clear cache
      this.articlesCache = null;

      return true;
    } catch (error) {
      console.error('Error deleting article:', error);
      return false;
    }
  }

  /**
   * Get all categories
   */
  async getAllCategories() {
    try {
      // Check cache
      if (this.categoriesCache && (Date.now() - this.lastCacheTime < this.cacheTTL)) {
        return this.categoriesCache;
      }

      const filePath = path.join(this.categoriesPath, 'categories.json');

      try {
        const content = await fs.readFile(filePath, 'utf8');
        this.categoriesCache = JSON.parse(content);
        return this.categoriesCache;
      } catch (error) {
        // File doesn't exist, return default categories
        const defaultCategories = [
          { id: 'getting-started', name: 'Getting Started', description: 'New to our platform?', icon: '🚀', order: 0 },
          { id: 'tutorials', name: 'Tutorials', description: 'Step-by-step guides', icon: '📚', order: 1 },
          { id: 'faq', name: 'FAQ', description: 'Frequently asked questions', icon: '❓', order: 2 },
          { id: 'troubleshooting', name: 'Troubleshooting', description: 'Fix common issues', icon: '🔧', order: 3 },
          { id: 'advanced', name: 'Advanced', description: 'For power users', icon: '⚡', order: 4 },
          { id: 'affiliates', name: 'Affiliates', description: 'Exclusive for affiliates', icon: '🎯', order: 5 }
        ];

        await this.saveCategories(defaultCategories);
        return defaultCategories;
      }
    } catch (error) {
      console.error('Error reading categories:', error);
      return [];
    }
  }

  /**
   * Save categories
   */
  async saveCategories(categories) {
    try {
      const filePath = path.join(this.categoriesPath, 'categories.json');
      await fs.writeFile(filePath, JSON.stringify(categories, null, 2), 'utf8');
      this.categoriesCache = categories;
      return true;
    } catch (error) {
      console.error('Error saving categories:', error);
      return false;
    }
  }

  /**
   * Track article view
   */
  async trackView(articleId, userEmail = null, userTags = []) {
    try {
      // Update article view count
      const article = await this.getArticle(articleId);
      if (article) {
        article.metadata.views = (article.metadata.views || 0) + 1;
        await this.saveArticle(article);
      }

      // Log view for analytics
      const viewLog = {
        articleId,
        userEmail: userEmail ? crypto.createHash('sha256').update(userEmail).digest('hex').substring(0, 16) : null,
        userTags,
        timestamp: new Date().toISOString()
      };

      const today = new Date().toISOString().split('T')[0];
      const logPath = path.join(this.analyticsPath, `views-${today}.jsonl`);
      await fs.appendFile(logPath, JSON.stringify(viewLog) + '\n', 'utf8');

      return true;
    } catch (error) {
      console.error('Error tracking view:', error);
      return false;
    }
  }

  /**
   * Get analytics summary
   */
  async getAnalytics(days = 7) {
    try {
      const analytics = {
        totalViews: 0,
        viewsByArticle: {},
        viewsByDay: {},
        popularArticles: []
      };

      // Read view logs for last N days
      const now = new Date();
      for (let i = 0; i < days; i++) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];

        const logPath = path.join(this.analyticsPath, `views-${dateStr}.jsonl`);

        try {
          const content = await fs.readFile(logPath, 'utf8');
          const lines = content.trim().split('\n');

          analytics.viewsByDay[dateStr] = lines.length;
          analytics.totalViews += lines.length;

          for (const line of lines) {
            const view = JSON.parse(line);
            analytics.viewsByArticle[view.articleId] = (analytics.viewsByArticle[view.articleId] || 0) + 1;
          }
        } catch (error) {
          // File doesn't exist for this day
          analytics.viewsByDay[dateStr] = 0;
        }
      }

      // Get popular articles
      const articles = await this.getAllArticles();
      analytics.popularArticles = Object.entries(analytics.viewsByArticle)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([articleId, views]) => {
          const article = articles.find(a => a.id === articleId);
          return {
            id: articleId,
            title: article ? article.title : 'Unknown',
            views
          };
        });

      return analytics;
    } catch (error) {
      console.error('Error getting analytics:', error);
      return null;
    }
  }

  /**
   * Initialize sample data
   */
  async initializeSampleData() {
    const sampleArticles = [
      {
        id: this.generateId(),
        title: 'Welcome to the Knowledge Center',
        slug: 'welcome',
        description: 'Get started with our comprehensive knowledge base',
        content: {
          type: 'rich',
          body: `<h2>Welcome!</h2>
<p>This is your knowledge center where you can find helpful articles, tutorials, and guides.</p>
<h3>What you'll find here:</h3>
<ul>
  <li>Getting started guides</li>
  <li>Step-by-step tutorials</li>
  <li>Frequently asked questions</li>
  <li>Troubleshooting tips</li>
  <li>Advanced topics for power users</li>
</ul>
<p>Use the search bar to find what you're looking for, or browse by category.</p>`,
          media: []
        },
        category: 'getting-started',
        tags: ['welcome', 'introduction'],
        access: {
          public: true,
          requiredTags: [],
          allowedCustomers: []
        },
        metadata: {
          author: 'Admin',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          views: 0,
          featured: true,
          order: 0
        }
      },
      {
        id: this.generateId(),
        title: 'Affiliates Program Guide',
        slug: 'affiliates-program-guide',
        description: 'Exclusive guide for our affiliate partners',
        content: {
          type: 'rich',
          body: `<h2>Affiliates Program</h2>
<p>Welcome to our exclusive affiliates program! This guide contains everything you need to know.</p>
<h3>Getting Started</h3>
<p>As an affiliate partner, you have access to exclusive resources and tools.</p>
<h3>Commission Structure</h3>
<p>Details about our commission structure and payment terms.</p>
<h3>Marketing Materials</h3>
<p>Download banners, logos, and promotional content.</p>`,
          media: []
        },
        category: 'affiliates',
        tags: ['affiliates', 'program', 'commission'],
        access: {
          public: false,
          requiredTags: ['affiliates'],
          allowedCustomers: []
        },
        metadata: {
          author: 'Admin',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          views: 0,
          featured: true,
          order: 0
        }
      },
      {
        id: this.generateId(),
        title: 'How to Track Your Orders',
        slug: 'track-orders',
        description: 'Learn how to track your orders and shipments',
        content: {
          type: 'rich',
          body: `<h2>Order Tracking</h2>
<p>Tracking your order is easy! Follow these steps:</p>
<ol>
  <li>Log in to your account</li>
  <li>Go to "My Orders"</li>
  <li>Click on the order you want to track</li>
  <li>View the tracking information and estimated delivery date</li>
</ol>
<h3>Video Tutorial</h3>
<p>Watch this video for a step-by-step walkthrough:</p>`,
          media: [
            {
              type: 'video',
              url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
              caption: 'How to track your orders'
            }
          ]
        },
        category: 'tutorials',
        tags: ['orders', 'tracking', 'shipping'],
        access: {
          public: true,
          requiredTags: [],
          allowedCustomers: []
        },
        metadata: {
          author: 'Admin',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          views: 0,
          featured: false,
          order: 1
        }
      }
    ];

    for (const article of sampleArticles) {
      await this.saveArticle(article);
    }
  }
}

// Export singleton instance
const knowledgeBase = new KnowledgeBase();
module.exports = knowledgeBase;
