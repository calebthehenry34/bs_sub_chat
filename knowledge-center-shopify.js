/**
 * Knowledge Center Component - Shopify Only
 * Fully contained within Shopify, no external backend needed
 *
 * Data storage options:
 * 1. Shopify Pages with metafields (recommended)
 * 2. Static JSON file in theme assets
 * 3. Section settings JSON
 *
 * Usage:
 * const knowledgeCenter = new KnowledgeCenterShopify({
 *   dataSource: 'pages', // 'pages', 'json', or 'inline'
 *   userEmail: '{{ customer.email }}',
 *   userTags: ['affiliates'],
 *   containerId: 'knowledge-center-container',
 *   theme: { ... }
 * });
 */

class KnowledgeCenterShopify {
  constructor(config = {}) {
    // Default configuration
    this.config = {
      dataSource: config.dataSource || 'inline', // 'pages', 'json', 'inline'
      articlesData: config.articlesData || [], // For inline data
      jsonUrl: config.jsonUrl || null, // For JSON file
      userEmail: config.userEmail || null,
      userTags: config.userTags || [],
      containerId: config.containerId || 'knowledge-center',
      enableSearch: config.enableSearch !== false,
      enableCategories: config.enableCategories !== false,
      articlesPerPage: config.articlesPerPage || 12,
      showFeaturedFirst: config.showFeaturedFirst !== false,
      theme: {
        primaryColor: config.theme?.primaryColor || '#2563eb',
        secondaryColor: config.theme?.secondaryColor || '#64748b',
        backgroundColor: config.theme?.backgroundColor || '#ffffff',
        textColor: config.theme?.textColor || '#1e293b',
        borderRadius: config.theme?.borderRadius || '8px',
        fontFamily: config.theme?.fontFamily || '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        cardShadow: config.theme?.cardShadow || '0 1px 3px rgba(0,0,0,0.1)',
        cardHoverShadow: config.theme?.cardHoverShadow || '0 4px 6px rgba(0,0,0,0.1)',
        spacing: config.theme?.spacing || '16px',
        ...config.theme
      }
    };

    // State
    this.state = {
      articles: [],
      categories: [],
      currentCategory: null,
      searchQuery: '',
      currentArticle: null,
      loading: false,
      currentPage: 1
    };

    // DOM elements
    this.container = null;

    // Initialize
    this.init();
  }

  /**
   * Initialize the knowledge center
   */
  async init() {
    try {
      this.container = document.getElementById(this.config.containerId);

      if (!this.container) {
        console.error(`Knowledge Center: Container #${this.config.containerId} not found`);
        return;
      }

      // Inject styles
      this.injectStyles();

      // Render initial UI
      this.render();

      // Load data based on source
      await this.loadData();

      // Track views in localStorage
      this.initializeAnalytics();
    } catch (error) {
      console.error('Knowledge Center initialization error:', error);
      this.showError('Failed to initialize knowledge center');
    }
  }

  /**
   * Load data from configured source
   */
  async loadData() {
    this.state.loading = true;
    this.render();

    try {
      switch (this.config.dataSource) {
        case 'pages':
          await this.loadFromPages();
          break;
        case 'json':
          await this.loadFromJSON();
          break;
        case 'inline':
          await this.loadInlineData();
          break;
        default:
          throw new Error('Invalid data source');
      }

      // Extract categories from articles
      this.extractCategories();

      // Sort featured first if enabled
      if (this.config.showFeaturedFirst) {
        this.state.articles.sort((a, b) => {
          if (a.metadata.featured && !b.metadata.featured) return -1;
          if (!a.metadata.featured && b.metadata.featured) return 1;
          return (a.metadata.order || 999) - (b.metadata.order || 999);
        });
      }
    } catch (error) {
      console.error('Error loading data:', error);
      this.showError('Failed to load articles');
    } finally {
      this.state.loading = false;
      this.render();
    }
  }

