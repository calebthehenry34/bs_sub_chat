/**
 * Knowledge Center - SEO Optimized with Shopify Pages
 * Each article is a real Shopify page with full SEO support
 *
 * Benefits:
 * - Individual URLs for each article
 * - Full SEO: titles, meta descriptions, canonical URLs
 * - Google indexes perfectly
 * - Sitemap inclusion automatic
 * - Gated access via customer tags
 *
 * Usage:
 * const knowledgeCenter = new KnowledgeCenterSEO({
 *   userEmail: '{{ customer.email }}',
 *   userTags: ['affiliates'],
 *   categories: [...], // Custom categories
 *   containerId: 'knowledge-center'
 * });
 */

class KnowledgeCenterSEO {
  constructor(config = {}) {
    this.config = {
      userEmail: config.userEmail || null,
      userTags: config.userTags || [],
      categories: config.categories || this.getDefaultCategories(),
      containerId: config.containerId || 'knowledge-center',
      pagePrefix: config.pagePrefix || 'kb-',
      enableSearch: config.enableSearch !== false,
      enableCategories: config.enableCategories !== false,
      articlesPerPage: config.articlesPerPage || 12,
      showFeaturedFirst: config.showFeaturedFirst !== false,
      shopDomain: config.shopDomain || window.location.hostname,
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

    this.state = {
      articles: [],
      currentCategory: null,
      searchQuery: '',
      loading: false,
      currentPage: 1
    };

    this.container = null;
    this.init();
  }

  /**
   * Get default categories
   */
  getDefaultCategories() {
    return [
      { id: 'getting-started', name: 'Getting Started', icon: '🚀', description: 'New to our platform?' },
      { id: 'tutorials', name: 'Tutorials', icon: '📚', description: 'Step-by-step guides' },
      { id: 'faq', name: 'FAQ', icon: '❓', description: 'Frequently asked questions' },
      { id: 'troubleshooting', name: 'Troubleshooting', icon: '🔧', description: 'Fix common issues' },
      { id: 'advanced', name: 'Advanced', icon: '⚡', description: 'For power users' },
      { id: 'affiliates', name: 'Affiliates', icon: '🎯', description: 'Partner resources' }
    ];
  }

  /**
   * Initialize
   */
  async init() {
    try {
      this.container = document.getElementById(this.config.containerId);
      if (!this.container) {
        console.error(`Knowledge Center: Container #${this.config.containerId} not found`);
        return;
      }

      this.injectStyles();
      this.render();
      await this.loadArticlesFromPages();
    } catch (error) {
      console.error('Knowledge Center initialization error:', error);
      this.showError('Failed to initialize knowledge center');
    }
  }

  /**
   * Load articles from Shopify pages
   */
  async loadArticlesFromPages() {
    this.state.loading = true;
    this.render();

    try {
      // Fetch all pages
      const response = await fetch(`/pages?view=json`);

      if (!response.ok) {
        throw new Error('Failed to fetch pages');
      }

      const html = await response.text();

      // Parse pages from HTML
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // Find all KB article pages
      this.state.articles = await this.parseKBPages(doc);

      // Filter by access
      this.state.articles = this.state.articles.filter(article => this.hasAccess(article));

      // Sort
      if (this.config.showFeaturedFirst) {
        this.state.articles.sort((a, b) => {
          if (a.featured && !b.featured) return -1;
          if (!a.featured && b.featured) return 1;
          return (a.order || 999) - (b.order || 999);
        });
      }

      // Update category counts
      this.updateCategoryCounts();

    } catch (error) {
      console.error('Error loading articles:', error);
      this.showError('Failed to load articles. Make sure you have KB pages created.');
    } finally {
      this.state.loading = false;
      this.render();
    }
  }

  /**
   * Parse KB pages from document
   * Looks for pages with kb- prefix or kb-article tag
   */
  async parseKBPages(doc) {
    const articles = [];

    // Method 1: Look for links in the page list
    const links = doc.querySelectorAll('a[href*="/pages/kb-"], a[href*="/pages/"][data-kb]');

    for (const link of links) {
      const url = link.getAttribute('href');
      const handle = url.split('/pages/')[1]?.split('?')[0];

      if (!handle || !handle.startsWith(this.config.pagePrefix)) continue;

      try {
        // Fetch individual page to get full content
        const pageData = await this.fetchPageData(handle);
        if (pageData) {
          articles.push(pageData);
        }
      } catch (error) {
        console.error(`Error fetching page ${handle}:`, error);
      }
    }

    return articles;
  }

  /**
   * Fetch page data
   */
  async fetchPageData(handle) {
    try {
      const response = await fetch(`/pages/${handle}`);
      if (!response.ok) return null;

      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // Extract metadata from data attributes or meta tags
      const container = doc.querySelector('[data-kb-article]');

      if (!container) {
        // No KB article marker found
        return null;
      }

      const title = doc.querySelector('h1')?.textContent.trim() ||
                   doc.querySelector('title')?.textContent.split('|')[0].trim() ||
                   handle.replace(this.config.pagePrefix, '').replace(/-/g, ' ');

      const description = doc.querySelector('meta[name="description"]')?.content ||
                         doc.querySelector('[data-kb-description]')?.textContent ||
                         this.extractExcerpt(container.innerHTML);

      return {
        id: handle,
        title: title,
        handle: handle,
        url: `/pages/${handle}`,
        description: description,
        category: container.getAttribute('data-kb-category') || 'general',
        tags: (container.getAttribute('data-kb-tags') || '').split(',').map(t => t.trim()).filter(t => t),
        featured: container.getAttribute('data-kb-featured') === 'true',
        order: parseInt(container.getAttribute('data-kb-order')) || 999,
        requiredTags: (container.getAttribute('data-kb-required-tags') || '').split(',').map(t => t.trim()).filter(t => t),
        author: container.getAttribute('data-kb-author') || 'Admin',
        updatedAt: container.getAttribute('data-kb-updated') || new Date().toISOString()
      };
    } catch (error) {
      console.error(`Error parsing page ${handle}:`, error);
      return null;
    }
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
   * Check if user has access
   */
  hasAccess(article) {
    if (!article.requiredTags || article.requiredTags.length === 0) {
      return true;
    }

    return article.requiredTags.every(tag => this.config.userTags.includes(tag));
  }

  /**
   * Update category counts
   */
  updateCategoryCounts() {
    this.config.categories.forEach(category => {
      category.count = this.state.articles.filter(a => a.category === category.id).length;
    });
  }

  /**
   * Get filtered articles
   */
  getFilteredArticles() {
    let filtered = [...this.state.articles];

    if (this.state.currentCategory) {
      filtered = filtered.filter(a => a.category === this.state.currentCategory);
    }

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
   * Inject styles (same as before)
   */
  injectStyles() {
    const styleId = 'knowledge-center-seo-styles';
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
        text-decoration: none;
        color: inherit;
        display: block;
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
      }
    `;

    const styleElement = document.createElement('style');
    styleElement.id = styleId;
    styleElement.textContent = styles;
    document.head.appendChild(styleElement);
  }

  /**
   * Render main UI
   */
  render() {
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

    this.attachEventListeners();
  }

  /**
   * Render categories
   */
  renderCategories() {
    const allBtn = `
      <button class="kc-category-btn ${!this.state.currentCategory ? 'active' : ''}" data-category="all">
        All Articles
        <span class="kc-category-count">${this.state.articles.length}</span>
      </button>
    `;

    const categoryButtons = this.config.categories
      .filter(cat => cat.count > 0) // Only show categories with articles
      .map(category => `
        <button class="kc-category-btn ${this.state.currentCategory === category.id ? 'active' : ''}" data-category="${this.escapeHtml(category.id)}">
          ${category.icon ? `<span>${category.icon}</span>` : ''}
          ${this.escapeHtml(category.name)}
          <span class="kc-category-count">${category.count}</span>
        </button>
      `).join('');

    return allBtn + categoryButtons;
  }

  /**
   * Render articles grid
   */
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

  /**
   * Render article card
   */
  renderArticleCard(article) {
    return `
      <a href="${article.url}" class="kc-article-card ${article.featured ? 'featured' : ''}">
        ${article.featured ? '<span class="kc-article-badge featured">⭐ Featured</span>' : ''}
        <h3 class="kc-article-title">${this.escapeHtml(article.title)}</h3>
        <p class="kc-article-description">${this.escapeHtml(article.description)}</p>
        <div class="kc-article-meta">
          <span>📅 ${this.formatDate(article.updatedAt)}</span>
          ${article.author ? `<span>✍️ ${this.escapeHtml(article.author)}</span>` : ''}
        </div>
        ${article.tags && article.tags.length > 0 ? `
          <div class="kc-article-tags">
            ${article.tags.slice(0, 3).map(tag => `<span class="kc-tag">${this.escapeHtml(tag)}</span>`).join('')}
          </div>
        ` : ''}
      </a>
    `;
  }

  /**
   * Render pagination
   */
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

  /**
   * Attach event listeners
   */
  attachEventListeners() {
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

  /**
   * Helpers
   */
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

  showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'kc-error';
    errorDiv.textContent = message;
    this.container.insertBefore(errorDiv, this.container.firstChild);
    setTimeout(() => errorDiv.remove(), 5000);
  }

  refresh() {
    this.loadArticlesFromPages();
  }
}

// Export for both Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = KnowledgeCenterSEO;
}
