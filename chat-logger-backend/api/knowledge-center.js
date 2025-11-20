/**
 * Knowledge Center API
 * Handles article retrieval, search, categories, and analytics
 */

const knowledgeBase = require('../lib/knowledge-base');
const rateLimiter = require('../lib/rate-limiter');

module.exports = async (req, res) => {
  // CORS handling
  if (req.method === 'OPTIONS') {
    return res.status(200)
      .setHeader('Access-Control-Allow-Origin', '*')
      .setHeader('Access-Control-Allow-Headers', 'Content-Type')
      .setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
      .end();
  }

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  try {
    // Initialize storage
    await knowledgeBase.init();

    // Rate limiting
    const identifier = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
    const rateCheck = rateLimiter.checkRateLimit(identifier);

    if (!rateCheck.allowed) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        retryAfter: Math.ceil(rateCheck.retryAfter / 1000)
      });
    }

    // Get action from query or body
    const action = req.query.action || (req.body && req.body.action);

    // Route based on action
    switch (action) {
      case 'get-articles':
        return await handleGetArticles(req, res);

      case 'get-article':
        return await handleGetArticle(req, res);

      case 'search':
        return await handleSearch(req, res);

      case 'get-categories':
        return await handleGetCategories(req, res);

      case 'track-view':
        return await handleTrackView(req, res);

      case 'get-analytics':
        return await handleGetAnalytics(req, res);

      case 'create-article':
        return await handleCreateArticle(req, res);

      case 'update-article':
        return await handleUpdateArticle(req, res);

      case 'delete-article':
        return await handleDeleteArticle(req, res);

      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('Knowledge Center API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get all articles (with filtering)
 */
async function handleGetArticles(req, res) {
  try {
    const {
      category,
      tags,
      featured,
      userTags = [],
      userEmail
    } = req.method === 'GET' ? req.query : req.body;

    // Parse tags if string
    const parsedUserTags = typeof userTags === 'string' ? JSON.parse(userTags) : (userTags || []);
    const parsedTags = tags ? (typeof tags === 'string' ? JSON.parse(tags) : tags) : undefined;

    const filters = {
      category,
      tags: parsedTags,
      featured: featured === 'true' || featured === true
    };

    // Get accessible articles
    const articles = await knowledgeBase.getAccessibleArticles(
      parsedUserTags,
      userEmail,
      filters
    );

    // Remove content body from list view to reduce payload
    const articlesList = articles.map(article => ({
      id: article.id,
      title: article.title,
      slug: article.slug,
      description: article.description,
      category: article.category,
      tags: article.tags,
      metadata: {
        author: article.metadata.author,
        createdAt: article.metadata.createdAt,
        updatedAt: article.metadata.updatedAt,
        views: article.metadata.views,
        featured: article.metadata.featured
      },
      mediaCount: article.content.media.length
    }));

    return res.status(200).json({
      success: true,
      articles: articlesList,
      total: articlesList.length
    });
  } catch (error) {
    console.error('Error getting articles:', error);
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Get single article
 */
async function handleGetArticle(req, res) {
  try {
    const { id, slug, userTags = [], userEmail } = req.method === 'GET' ? req.query : req.body;
    const identifier = id || slug;

    if (!identifier) {
      return res.status(400).json({ error: 'Article ID or slug required' });
    }

    const article = await knowledgeBase.getArticle(identifier);

    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    // Check access
    const parsedUserTags = typeof userTags === 'string' ? JSON.parse(userTags) : (userTags || []);
    const hasAccess = knowledgeBase.hasAccess(article, parsedUserTags, userEmail);

    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'This content requires special access. Please contact support.',
        requiredTags: article.access.requiredTags
      });
    }

    return res.status(200).json({
      success: true,
      article
    });
  } catch (error) {
    console.error('Error getting article:', error);
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Search articles
 */
async function handleSearch(req, res) {
  try {
    const { query, userTags = [], userEmail } = req.method === 'GET' ? req.query : req.body;

    if (!query || query.trim().length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }

    const parsedUserTags = typeof userTags === 'string' ? JSON.parse(userTags) : (userTags || []);

    // Search articles
    const articles = await knowledgeBase.getAccessibleArticles(
      parsedUserTags,
      userEmail,
      { search: query }
    );

    // Remove content body from search results
    const searchResults = articles.map(article => ({
      id: article.id,
      title: article.title,
      slug: article.slug,
      description: article.description,
      category: article.category,
      tags: article.tags,
      metadata: {
        views: article.metadata.views,
        featured: article.metadata.featured
      }
    }));

    return res.status(200).json({
      success: true,
      results: searchResults,
      total: searchResults.length,
      query
    });
  } catch (error) {
    console.error('Error searching articles:', error);
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Get all categories
 */
async function handleGetCategories(req, res) {
  try {
    const categories = await knowledgeBase.getAllCategories();

    // Get article counts per category
    const allArticles = await knowledgeBase.getAllArticles();
    const categoriesWithCounts = categories.map(category => ({
      ...category,
      articleCount: allArticles.filter(a => a.category === category.id).length
    }));

    return res.status(200).json({
      success: true,
      categories: categoriesWithCounts
    });
  } catch (error) {
    console.error('Error getting categories:', error);
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Track article view
 */
async function handleTrackView(req, res) {
  try {
    const { articleId, userEmail, userTags = [] } = req.body;

    if (!articleId) {
      return res.status(400).json({ error: 'Article ID required' });
    }

    const parsedUserTags = typeof userTags === 'string' ? JSON.parse(userTags) : (userTags || []);
    await knowledgeBase.trackView(articleId, userEmail, parsedUserTags);

    return res.status(200).json({
      success: true,
      message: 'View tracked'
    });
  } catch (error) {
    console.error('Error tracking view:', error);
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Get analytics
 */
async function handleGetAnalytics(req, res) {
  try {
    const { days = 7 } = req.method === 'GET' ? req.query : req.body;
    const analytics = await knowledgeBase.getAnalytics(parseInt(days));

    return res.status(200).json({
      success: true,
      analytics
    });
  } catch (error) {
    console.error('Error getting analytics:', error);
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Create article (admin only - implement auth as needed)
 */
async function handleCreateArticle(req, res) {
  try {
    const article = req.body.article;

    if (!article || !article.title) {
      return res.status(400).json({ error: 'Article data required' });
    }

    // Set defaults
    const newArticle = {
      title: article.title,
      description: article.description || '',
      content: article.content || { type: 'rich', body: '', media: [] },
      category: article.category || 'uncategorized',
      tags: article.tags || [],
      access: article.access || { public: true, requiredTags: [], allowedCustomers: [] },
      metadata: {
        author: article.metadata?.author || 'Admin',
        views: 0,
        featured: article.metadata?.featured || false,
        order: article.metadata?.order || 999
      }
    };

    const savedArticle = await knowledgeBase.saveArticle(newArticle);

    return res.status(201).json({
      success: true,
      article: savedArticle
    });
  } catch (error) {
    console.error('Error creating article:', error);
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Update article (admin only - implement auth as needed)
 */
async function handleUpdateArticle(req, res) {
  try {
    const { id } = req.body;
    const updates = req.body.article;

    if (!id) {
      return res.status(400).json({ error: 'Article ID required' });
    }

    const existingArticle = await knowledgeBase.getArticle(id);

    if (!existingArticle) {
      return res.status(404).json({ error: 'Article not found' });
    }

    // Merge updates
    const updatedArticle = {
      ...existingArticle,
      ...updates,
      id: existingArticle.id, // Preserve ID
      metadata: {
        ...existingArticle.metadata,
        ...(updates.metadata || {})
      }
    };

    const savedArticle = await knowledgeBase.saveArticle(updatedArticle);

    return res.status(200).json({
      success: true,
      article: savedArticle
    });
  } catch (error) {
    console.error('Error updating article:', error);
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Delete article (admin only - implement auth as needed)
 */
async function handleDeleteArticle(req, res) {
  try {
    const { id } = req.method === 'DELETE' ? req.query : req.body;

    if (!id) {
      return res.status(400).json({ error: 'Article ID required' });
    }

    const success = await knowledgeBase.deleteArticle(id);

    if (!success) {
      return res.status(404).json({ error: 'Article not found' });
    }

    return res.status(200).json({
      success: true,
      message: 'Article deleted'
    });
  } catch (error) {
    console.error('Error deleting article:', error);
    return res.status(500).json({ error: error.message });
  }
}