  /**
   * Load articles from Shopify pages with 'kb-article' tag
   */
  async loadFromPages() {
    try {
      // Fetch all pages with kb-article tag via Shopify Ajax API
      const response = await fetch('/pages.json');

      if (!response.ok) {
        throw new Error('Failed to fetch pages');
      }

      const data = await response.json();

      // Filter pages with kb-article in handle or tags
      const kbPages = data.pages.filter(page =>
        page.handle.startsWith('kb-') ||
        (page.tags && page.tags.includes('kb-article'))
      );

      // Convert pages to article format
      this.state.articles = kbPages.map(page => this.convertPageToArticle(page));
    } catch (error) {
      console.error('Error loading from pages:', error);
      // Fall back to inline data if available
      if (this.config.articlesData.length > 0) {
        await this.loadInlineData();
      }
    }
  }

  /**
   * Convert Shopify page to article format
   */
  convertPageToArticle(page) {
    // Parse metafields from page if available
    const metafields = page.metafields || {};

    return {
      id: page.id.toString(),
      title: page.title,
      slug: page.handle,
      description: metafields.description || this.extractExcerpt(page.body_html),
      content: {
        type: 'rich',
        body: page.body_html,
        media: this.extractMediaFromContent(page.body_html)
      },
      category: metafields.category || 'general',
      tags: page.tags ? page.tags.split(', ').filter(t => t !== 'kb-article') : [],
      access: {
        public: metafields.public !== 'false',
        requiredTags: metafields.required_tags ? metafields.required_tags.split(',').map(t => t.trim()) : [],
        allowedCustomers: []
      },
      metadata: {
        author: metafields.author || page.author || 'Admin',
        createdAt: page.created_at,
        updatedAt: page.updated_at,
        views: this.getArticleViews(page.id.toString()),
        featured: metafields.featured === 'true',
        order: parseInt(metafields.order) || 999
      }
    };
  }

  /**
   * Load articles from JSON file
   */
  async loadFromJSON() {
    try {
      if (!this.config.jsonUrl) {
        throw new Error('JSON URL not configured');
      }

      const response = await fetch(this.config.jsonUrl);

      if (!response.ok) {
        throw new Error('Failed to fetch JSON');
      }

      const data = await response.json();
      this.state.articles = data.articles || [];
    } catch (error) {
      console.error('Error loading from JSON:', error);
      // Fall back to inline data
      await this.loadInlineData();
    }
  }

  /**
   * Load inline data from config
   */
  async loadInlineData() {
    this.state.articles = this.config.articlesData.map(article => ({
      ...article,
      metadata: {
        ...article.metadata,
        views: this.getArticleViews(article.id)
      }
    }));
  }

  /**
   * Extract categories from articles
   */
  extractCategories() {
    const categoryMap = new Map();

    // Count articles per category
    this.state.articles.forEach(article => {
      const category = article.category || 'general';
      if (!categoryMap.has(category)) {
        categoryMap.set(category, {
          id: category,
          name: this.formatCategoryName(category),
          count: 0,
          icon: this.getCategoryIcon(category)
        });
      }
      categoryMap.get(category).count++;
    });

    this.state.categories = Array.from(categoryMap.values());
  }

