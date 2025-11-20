/**
 * Knowledge Center Component
 * Responsive, searchable knowledge base with gated access and theme customization
 *
 * Usage:
 * const knowledgeCenter = new KnowledgeCenter({
 *   backendUrl: 'https://your-backend.vercel.app',
 *   userEmail: '{{ customer.email }}',
 *   userTags: ['affiliates'], // User's access tags
 *   containerId: 'knowledge-center-container',
 *   theme: { ... } // Custom theme settings
 * });
 */

class KnowledgeCenter {
  constructor(config = {}) {
    // Default configuration
    this.config = {
      backendUrl: config.backendUrl || '',
      userEmail: config.userEmail || null,
      userTags: config.userTags || [],
      containerId: config.containerId || 'knowledge-center',
      enableSearch: config.enableSearch !== false,
      enableCategories: config.enableCategories !== false,
      enableAnalytics: config.enableAnalytics !== false,
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

      // Load data
      await Promise.all([
        this.loadCategories(),
        this.loadArticles()
      ]);
    } catch (error) {
      console.error('Knowledge Center initialization error:', error);
      this.showError('Failed to initialize knowledge center');
    }
  }

  /**
   * Inject custom styles
   */
  injectStyles() {
    const styleId = 'knowledge-center-styles';

    // Remove existing styles if any
    const existingStyles = document.getElementById(styleId);
    if (existingStyles) {
      existingStyles.remove();
    }

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

      .kc-article-badge.locked {
        background: #f59e0b;
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

      .kc-media-container {
        margin: calc(${this.config.theme.spacing} * 2) 0;
      }

      .kc-media-item {
        margin-bottom: ${this.config.theme.spacing};
      }

      .kc-media-video {
        position: relative;
        padding-bottom: 56.25%;
        height: 0;
        overflow: hidden;
        border-radius: ${this.config.theme.borderRadius};
      }

      .kc-media-video iframe {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
      }

      .kc-media-image {
        max-width: 100%;
        height: auto;
        border-radius: ${this.config.theme.borderRadius};
        box-shadow: ${this.config.theme.cardShadow};
      }

      .kc-media-caption {
        font-size: 0.875rem;
        color: ${this.config.theme.secondaryColor};
        margin-top: 8px;
        text-align: center;
        font-style: italic;
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

      /* Responsive design */
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
   * Render the main UI
   */
  render() {
    if (this.state.currentArticle) {
      this.renderArticleView();
    } else {
      this.renderListView();
    }
  }

  /**
   * Render article list view
   */
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

    // Attach event listeners
    this.attachListViewEventListeners();
  }

  /**
   * Render categories
   */
  renderCategories() {
    if (this.state.categories.length === 0) {
      return '';
    }

    const allBtn = `
      <button
        class="kc-category-btn ${!this.state.currentCategory ? 'active' : ''}"
        data-category="all"
      >
        All Articles
        <span class="kc-category-count">${this.state.articles.length}</span>
      </button>
    `;

    const categoryButtons = this.state.categories.map(category => `
      <button
        class="kc-category-btn ${this.state.currentCategory === category.id ? 'active' : ''}"
        data-category="${this.escapeHtml(category.id)}"
      >
        ${category.icon ? `<span>${category.icon}</span>` : ''}
        ${this.escapeHtml(category.name)}
        <span class="kc-category-count">${category.articleCount || 0}</span>
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

    // Pagination
    const startIndex = (this.state.currentPage - 1) * this.config.articlesPerPage;
    const endIndex = startIndex + this.config.articlesPerPage;
    const paginatedArticles = filteredArticles.slice(startIndex, endIndex);
    const totalPages = Math.ceil(filteredArticles.length / this.config.articlesPerPage);

    const articlesHtml = paginatedArticles.map(article => this.renderArticleCard(article)).join('');

    const paginationHtml = totalPages > 1 ? this.renderPagination(totalPages) : '';

    return `
      <div class="kc-articles-grid">
        ${articlesHtml}
      </div>
      ${paginationHtml}
    `;
  }

  /**
   * Render single article card
   */
  renderArticleCard(article) {
    const isFeatured = article.metadata.featured;
    const hasMedia = article.mediaCount > 0;

    return `
      <div class="kc-article-card ${isFeatured ? 'featured' : ''}" data-article-id="${article.id}">
        ${isFeatured ? '<span class="kc-article-badge featured">⭐ Featured</span>' : ''}
        <h3 class="kc-article-title">${this.escapeHtml(article.title)}</h3>
        <p class="kc-article-description">${this.escapeHtml(article.description)}</p>
        <div class="kc-article-meta">
          <span>📅 ${this.formatDate(article.metadata.createdAt)}</span>
          ${article.metadata.views ? `<span>👁️ ${article.metadata.views} views</span>` : ''}
          ${hasMedia ? `<span>🎬 ${article.mediaCount} media</span>` : ''}
        </div>
        ${article.tags && article.tags.length > 0 ? `
          <div class="kc-article-tags">
            ${article.tags.slice(0, 3).map(tag => `<span class="kc-tag">${this.escapeHtml(tag)}</span>`).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Render pagination
   */
  renderPagination(totalPages) {
    const pages = [];

    pages.push(`
      <button class="kc-page-btn" data-page="prev" ${this.state.currentPage === 1 ? 'disabled' : ''}>
        ← Previous
      </button>
    `);

    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= this.state.currentPage - 2 && i <= this.state.currentPage + 2)) {
        pages.push(`
          <button class="kc-page-btn ${i === this.state.currentPage ? 'active' : ''}" data-page="${i}">
            ${i}
          </button>
        `);
      } else if (i === this.state.currentPage - 3 || i === this.state.currentPage + 3) {
        pages.push('<span class="kc-page-btn" disabled>...</span>');
      }
    }

    pages.push(`
      <button class="kc-page-btn" data-page="next" ${this.state.currentPage === totalPages ? 'disabled' : ''}>
        Next →
      </button>
    `);

    return `<div class="kc-pagination">${pages.join('')}</div>`;
  }

  /**
   * Render article view
   */
  renderArticleView() {
    const article = this.state.currentArticle;

    if (!article) {
      this.renderListView();
      return;
    }

    const mediaHtml = article.content.media && article.content.media.length > 0
      ? this.renderMedia(article.content.media)
      : '';

    this.container.innerHTML = `
      <div class="kc-container">
        <div class="kc-article-view">
          <button class="kc-back-btn" id="kc-back-btn">
            ← Back to articles
          </button>

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

          ${mediaHtml}
        </div>
      </div>
    `;

    // Attach event listeners
    document.getElementById('kc-back-btn').addEventListener('click', () => {
      this.state.currentArticle = null;
      this.render();
    });
  }

  /**
   * Render media items
   */
  renderMedia(mediaItems) {
    const mediaHtml = mediaItems.map(media => {
      if (media.type === 'video') {
        return `
          <div class="kc-media-item">
            <div class="kc-media-video">
              <iframe
                src="${this.escapeHtml(media.url)}"
                frameborder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowfullscreen
              ></iframe>
            </div>
            ${media.caption ? `<p class="kc-media-caption">${this.escapeHtml(media.caption)}</p>` : ''}
          </div>
        `;
      } else if (media.type === 'image') {
        return `
          <div class="kc-media-item">
            <img
              src="${this.escapeHtml(media.url)}"
              alt="${this.escapeHtml(media.alt || '')}"
              class="kc-media-image"
            />
            ${media.caption ? `<p class="kc-media-caption">${this.escapeHtml(media.caption)}</p>` : ''}
          </div>
        `;
      } else if (media.type === 'embed') {
        return `
          <div class="kc-media-item">
            ${media.html}
            ${media.caption ? `<p class="kc-media-caption">${this.escapeHtml(media.caption)}</p>` : ''}
          </div>
        `;
      }
      return '';
    }).join('');

    return `<div class="kc-media-container">${mediaHtml}</div>`;
  }

  /**
   * Attach event listeners for list view
   */
  attachListViewEventListeners() {
    // Search input
    const searchInput = document.getElementById('kc-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.state.searchQuery = e.target.value;
        this.state.currentPage = 1;
        this.render();
      });
    }

    // Category buttons
    const categoryButtons = document.querySelectorAll('.kc-category-btn');
    categoryButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const category = btn.dataset.category;
        this.state.currentCategory = category === 'all' ? null : category;
        this.state.currentPage = 1;
        this.render();
      });
    });

    // Article cards
    const articleCards = document.querySelectorAll('.kc-article-card');
    articleCards.forEach(card => {
      card.addEventListener('click', () => {
        const articleId = card.dataset.articleId;
        this.openArticle(articleId);
      });
    });

    // Pagination
    const pageButtons = document.querySelectorAll('.kc-page-btn[data-page]');
    pageButtons.forEach(btn => {
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
   * Load categories from API
   */
  async loadCategories() {
    try {
      const response = await fetch(
        `${this.config.backendUrl}/api/knowledge-center?action=get-categories`,
        { method: 'GET' }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        this.state.categories = data.categories;
        this.render();
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  }

  /**
   * Load articles from API
   */
  async loadArticles() {
    this.state.loading = true;
    this.render();

    try {
      const params = new URLSearchParams({
        action: 'get-articles',
        userTags: JSON.stringify(this.config.userTags)
      });

      if (this.config.userEmail) {
        params.append('userEmail', this.config.userEmail);
      }

      const response = await fetch(
        `${this.config.backendUrl}/api/knowledge-center?${params}`,
        { method: 'GET' }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        this.state.articles = data.articles;

        // Sort featured first if enabled
        if (this.config.showFeaturedFirst) {
          this.state.articles.sort((a, b) => {
            if (a.metadata.featured && !b.metadata.featured) return -1;
            if (!a.metadata.featured && b.metadata.featured) return 1;
            return 0;
          });
        }
      }
    } catch (error) {
      console.error('Error loading articles:', error);
      this.showError('Failed to load articles');
    } finally {
      this.state.loading = false;
      this.render();
    }
  }

  /**
   * Open article
   */
  async openArticle(articleId) {
    this.state.loading = true;
    this.render();

    try {
      const params = new URLSearchParams({
        action: 'get-article',
        id: articleId,
        userTags: JSON.stringify(this.config.userTags)
      });

      if (this.config.userEmail) {
        params.append('userEmail', this.config.userEmail);
      }

      const response = await fetch(
        `${this.config.backendUrl}/api/knowledge-center?${params}`,
        { method: 'GET' }
      );

      if (!response.ok) {
        if (response.status === 403) {
          const data = await response.json();
          this.showAccessDenied(data.message, data.requiredTags);
          return;
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        this.state.currentArticle = data.article;

        // Track view
        if (this.config.enableAnalytics) {
          this.trackView(articleId);
        }

        this.render();
      }
    } catch (error) {
      console.error('Error loading article:', error);
      this.showError('Failed to load article');
    } finally {
      this.state.loading = false;
    }
  }

  /**
   * Track article view
   */
  async trackView(articleId) {
    try {
      await fetch(`${this.config.backendUrl}/api/knowledge-center?action=track-view`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleId,
          userEmail: this.config.userEmail,
          userTags: this.config.userTags
        })
      });
    } catch (error) {
      console.error('Error tracking view:', error);
    }
  }

  /**
   * Get filtered articles
   */
  getFilteredArticles() {
    let filtered = [...this.state.articles];

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
   * Show access denied message
   */
  showAccessDenied(message, requiredTags) {
    this.container.innerHTML = `
      <div class="kc-container">
        <button class="kc-back-btn" onclick="location.reload()">
          ← Back to articles
        </button>
        <div class="kc-access-denied">
          <div class="kc-access-denied-icon">🔒</div>
          <h2>Access Denied</h2>
          <p>${this.escapeHtml(message)}</p>
          ${requiredTags && requiredTags.length > 0 ? `
            <p><strong>Required access:</strong> ${requiredTags.map(t => this.escapeHtml(t)).join(', ')}</p>
          ` : ''}
        </div>
      </div>
    `;
  }

  /**
   * Show error message
   */
  showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'kc-error';
    errorDiv.textContent = message;
    this.container.insertBefore(errorDiv, this.container.firstChild);

    setTimeout(() => {
      errorDiv.remove();
    }, 5000);
  }

  /**
   * Format date
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

  /**
   * Escape HTML
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Set user email (for dynamic updates)
   */
  setUserEmail(email) {
    this.config.userEmail = email;
    this.loadArticles();
  }

  /**
   * Set user tags (for dynamic updates)
   */
  setUserTags(tags) {
    this.config.userTags = tags;
    this.loadArticles();
  }

  /**
   * Refresh articles
   */
  refresh() {
    this.loadArticles();
    this.loadCategories();
  }
}

// Export for both Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = KnowledgeCenter;
}