  /**
   * Format category name
   */
  formatCategoryName(category) {
    const names = {
      'getting-started': 'Getting Started',
      'tutorials': 'Tutorials',
      'faq': 'FAQ',
      'troubleshooting': 'Troubleshooting',
      'advanced': 'Advanced',
      'affiliates': 'Affiliates',
      'general': 'General'
    };
    return names[category] || category.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  /**
   * Get category icon
   */
  getCategoryIcon(category) {
    const icons = {
      'getting-started': '🚀',
      'tutorials': '📚',
      'faq': '❓',
      'troubleshooting': '🔧',
      'advanced': '⚡',
      'affiliates': '🎯',
      'general': '📄'
    };
    return icons[category] || '📄';
  }

  /**
   * Extract excerpt from HTML
   */
  extractExcerpt(html, maxLength = 150) {
    const div = document.createElement('div');
    div.innerHTML = html;
    const text = div.textContent || div.innerText || '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  }

  /**
   * Extract media from content
   */
  extractMediaFromContent(html) {
    const media = [];
    const div = document.createElement('div');
    div.innerHTML = html;

    // Extract videos
    div.querySelectorAll('iframe').forEach(iframe => {
      media.push({
        type: 'video',
        url: iframe.src,
        caption: iframe.title || ''
      });
    });

    // Extract images
    div.querySelectorAll('img').forEach(img => {
      media.push({
        type: 'image',
        url: img.src,
        alt: img.alt || '',
        caption: img.title || ''
      });
    });

    return media;
  }

  /**
   * Check if user has access to article
   */
  hasAccess(article) {
    // Public articles are accessible to everyone
    if (article.access.public && article.access.requiredTags.length === 0) {
      return true;
    }

    // Check if user has required tags
    if (article.access.requiredTags.length > 0) {
      const hasRequiredTags = article.access.requiredTags.every(tag =>
        this.config.userTags.includes(tag)
      );
      if (!hasRequiredTags) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get filtered articles (accessible to user)
   */
  getFilteredArticles() {
    let filtered = this.state.articles.filter(article => this.hasAccess(article));

    // Filter by category
    if (this.state.currentCategory) {
      filtered = filtered.filter(a => a.category === this.state.currentCategory);
    }

    // Filter by search
    if (this.state.searchQuery) {
      const query = this.state.searchQuery.toLowerCase();
      filtered = filtered.filter(a =>
        a.title.toLowerCase().includes(query) ||
        a.description.toLowerCase().includes(query) ||
        (a.tags && a.tags.some(tag => tag.toLowerCase().includes(query)))
      );
    }

    return filtered;
  }

  /**
   * Analytics using localStorage
   */
  initializeAnalytics() {
    if (!window.localStorage) return;

    // Initialize views storage
    if (!localStorage.getItem('kc-views')) {
      localStorage.setItem('kc-views', JSON.stringify({}));
    }
  }

  /**
   * Get article views from localStorage
   */
  getArticleViews(articleId) {
    if (!window.localStorage) return 0;

    try {
      const views = JSON.parse(localStorage.getItem('kc-views') || '{}');
      return views[articleId] || 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Track article view
   */
  trackView(articleId) {
    if (!window.localStorage) return;

    try {
      const views = JSON.parse(localStorage.getItem('kc-views') || '{}');
      views[articleId] = (views[articleId] || 0) + 1;
      localStorage.setItem('kc-views', JSON.stringify(views));

      // Update current article views
      if (this.state.currentArticle && this.state.currentArticle.id === articleId) {
        this.state.currentArticle.metadata.views = views[articleId];
      }
    } catch (error) {
      console.error('Error tracking view:', error);
    }
  }

  /**
   * Inject custom styles (same as before)
   */
  injectStyles() {
    const styleId = 'knowledge-center-styles';
    const existingStyles = document.getElementById(styleId);
    if (existingStyles) existingStyles.remove();

    const styles = `
      .kc-container {
        font-family: ${this.config.theme.fontFamily};
        color: ${this.config.theme.textColor};
        max-width: 1200px;
        margin: 0 auto;
        padding: ${this.config.theme.spacing};
      }
      .kc-header {
        text-align: center;
        margin-bottom: calc(${this.config.theme.spacing} * 2);
      }
      .kc-header h1 {
        font-size: 2.5rem;
        margin-bottom: 0.5rem;
        color: ${this.config.theme.primaryColor};
      }
      .kc-header p {
        font-size: 1.125rem;
        color: ${this.config.theme.secondaryColor};
      }
      .kc-search-container {
        max-width: 600px;
        margin: 0 auto calc(${this.config.theme.spacing} * 2);
        position: relative;
      }
      .kc-search-input {
        width: 100%;
        padding: 12px 40px 12px 16px;
        font-size: 1rem;
        border: 2px solid #e2e8f0;
        border-radius: ${this.config.theme.borderRadius};
        outline: none;
        transition: border-color 0.2s;
      }
      .kc-search-input:focus {
        border-color: ${this.config.theme.primaryColor};
      }
      .kc-search-icon {
        position: absolute;
        right: 12px;
        top: 50%;
        transform: translateY(-50%);
        color: ${this.config.theme.secondaryColor};
      }
      .kc-categories {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        justify-content: center;
        margin-bottom: calc(${this.config.theme.spacing} * 2);
      }
      .kc-category-btn {
        padding: 8px 16px;
        border: 2px solid #e2e8f0;
        border-radius: ${this.config.theme.borderRadius};
        background: white;
        color: ${this.config.theme.textColor};
        font-size: 0.875rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .kc-category-btn:hover {
        border-color: ${this.config.theme.primaryColor};
        background: ${this.config.theme.primaryColor}10;
      }
      .kc-category-btn.active {
        border-color: ${this.config.theme.primaryColor};
        background: ${this.config.theme.primaryColor};
        color: white;
      }
      .kc-category-count {
        background: rgba(0,0,0,0.1);
        padding: 2px 6px;
        border-radius: 10px;
        font-size: 0.75rem;
      }
      .kc-articles-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: ${this.config.theme.spacing};
        margin-bottom: calc(${this.config.theme.spacing} * 2);
      }
      .kc-article-card {
        background: ${this.config.theme.backgroundColor};
        border: 1px solid #e2e8f0;
        border-radius: ${this.config.theme.borderRadius};
        padding: ${this.config.theme.spacing};
        cursor: pointer;
        transition: all 0.2s;
        box-shadow: ${this.config.theme.cardShadow};
      }
      .kc-article-card:hover {
        box-shadow: ${this.config.theme.cardHoverShadow};
        transform: translateY(-2px);
      }
      .kc-article-card.featured {
        border-color: ${this.config.theme.primaryColor};
        background: ${this.config.theme.primaryColor}05;
      }
      .kc-article-badge {
        display: inline-block;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 0.75rem;
        font-weight: 600;
        margin-bottom: 8px;
      }
      .kc-article-badge.featured {
        background: ${this.config.theme.primaryColor};
        color: white;
      }
      .kc-article-title {
        font-size: 1.25rem;
        font-weight: 600;
        margin-bottom: 8px;
        color: ${this.config.theme.textColor};
      }
      .kc-article-description {
        font-size: 0.875rem;
        color: ${this.config.theme.secondaryColor};
        margin-bottom: 12px;
        line-height: 1.5;
      }
      .kc-article-meta {
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 0.75rem;
        color: ${this.config.theme.secondaryColor};
      }
      .kc-article-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 8px;
      }
      .kc-tag {
        padding: 2px 8px;
        background: #f1f5f9;
        border-radius: 12px;
        font-size: 0.75rem;
        color: ${this.config.theme.secondaryColor};
      }
      .kc-article-view {
        animation: slideIn 0.3s ease-out;
      }
      @keyframes slideIn {
        from {
          opacity: 0;
          transform: translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      .kc-article-header {
        margin-bottom: calc(${this.config.theme.spacing} * 2);
      }
      .kc-back-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 8px 16px;
        border: 1px solid #e2e8f0;
        border-radius: ${this.config.theme.borderRadius};
        background: white;
        color: ${this.config.theme.primaryColor};
        font-size: 0.875rem;
        font-weight: 500;
        cursor: pointer;
        margin-bottom: 16px;
        transition: all 0.2s;
      }
      .kc-back-btn:hover {
        background: #f8fafc;
      }
      .kc-article-content {
        line-height: 1.7;
      }
      .kc-article-content h2 {
        font-size: 1.875rem;
        margin: 1.5rem 0 1rem;
        color: ${this.config.theme.textColor};
      }
      .kc-article-content h3 {
        font-size: 1.5rem;
        margin: 1.25rem 0 0.75rem;
        color: ${this.config.theme.textColor};
      }
      .kc-article-content p {
        margin-bottom: 1rem;
      }
      .kc-article-content ul,
      .kc-article-content ol {
        margin-bottom: 1rem;
        padding-left: 2rem;
      }
      .kc-article-content li {
        margin-bottom: 0.5rem;
      }
      .kc-article-content img {
        max-width: 100%;
        height: auto;
        border-radius: ${this.config.theme.borderRadius};
        margin: 1rem 0;
      }
      .kc-article-content iframe {
        max-width: 100%;
        margin: 1rem 0;
      }
      .kc-loading {
        text-align: center;
        padding: calc(${this.config.theme.spacing} * 3);
        color: ${this.config.theme.secondaryColor};
      }
      .kc-spinner {
        border: 3px solid #f3f4f6;
        border-top: 3px solid ${this.config.theme.primaryColor};
        border-radius: 50%;
        width: 40px;
        height: 40px;
        animation: spin 1s linear infinite;
        margin: 0 auto;
      }
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      .kc-empty {
        text-align: center;
        padding: calc(${this.config.theme.spacing} * 4);
        color: ${this.config.theme.secondaryColor};
      }
      .kc-empty-icon {
        font-size: 4rem;
        margin-bottom: 1rem;
        opacity: 0.5;
      }
      .kc-error {
        background: #fee2e2;
        border: 1px solid #fecaca;
        border-radius: ${this.config.theme.borderRadius};
        padding: ${this.config.theme.spacing};
        color: #991b1b;
        margin-bottom: ${this.config.theme.spacing};
      }
      .kc-access-denied {
        text-align: center;
        padding: calc(${this.config.theme.spacing} * 3);
        background: #fef3c7;
        border: 1px solid #fde68a;
        border-radius: ${this.config.theme.borderRadius};
        margin: calc(${this.config.theme.spacing} * 2) 0;
      }
      .kc-access-denied-icon {
        font-size: 3rem;
        margin-bottom: 1rem;
      }
      .kc-pagination {
        display: flex;
        justify-content: center;
        gap: 8px;
        margin-top: calc(${this.config.theme.spacing} * 2);
      }
      .kc-page-btn {
        padding: 8px 12px;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        background: white;
        color: ${this.config.theme.textColor};
        cursor: pointer;
        transition: all 0.2s;
      }
      .kc-page-btn:hover:not(:disabled) {
        border-color: ${this.config.theme.primaryColor};
        background: ${this.config.theme.primaryColor}10;
      }
      .kc-page-btn.active {
        background: ${this.config.theme.primaryColor};
        color: white;
        border-color: ${this.config.theme.primaryColor};
      }
      .kc-page-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      @media (max-width: 768px) {
        .kc-header h1 {
          font-size: 2rem;
        }
        .kc-articles-grid {
          grid-template-columns: 1fr;
        }
        .kc-categories {
          justify-content: flex-start;
          overflow-x: auto;
          flex-wrap: nowrap;
          padding-bottom: 8px;
        }
        .kc-category-btn {
          flex-shrink: 0;
        }
      }
      @media (max-width: 480px) {
        .kc-container {
          padding: 12px;
        }
        .kc-header h1 {
          font-size: 1.5rem;
        }
        .kc-header p {
          font-size: 1rem;
        }
      }
    `;

    const styleElement = document.createElement('style');
    styleElement.id = styleId;
    styleElement.textContent = styles;
    document.head.appendChild(styleElement);
  }

  /**
   * Render methods (reuse from previous version)
   */
  render() {
    if (this.state.currentArticle) {
      this.renderArticleView();
    } else {
      this.renderListView();
    }
  }

  renderListView() {
    const headerHtml = `
      <div class="kc-header">
        <h1>Knowledge Center</h1>
        <p>Find helpful articles, tutorials, and guides</p>
      </div>
    `;

    const searchHtml = this.config.enableSearch ? `
      <div class="kc-search-container">
        <input
          type="text"
          class="kc-search-input"
          placeholder="Search articles..."
          value="${this.escapeHtml(this.state.searchQuery)}"
          id="kc-search-input"
        />
        <span class="kc-search-icon">🔍</span>
      </div>
    ` : '';

    const categoriesHtml = this.config.enableCategories ? `
      <div class="kc-categories" id="kc-categories">
        ${this.renderCategories()}
      </div>
    ` : '';

    const articlesHtml = this.state.loading ? `
      <div class="kc-loading">
        <div class="kc-spinner"></div>
        <p>Loading articles...</p>
      </div>
    ` : this.renderArticlesGrid();

    this.container.innerHTML = `
      <div class="kc-container">
        ${headerHtml}
        ${searchHtml}
        ${categoriesHtml}
        ${articlesHtml}
      </div>
    `;

    this.attachListViewEventListeners();
  }

  renderCategories() {
    if (this.state.categories.length === 0) return '';

    const allBtn = `
      <button class="kc-category-btn ${!this.state.currentCategory ? 'active' : ''}" data-category="all">
        All Articles
        <span class="kc-category-count">${this.getFilteredArticles().length}</span>
      </button>
    `;

    const categoryButtons = this.state.categories.map(category => `
      <button class="kc-category-btn ${this.state.currentCategory === category.id ? 'active' : ''}" data-category="${this.escapeHtml(category.id)}">
        ${category.icon ? `<span>${category.icon}</span>` : ''}
        ${this.escapeHtml(category.name)}
        <span class="kc-category-count">${category.count}</span>
      </button>
    `).join('');

    return allBtn + categoryButtons;
  }

  renderArticlesGrid() {
    const filteredArticles = this.getFilteredArticles();

    if (filteredArticles.length === 0) {
      return `
        <div class="kc-empty">
          <div class="kc-empty-icon">📄</div>
          <h3>No articles found</h3>
          <p>Try adjusting your search or filters</p>
        </div>
      `;
    }

    const startIndex = (this.state.currentPage - 1) * this.config.articlesPerPage;
    const endIndex = startIndex + this.config.articlesPerPage;
    const paginatedArticles = filteredArticles.slice(startIndex, endIndex);
    const totalPages = Math.ceil(filteredArticles.length / this.config.articlesPerPage);

    const articlesHtml = paginatedArticles.map(article => this.renderArticleCard(article)).join('');
    const paginationHtml = totalPages > 1 ? this.renderPagination(totalPages) : '';

    return `<div class="kc-articles-grid">${articlesHtml}</div>${paginationHtml}`;
  }

  renderArticleCard(article) {
    const isFeatured = article.metadata.featured;
    const mediaCount = article.content.media ? article.content.media.length : 0;

    return `
      <div class="kc-article-card ${isFeatured ? 'featured' : ''}" data-article-id="${article.id}">
        ${isFeatured ? '<span class="kc-article-badge featured">⭐ Featured</span>' : ''}
        <h3 class="kc-article-title">${this.escapeHtml(article.title)}</h3>
        <p class="kc-article-description">${this.escapeHtml(article.description)}</p>
        <div class="kc-article-meta">
          <span>📅 ${this.formatDate(article.metadata.createdAt)}</span>
          ${article.metadata.views ? `<span>👁️ ${article.metadata.views} views</span>` : ''}
          ${mediaCount > 0 ? `<span>🎬 ${mediaCount} media</span>` : ''}
        </div>
        ${article.tags && article.tags.length > 0 ? `
          <div class="kc-article-tags">
            ${article.tags.slice(0, 3).map(tag => `<span class="kc-tag">${this.escapeHtml(tag)}</span>`).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }

  renderPagination(totalPages) {
    const pages = [];
    pages.push(`<button class="kc-page-btn" data-page="prev" ${this.state.currentPage === 1 ? 'disabled' : ''}>← Previous</button>`);
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= this.state.currentPage - 2 && i <= this.state.currentPage + 2)) {
        pages.push(`<button class="kc-page-btn ${i === this.state.currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`);
      } else if (i === this.state.currentPage - 3 || i === this.state.currentPage + 3) {
        pages.push('<span class="kc-page-btn" disabled>...</span>');
      }
    }
    pages.push(`<button class="kc-page-btn" data-page="next" ${this.state.currentPage === totalPages ? 'disabled' : ''}>Next →</button>`);
    return `<div class="kc-pagination">${pages.join('')}</div>`;
  }

  renderArticleView() {
    const article = this.state.currentArticle;
    if (!article) {
      this.renderListView();
      return;
    }

    this.container.innerHTML = `
      <div class="kc-container">
        <div class="kc-article-view">
          <button class="kc-back-btn" id="kc-back-btn">← Back to articles</button>
          <div class="kc-article-header">
            <h1>${this.escapeHtml(article.title)}</h1>
            <div class="kc-article-meta">
              <span>📅 ${this.formatDate(article.metadata.createdAt)}</span>
              <span>✍️ ${this.escapeHtml(article.metadata.author)}</span>
              ${article.metadata.views ? `<span>👁️ ${article.metadata.views} views</span>` : ''}
            </div>
            ${article.tags && article.tags.length > 0 ? `
              <div class="kc-article-tags">
                ${article.tags.map(tag => `<span class="kc-tag">${this.escapeHtml(tag)}</span>`).join('')}
              </div>
            ` : ''}
          </div>
          <div class="kc-article-content">
            ${article.content.body}
          </div>
        </div>
      </div>
    `;

    document.getElementById('kc-back-btn').addEventListener('click', () => {
      this.state.currentArticle = null;
      this.render();
    });
  }

  attachListViewEventListeners() {
    const searchInput = document.getElementById('kc-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.state.searchQuery = e.target.value;
        this.state.currentPage = 1;
        this.render();
      });
    }

    document.querySelectorAll('.kc-category-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const category = btn.dataset.category;
        this.state.currentCategory = category === 'all' ? null : category;
        this.state.currentPage = 1;
        this.render();
      });
    });

    document.querySelectorAll('.kc-article-card').forEach(card => {
      card.addEventListener('click', () => {
        const articleId = card.dataset.articleId;
        this.openArticle(articleId);
      });
    });

    document.querySelectorAll('.kc-page-btn[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        const page = btn.dataset.page;
        if (page === 'prev') {
          this.state.currentPage = Math.max(1, this.state.currentPage - 1);
        } else if (page === 'next') {
          this.state.currentPage++;
        } else {
          this.state.currentPage = parseInt(page);
        }
        this.render();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
  }

  openArticle(articleId) {
    const article = this.state.articles.find(a => a.id === articleId);

    if (!article) {
      this.showError('Article not found');
      return;
    }

    if (!this.hasAccess(article)) {
      this.showAccessDenied(article.access.requiredTags);
      return;
    }

    this.state.currentArticle = article;
    this.trackView(articleId);
    this.render();
  }

  showAccessDenied(requiredTags) {
    this.container.innerHTML = `
      <div class="kc-container">
        <button class="kc-back-btn" onclick="location.reload()">← Back to articles</button>
        <div class="kc-access-denied">
          <div class="kc-access-denied-icon">🔒</div>
          <h2>Access Denied</h2>
          <p>This content requires special access. Please contact support.</p>
          ${requiredTags && requiredTags.length > 0 ? `<p><strong>Required access:</strong> ${requiredTags.join(', ')}</p>` : ''}
        </div>
      </div>
    `;
  }

  showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'kc-error';
    errorDiv.textContent = message;
    this.container.insertBefore(errorDiv, this.container.firstChild);
    setTimeout(() => errorDiv.remove(), 5000);
  }

  formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return date.toLocaleDateString();
  }

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  refresh() {
    this.loadData();
  }
}

// Export for both Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = KnowledgeCenterShopify;
}
