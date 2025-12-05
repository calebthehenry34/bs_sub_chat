/**
 * Digital Asset Management (DAM) Component
 * Shopify-compatible file manager with Dropbox/Google Drive style interface
 * Access restricted to users with 'admin' or 'affiliate' tags
 */

class DAMComponent {
  constructor(config = {}) {
    this.config = {
      backendUrl: config.backendUrl || '',
      containerId: config.containerId || 'dam-container',
      userEmail: config.userEmail || null,
      userTags: config.userTags || [],
      theme: {
        primaryColor: config.theme?.primaryColor || '#2563eb',
        secondaryColor: config.theme?.secondaryColor || '#64748b',
        backgroundColor: config.theme?.backgroundColor || '#f8fafc',
        cardBackground: config.theme?.cardBackground || '#ffffff',
        textColor: config.theme?.textColor || '#1e293b',
        borderColor: config.theme?.borderColor || '#e2e8f0',
        borderRadius: config.theme?.borderRadius || '8px',
        fontFamily: config.theme?.fontFamily || '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        ...config.theme
      }
    };

    this.state = {
      currentFolderId: 'root',
      folders: [],
      files: [],
      breadcrumbs: [],
      selectedItems: [],
      viewMode: 'grid',
      sortBy: 'name',
      sortOrder: 'asc',
      searchQuery: '',
      isLoading: false,
      dragOver: false,
      contextMenu: null,
      modal: null
    };

    this.init();
  }

  async init() {
    // Check access
    if (!this.hasAccess()) {
      this.renderAccessDenied();
      return;
    }

    this.container = document.getElementById(this.config.containerId);
    if (!this.container) {
      console.error('DAM container not found:', this.config.containerId);
      return;
    }

    this.injectStyles();
    this.render();
    this.attachEventListeners();
    await this.loadContents();
  }

  hasAccess() {
    const allowedTags = ['admin', 'affiliate', 'affiliates'];
    return this.config.userTags.some(tag => allowedTags.includes(tag.toLowerCase()));
  }

  injectStyles() {
    const styleId = 'dam-styles';
    if (document.getElementById(styleId)) return;

    const styles = `
      .dam-container {
        font-family: ${this.config.theme.fontFamily};
        background: ${this.config.theme.backgroundColor};
        color: ${this.config.theme.textColor};
        min-height: 600px;
        border-radius: ${this.config.theme.borderRadius};
        overflow: hidden;
      }
      .dam-header {
        background: ${this.config.theme.cardBackground};
        border-bottom: 1px solid ${this.config.theme.borderColor};
        padding: 16px 24px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 12px;
      }
      .dam-breadcrumbs {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }
      .dam-breadcrumb {
        color: ${this.config.theme.primaryColor};
        cursor: pointer;
        font-size: 14px;
        padding: 4px 8px;
        border-radius: 4px;
        transition: background 0.2s;
      }
      .dam-breadcrumb:hover { background: ${this.config.theme.backgroundColor}; }
      .dam-breadcrumb.current {
        color: ${this.config.theme.textColor};
        font-weight: 600;
        cursor: default;
      }
      .dam-breadcrumb-sep { color: ${this.config.theme.secondaryColor}; }
      .dam-toolbar {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .dam-search {
        position: relative;
      }
      .dam-search input {
        padding: 8px 12px 8px 36px;
        border: 1px solid ${this.config.theme.borderColor};
        border-radius: 6px;
        font-size: 14px;
        width: 240px;
        outline: none;
        transition: border-color 0.2s, box-shadow 0.2s;
      }
      .dam-search input:focus {
        border-color: ${this.config.theme.primaryColor};
        box-shadow: 0 0 0 3px ${this.config.theme.primaryColor}22;
      }
      .dam-search-icon {
        position: absolute;
        left: 10px;
        top: 50%;
        transform: translateY(-50%);
        color: ${this.config.theme.secondaryColor};
      }
      .dam-btn {
        padding: 8px 16px;
        border: none;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        transition: all 0.2s;
      }
      .dam-btn-primary {
        background: ${this.config.theme.primaryColor};
        color: white;
      }
      .dam-btn-primary:hover { filter: brightness(1.1); }
      .dam-btn-secondary {
        background: ${this.config.theme.cardBackground};
        border: 1px solid ${this.config.theme.borderColor};
        color: ${this.config.theme.textColor};
      }
      .dam-btn-secondary:hover { background: ${this.config.theme.backgroundColor}; }
      .dam-btn-icon {
        padding: 8px;
        background: transparent;
        border: 1px solid transparent;
      }
      .dam-btn-icon:hover { background: ${this.config.theme.backgroundColor}; }
      .dam-btn-icon.active {
        background: ${this.config.theme.primaryColor}15;
        color: ${this.config.theme.primaryColor};
      }
      .dam-actions-bar {
        background: ${this.config.theme.cardBackground};
        border-bottom: 1px solid ${this.config.theme.borderColor};
        padding: 12px 24px;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .dam-actions-left { display: flex; align-items: center; gap: 8px; }
      .dam-actions-right { display: flex; align-items: center; gap: 8px; }
      .dam-sort-dropdown {
        padding: 6px 12px;
        border: 1px solid ${this.config.theme.borderColor};
        border-radius: 6px;
        font-size: 13px;
        background: white;
        cursor: pointer;
      }
      .dam-content {
        padding: 24px;
        min-height: 400px;
        position: relative;
      }
      .dam-content.drag-over {
        background: ${this.config.theme.primaryColor}08;
      }
      .dam-content.drag-over::after {
        content: 'Drop files here to upload';
        position: absolute;
        inset: 24px;
        border: 2px dashed ${this.config.theme.primaryColor};
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        color: ${this.config.theme.primaryColor};
        background: ${this.config.theme.primaryColor}08;
        pointer-events: none;
        z-index: 10;
      }
      .dam-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
        gap: 16px;
      }
      .dam-list {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .dam-item {
        background: ${this.config.theme.cardBackground};
        border: 1px solid ${this.config.theme.borderColor};
        border-radius: ${this.config.theme.borderRadius};
        cursor: pointer;
        transition: all 0.2s;
        position: relative;
      }
      .dam-item:hover { border-color: ${this.config.theme.primaryColor}; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
      .dam-item.selected {
        border-color: ${this.config.theme.primaryColor};
        background: ${this.config.theme.primaryColor}08;
      }
      .dam-item-grid {
        padding: 16px;
        text-align: center;
      }
      .dam-item-icon {
        width: 64px;
        height: 64px;
        margin: 0 auto 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 48px;
      }
      .dam-item-preview {
        width: 100%;
        height: 100px;
        object-fit: cover;
        border-radius: 4px;
        margin-bottom: 12px;
      }
      .dam-item-name {
        font-size: 13px;
        font-weight: 500;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .dam-item-meta {
        font-size: 11px;
        color: ${this.config.theme.secondaryColor};
        margin-top: 4px;
      }
      .dam-item-list {
        display: flex;
        align-items: center;
        padding: 12px 16px;
        gap: 16px;
      }
      .dam-item-list .dam-item-icon {
        width: 40px;
        height: 40px;
        font-size: 32px;
        margin: 0;
        flex-shrink: 0;
      }
      .dam-item-list .dam-item-preview {
        width: 40px;
        height: 40px;
        margin: 0;
        flex-shrink: 0;
      }
      .dam-item-list-info { flex: 1; min-width: 0; }
      .dam-item-list-name {
        font-size: 14px;
        font-weight: 500;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .dam-item-list-meta {
        font-size: 12px;
        color: ${this.config.theme.secondaryColor};
      }
      .dam-item-list-size, .dam-item-list-date {
        font-size: 13px;
        color: ${this.config.theme.secondaryColor};
        flex-shrink: 0;
        width: 100px;
      }
      .dam-item-checkbox {
        position: absolute;
        top: 8px;
        left: 8px;
        width: 20px;
        height: 20px;
        border: 2px solid ${this.config.theme.borderColor};
        border-radius: 4px;
        background: white;
        display: none;
        align-items: center;
        justify-content: center;
        z-index: 5;
      }
      .dam-item:hover .dam-item-checkbox,
      .dam-item.selected .dam-item-checkbox { display: flex; }
      .dam-item.selected .dam-item-checkbox {
        background: ${this.config.theme.primaryColor};
        border-color: ${this.config.theme.primaryColor};
        color: white;
      }
      .dam-empty {
        text-align: center;
        padding: 60px 20px;
        color: ${this.config.theme.secondaryColor};
      }
      .dam-empty-icon { font-size: 64px; margin-bottom: 16px; opacity: 0.5; }
      .dam-empty-text { font-size: 16px; margin-bottom: 8px; }
      .dam-empty-hint { font-size: 14px; }
      .dam-loading {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 60px;
      }
      .dam-spinner {
        width: 40px;
        height: 40px;
        border: 3px solid ${this.config.theme.borderColor};
        border-top-color: ${this.config.theme.primaryColor};
        border-radius: 50%;
        animation: dam-spin 0.8s linear infinite;
      }
      @keyframes dam-spin { to { transform: rotate(360deg); } }
      .dam-modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
      }
      .dam-modal {
        background: ${this.config.theme.cardBackground};
        border-radius: 12px;
        width: 90%;
        max-width: 500px;
        max-height: 90vh;
        overflow: auto;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      }
      .dam-modal-header {
        padding: 20px 24px;
        border-bottom: 1px solid ${this.config.theme.borderColor};
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .dam-modal-title { font-size: 18px; font-weight: 600; }
      .dam-modal-close {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: ${this.config.theme.secondaryColor};
        padding: 4px;
      }
      .dam-modal-body { padding: 24px; }
      .dam-modal-footer {
        padding: 16px 24px;
        border-top: 1px solid ${this.config.theme.borderColor};
        display: flex;
        justify-content: flex-end;
        gap: 12px;
      }
      .dam-form-group { margin-bottom: 16px; }
      .dam-form-label {
        display: block;
        font-size: 14px;
        font-weight: 500;
        margin-bottom: 6px;
      }
      .dam-form-input {
        width: 100%;
        padding: 10px 12px;
        border: 1px solid ${this.config.theme.borderColor};
        border-radius: 6px;
        font-size: 14px;
        outline: none;
        box-sizing: border-box;
      }
      .dam-form-input:focus {
        border-color: ${this.config.theme.primaryColor};
        box-shadow: 0 0 0 3px ${this.config.theme.primaryColor}22;
      }
      .dam-context-menu {
        position: fixed;
        background: ${this.config.theme.cardBackground};
        border: 1px solid ${this.config.theme.borderColor};
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        min-width: 180px;
        z-index: 1000;
        padding: 6px 0;
      }
      .dam-context-item {
        padding: 10px 16px;
        font-size: 14px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .dam-context-item:hover { background: ${this.config.theme.backgroundColor}; }
      .dam-context-item.danger { color: #dc2626; }
      .dam-context-divider {
        height: 1px;
        background: ${this.config.theme.borderColor};
        margin: 6px 0;
      }
      .dam-preview-modal { max-width: 900px; }
      .dam-preview-content {
        text-align: center;
        background: #000;
        border-radius: 8px;
        overflow: hidden;
        margin-bottom: 16px;
      }
      .dam-preview-content img,
      .dam-preview-content video {
        max-width: 100%;
        max-height: 60vh;
      }
      .dam-preview-info { text-align: left; }
      .dam-preview-info-row {
        display: flex;
        padding: 8px 0;
        border-bottom: 1px solid ${this.config.theme.borderColor};
      }
      .dam-preview-info-label {
        width: 120px;
        font-weight: 500;
        color: ${this.config.theme.secondaryColor};
      }
      .dam-upload-zone {
        border: 2px dashed ${this.config.theme.borderColor};
        border-radius: 12px;
        padding: 40px;
        text-align: center;
        cursor: pointer;
        transition: all 0.2s;
      }
      .dam-upload-zone:hover,
      .dam-upload-zone.drag-over {
        border-color: ${this.config.theme.primaryColor};
        background: ${this.config.theme.primaryColor}08;
      }
      .dam-upload-icon { font-size: 48px; margin-bottom: 12px; }
      .dam-upload-text { font-size: 16px; margin-bottom: 8px; }
      .dam-upload-hint { font-size: 13px; color: ${this.config.theme.secondaryColor}; }
      .dam-upload-progress {
        margin-top: 16px;
        background: ${this.config.theme.borderColor};
        height: 8px;
        border-radius: 4px;
        overflow: hidden;
      }
      .dam-upload-progress-bar {
        height: 100%;
        background: ${this.config.theme.primaryColor};
        transition: width 0.3s;
      }
      .dam-selection-bar {
        background: ${this.config.theme.primaryColor};
        color: white;
        padding: 12px 24px;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .dam-selection-bar button {
        background: rgba(255,255,255,0.2);
        border: none;
        color: white;
        padding: 8px 16px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
      }
      .dam-selection-bar button:hover { background: rgba(255,255,255,0.3); }
      .dam-access-denied {
        padding: 60px 20px;
        text-align: center;
      }
      .dam-access-denied-icon { font-size: 64px; margin-bottom: 16px; }
      .dam-access-denied-title { font-size: 24px; font-weight: 600; margin-bottom: 8px; }
      .dam-access-denied-text { color: ${this.config.theme.secondaryColor}; }
      .dam-folder-tree {
        position: absolute;
        background: ${this.config.theme.cardBackground};
        border: 1px solid ${this.config.theme.borderColor};
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        max-height: 300px;
        overflow-y: auto;
        min-width: 250px;
        z-index: 100;
      }
      .dam-folder-tree-item {
        padding: 10px 16px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .dam-folder-tree-item:hover { background: ${this.config.theme.backgroundColor}; }
      .dam-folder-tree-item.selected { background: ${this.config.theme.primaryColor}15; }
    `;

    const styleTag = document.createElement('style');
    styleTag.id = styleId;
    styleTag.textContent = styles;
    document.head.appendChild(styleTag);
  }

  render() {
    this.container.innerHTML = `
      <div class="dam-container">
        <div class="dam-header">
          <div class="dam-breadcrumbs" id="dam-breadcrumbs"></div>
          <div class="dam-toolbar">
            <div class="dam-search">
              <span class="dam-search-icon">&#128269;</span>
              <input type="text" placeholder="Search files and folders..." id="dam-search-input" value="${this.state.searchQuery}">
            </div>
            <button class="dam-btn dam-btn-primary" id="dam-upload-btn">
              <span>&#8593;</span> Upload
            </button>
            <button class="dam-btn dam-btn-secondary" id="dam-new-folder-btn">
              <span>&#128193;</span> New Folder
            </button>
          </div>
        </div>
        <div class="dam-actions-bar">
          <div class="dam-actions-left">
            <select class="dam-sort-dropdown" id="dam-sort">
              <option value="name-asc" ${this.state.sortBy === 'name' && this.state.sortOrder === 'asc' ? 'selected' : ''}>Name (A-Z)</option>
              <option value="name-desc" ${this.state.sortBy === 'name' && this.state.sortOrder === 'desc' ? 'selected' : ''}>Name (Z-A)</option>
              <option value="updatedAt-desc" ${this.state.sortBy === 'updatedAt' && this.state.sortOrder === 'desc' ? 'selected' : ''}>Modified (Newest)</option>
              <option value="updatedAt-asc" ${this.state.sortBy === 'updatedAt' && this.state.sortOrder === 'asc' ? 'selected' : ''}>Modified (Oldest)</option>
              <option value="size-desc" ${this.state.sortBy === 'size' && this.state.sortOrder === 'desc' ? 'selected' : ''}>Size (Largest)</option>
              <option value="size-asc" ${this.state.sortBy === 'size' && this.state.sortOrder === 'asc' ? 'selected' : ''}>Size (Smallest)</option>
            </select>
          </div>
          <div class="dam-actions-right">
            <button class="dam-btn dam-btn-icon ${this.state.viewMode === 'grid' ? 'active' : ''}" id="dam-view-grid" title="Grid view">&#9638;</button>
            <button class="dam-btn dam-btn-icon ${this.state.viewMode === 'list' ? 'active' : ''}" id="dam-view-list" title="List view">&#9776;</button>
          </div>
        </div>
        <div id="dam-selection-bar" style="display: none;"></div>
        <div class="dam-content" id="dam-content"></div>
      </div>
    `;
    this.renderBreadcrumbs();
  }

  renderBreadcrumbs() {
    const container = document.getElementById('dam-breadcrumbs');
    if (!container) return;

    container.innerHTML = this.state.breadcrumbs.map((b, i) => {
      const isLast = i === this.state.breadcrumbs.length - 1;
      return `
        ${i > 0 ? '<span class="dam-breadcrumb-sep">/</span>' : ''}
        <span class="dam-breadcrumb ${isLast ? 'current' : ''}" data-folder-id="${b.id}">${b.name}</span>
      `;
    }).join('');
  }

  renderContents() {
    const container = document.getElementById('dam-content');
    if (!container) return;

    if (this.state.isLoading) {
      container.innerHTML = '<div class="dam-loading"><div class="dam-spinner"></div></div>';
      return;
    }

    const { folders, files } = this.state;
    if (folders.length === 0 && files.length === 0) {
      container.innerHTML = `
        <div class="dam-empty">
          <div class="dam-empty-icon">&#128193;</div>
          <div class="dam-empty-text">${this.state.searchQuery ? 'No results found' : 'This folder is empty'}</div>
          <div class="dam-empty-hint">${this.state.searchQuery ? 'Try a different search term' : 'Upload files or create a new folder to get started'}</div>
        </div>
      `;
      return;
    }

    const isGrid = this.state.viewMode === 'grid';
    const items = [
      ...folders.map(f => this.renderItem(f, 'folder', isGrid)),
      ...files.map(f => this.renderItem(f, 'file', isGrid))
    ];

    container.innerHTML = `<div class="dam-${isGrid ? 'grid' : 'list'}">${items.join('')}</div>`;
  }

  renderItem(item, type, isGrid) {
    const isSelected = this.state.selectedItems.some(s => s.id === item.id && s.type === type);
    const isFolder = type === 'folder';

    const icon = isFolder ? '&#128193;' : this.getFileIcon(item.category);
    const canPreview = !isFolder && ['image', 'video'].includes(item.category);
    const preview = canPreview && item.previewUrl ?
      `<img src="${item.previewUrl}" alt="${item.name}" class="dam-item-preview" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
       <div class="dam-item-icon" style="display:none;">${icon}</div>` :
      `<div class="dam-item-icon">${icon}</div>`;

    if (isGrid) {
      return `
        <div class="dam-item dam-item-grid ${isSelected ? 'selected' : ''}"
             data-id="${item.id}" data-type="${type}" data-name="${item.name}">
          <div class="dam-item-checkbox">${isSelected ? '&#10003;' : ''}</div>
          ${preview}
          <div class="dam-item-name" title="${item.name}">${item.name}</div>
          <div class="dam-item-meta">${isFolder ? '' : item.sizeFormatted || ''}</div>
        </div>
      `;
    }

    const date = item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : '';
    return `
      <div class="dam-item dam-item-list ${isSelected ? 'selected' : ''}"
           data-id="${item.id}" data-type="${type}" data-name="${item.name}">
        <div class="dam-item-checkbox">${isSelected ? '&#10003;' : ''}</div>
        ${canPreview && item.previewUrl ?
          `<img src="${item.previewUrl}" alt="${item.name}" class="dam-item-preview" onerror="this.outerHTML='<div class=\\'dam-item-icon\\'>${icon}</div>'">` :
          `<div class="dam-item-icon">${icon}</div>`}
        <div class="dam-item-list-info">
          <div class="dam-item-list-name" title="${item.name}">${item.name}</div>
          <div class="dam-item-list-meta">${isFolder ? 'Folder' : item.category || 'File'}</div>
        </div>
        <div class="dam-item-list-size">${isFolder ? '-' : item.sizeFormatted || ''}</div>
        <div class="dam-item-list-date">${date}</div>
      </div>
    `;
  }

  getFileIcon(category) {
    const icons = {
      image: '&#128444;',
      video: '&#127909;',
      audio: '&#127925;',
      pdf: '&#128196;',
      document: '&#128196;',
      spreadsheet: '&#128202;',
      archive: '&#128230;',
      file: '&#128196;'
    };
    return icons[category] || icons.file;
  }

  attachEventListeners() {
    // Search
    const searchInput = document.getElementById('dam-search-input');
    if (searchInput) {
      let searchTimeout;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          this.state.searchQuery = e.target.value;
          this.loadContents();
        }, 300);
      });
    }

    // Buttons
    document.getElementById('dam-upload-btn')?.addEventListener('click', () => this.showUploadModal());
    document.getElementById('dam-new-folder-btn')?.addEventListener('click', () => this.showNewFolderModal());

    // Sort
    document.getElementById('dam-sort')?.addEventListener('change', (e) => {
      const [sortBy, sortOrder] = e.target.value.split('-');
      this.state.sortBy = sortBy;
      this.state.sortOrder = sortOrder;
      this.loadContents();
    });

    // View mode
    document.getElementById('dam-view-grid')?.addEventListener('click', () => {
      this.state.viewMode = 'grid';
      this.render();
      this.renderContents();
      this.attachEventListeners();
    });
    document.getElementById('dam-view-list')?.addEventListener('click', () => {
      this.state.viewMode = 'list';
      this.render();
      this.renderContents();
      this.attachEventListeners();
    });

    // Breadcrumbs
    document.getElementById('dam-breadcrumbs')?.addEventListener('click', (e) => {
      if (e.target.classList.contains('dam-breadcrumb') && !e.target.classList.contains('current')) {
        this.navigateToFolder(e.target.dataset.folderId);
      }
    });

    // Content area
    const content = document.getElementById('dam-content');
    if (content) {
      content.addEventListener('click', (e) => this.handleItemClick(e));
      content.addEventListener('dblclick', (e) => this.handleItemDoubleClick(e));
      content.addEventListener('contextmenu', (e) => this.handleContextMenu(e));

      // Drag and drop
      content.addEventListener('dragover', (e) => {
        e.preventDefault();
        content.classList.add('drag-over');
      });
      content.addEventListener('dragleave', () => content.classList.remove('drag-over'));
      content.addEventListener('drop', (e) => {
        e.preventDefault();
        content.classList.remove('drag-over');
        this.handleFileDrop(e);
      });
    }

    // Close context menu on click outside
    document.addEventListener('click', () => this.closeContextMenu());
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeContextMenu();
        this.closeModal();
      }
    });
  }

  handleItemClick(e) {
    const item = e.target.closest('.dam-item');
    if (!item) {
      this.state.selectedItems = [];
      this.renderContents();
      this.updateSelectionBar();
      return;
    }

    const id = item.dataset.id;
    const type = item.dataset.type;
    const name = item.dataset.name;

    if (e.ctrlKey || e.metaKey) {
      const idx = this.state.selectedItems.findIndex(s => s.id === id && s.type === type);
      if (idx >= 0) {
        this.state.selectedItems.splice(idx, 1);
      } else {
        this.state.selectedItems.push({ id, type, name });
      }
    } else if (e.target.classList.contains('dam-item-checkbox')) {
      const idx = this.state.selectedItems.findIndex(s => s.id === id && s.type === type);
      if (idx >= 0) {
        this.state.selectedItems.splice(idx, 1);
      } else {
        this.state.selectedItems.push({ id, type, name });
      }
    } else {
      this.state.selectedItems = [{ id, type, name }];
    }

    this.renderContents();
    this.updateSelectionBar();
  }

  handleItemDoubleClick(e) {
    const item = e.target.closest('.dam-item');
    if (!item) return;

    const id = item.dataset.id;
    const type = item.dataset.type;

    if (type === 'folder') {
      this.navigateToFolder(id);
    } else {
      this.previewFile(id);
    }
  }

  handleContextMenu(e) {
    e.preventDefault();
    const item = e.target.closest('.dam-item');

    let menuItems = [];
    if (item) {
      const id = item.dataset.id;
      const type = item.dataset.type;
      const name = item.dataset.name;

      if (!this.state.selectedItems.some(s => s.id === id)) {
        this.state.selectedItems = [{ id, type, name }];
        this.renderContents();
      }

      if (type === 'folder') {
        menuItems = [
          { label: 'Open', icon: '&#128193;', action: () => this.navigateToFolder(id) },
          { divider: true },
          { label: 'Rename', icon: '&#9998;', action: () => this.showRenameModal(id, type, name) },
          { label: 'Move', icon: '&#10132;', action: () => this.showMoveModal() },
          { divider: true },
          { label: 'Delete', icon: '&#128465;', action: () => this.confirmDelete(), danger: true }
        ];
      } else {
        menuItems = [
          { label: 'Preview', icon: '&#128065;', action: () => this.previewFile(id) },
          { label: 'Download', icon: '&#8595;', action: () => this.downloadFile(id) },
          { divider: true },
          { label: 'Rename', icon: '&#9998;', action: () => this.showRenameModal(id, type, name) },
          { label: 'Move', icon: '&#10132;', action: () => this.showMoveModal() },
          { divider: true },
          { label: 'Delete', icon: '&#128465;', action: () => this.confirmDelete(), danger: true }
        ];
      }
    } else {
      menuItems = [
        { label: 'Upload Files', icon: '&#8593;', action: () => this.showUploadModal() },
        { label: 'New Folder', icon: '&#128193;', action: () => this.showNewFolderModal() },
        { divider: true },
        { label: 'Refresh', icon: '&#8635;', action: () => this.loadContents() }
      ];
    }

    this.showContextMenu(e.clientX, e.clientY, menuItems);
  }

  showContextMenu(x, y, items) {
    this.closeContextMenu();

    const menu = document.createElement('div');
    menu.className = 'dam-context-menu';
    menu.innerHTML = items.map(item => {
      if (item.divider) return '<div class="dam-context-divider"></div>';
      return `<div class="dam-context-item ${item.danger ? 'danger' : ''}">${item.icon || ''} ${item.label}</div>`;
    }).join('');

    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    document.body.appendChild(menu);

    // Adjust position if off-screen
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) menu.style.left = `${x - rect.width}px`;
    if (rect.bottom > window.innerHeight) menu.style.top = `${y - rect.height}px`;

    // Attach click handlers
    const menuItems = menu.querySelectorAll('.dam-context-item');
    let actionIndex = 0;
    items.forEach((item, i) => {
      if (!item.divider) {
        menuItems[actionIndex].addEventListener('click', (e) => {
          e.stopPropagation();
          this.closeContextMenu();
          item.action();
        });
        actionIndex++;
      }
    });

    this.state.contextMenu = menu;
  }

  closeContextMenu() {
    if (this.state.contextMenu) {
      this.state.contextMenu.remove();
      this.state.contextMenu = null;
    }
  }

  updateSelectionBar() {
    const bar = document.getElementById('dam-selection-bar');
    if (!bar) return;

    if (this.state.selectedItems.length > 0) {
      bar.style.display = 'flex';
      bar.className = 'dam-selection-bar';
      bar.innerHTML = `
        <span>${this.state.selectedItems.length} selected</span>
        <div>
          <button id="dam-sel-move">Move</button>
          <button id="dam-sel-delete">Delete</button>
          <button id="dam-sel-clear">Clear</button>
        </div>
      `;
      document.getElementById('dam-sel-move')?.addEventListener('click', () => this.showMoveModal());
      document.getElementById('dam-sel-delete')?.addEventListener('click', () => this.confirmDelete());
      document.getElementById('dam-sel-clear')?.addEventListener('click', () => {
        this.state.selectedItems = [];
        this.renderContents();
        this.updateSelectionBar();
      });
    } else {
      bar.style.display = 'none';
    }
  }

  async handleFileDrop(e) {
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await this.uploadFiles(files);
    }
  }

  // API Methods
  async apiRequest(action, method = 'GET', body = null) {
    const url = new URL(`${this.config.backendUrl}/api/dam`);
    url.searchParams.set('action', action);
    url.searchParams.set('userTags', JSON.stringify(this.config.userTags));
    if (this.config.userEmail) url.searchParams.set('userEmail', this.config.userEmail);

    const options = { method, headers: {} };
    if (body && !(body instanceof FormData)) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify({ ...body, userTags: this.config.userTags, userEmail: this.config.userEmail });
    } else if (body instanceof FormData) {
      body.append('userTags', JSON.stringify(this.config.userTags));
      if (this.config.userEmail) body.append('userEmail', this.config.userEmail);
      options.body = body;
    }

    const response = await fetch(url, options);
    return response.json();
  }

  async loadContents() {
    this.state.isLoading = true;
    this.renderContents();

    try {
      const url = new URL(`${this.config.backendUrl}/api/dam`);
      url.searchParams.set('action', 'get-contents');
      url.searchParams.set('folderId', this.state.currentFolderId);
      url.searchParams.set('sortBy', this.state.sortBy);
      url.searchParams.set('sortOrder', this.state.sortOrder);
      url.searchParams.set('userTags', JSON.stringify(this.config.userTags));
      if (this.state.searchQuery) url.searchParams.set('search', this.state.searchQuery);

      const response = await fetch(url);
      const data = await response.json();

      if (data.success) {
        this.state.folders = data.subfolders || [];
        this.state.files = data.files || [];
        this.state.breadcrumbs = data.breadcrumbs || [];
      }
    } catch (error) {
      console.error('Failed to load contents:', error);
    }

    this.state.isLoading = false;
    this.renderBreadcrumbs();
    this.renderContents();
    this.attachEventListeners();
  }

  navigateToFolder(folderId) {
    this.state.currentFolderId = folderId;
    this.state.selectedItems = [];
    this.state.searchQuery = '';
    const searchInput = document.getElementById('dam-search-input');
    if (searchInput) searchInput.value = '';
    this.loadContents();
  }

  // Modal Methods
  showModal(title, content, footer = '') {
    this.closeModal();

    const overlay = document.createElement('div');
    overlay.className = 'dam-modal-overlay';
    overlay.innerHTML = `
      <div class="dam-modal">
        <div class="dam-modal-header">
          <div class="dam-modal-title">${title}</div>
          <button class="dam-modal-close">&times;</button>
        </div>
        <div class="dam-modal-body">${content}</div>
        ${footer ? `<div class="dam-modal-footer">${footer}</div>` : ''}
      </div>
    `;

    document.body.appendChild(overlay);
    overlay.querySelector('.dam-modal-close').addEventListener('click', () => this.closeModal());
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.closeModal();
    });

    this.state.modal = overlay;
    return overlay;
  }

  closeModal() {
    if (this.state.modal) {
      this.state.modal.remove();
      this.state.modal = null;
    }
  }

  showNewFolderModal() {
    const content = `
      <div class="dam-form-group">
        <label class="dam-form-label">Folder Name</label>
        <input type="text" class="dam-form-input" id="dam-new-folder-name" placeholder="Enter folder name" autofocus>
      </div>
    `;
    const footer = `
      <button class="dam-btn dam-btn-secondary" id="dam-modal-cancel">Cancel</button>
      <button class="dam-btn dam-btn-primary" id="dam-modal-create">Create Folder</button>
    `;

    const modal = this.showModal('New Folder', content, footer);
    modal.querySelector('#dam-modal-cancel').addEventListener('click', () => this.closeModal());
    modal.querySelector('#dam-modal-create').addEventListener('click', () => this.createFolder());
    modal.querySelector('#dam-new-folder-name').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.createFolder();
    });
    setTimeout(() => modal.querySelector('#dam-new-folder-name').focus(), 100);
  }

  async createFolder() {
    const name = document.getElementById('dam-new-folder-name')?.value?.trim();
    if (!name) return;

    try {
      const data = await this.apiRequest('create-folder', 'POST', {
        name,
        parentId: this.state.currentFolderId
      });

      if (data.success) {
        this.closeModal();
        this.loadContents();
      } else {
        alert(data.error || 'Failed to create folder');
      }
    } catch (error) {
      alert('Failed to create folder');
    }
  }

  showRenameModal(id, type, currentName) {
    const content = `
      <div class="dam-form-group">
        <label class="dam-form-label">New Name</label>
        <input type="text" class="dam-form-input" id="dam-rename-input" value="${currentName}">
      </div>
    `;
    const footer = `
      <button class="dam-btn dam-btn-secondary" id="dam-modal-cancel">Cancel</button>
      <button class="dam-btn dam-btn-primary" id="dam-modal-rename">Rename</button>
    `;

    const modal = this.showModal(`Rename ${type === 'folder' ? 'Folder' : 'File'}`, content, footer);
    modal.querySelector('#dam-modal-cancel').addEventListener('click', () => this.closeModal());
    modal.querySelector('#dam-modal-rename').addEventListener('click', () => this.renameItem(id, type));
    modal.querySelector('#dam-rename-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.renameItem(id, type);
    });
    const input = modal.querySelector('#dam-rename-input');
    setTimeout(() => { input.focus(); input.select(); }, 100);
  }

  async renameItem(id, type) {
    const newName = document.getElementById('dam-rename-input')?.value?.trim();
    if (!newName) return;

    try {
      const action = type === 'folder' ? 'rename-folder' : 'rename-file';
      const body = type === 'folder' ? { folderId: id, newName } : { fileId: id, newName };
      const data = await this.apiRequest(action, 'POST', body);

      if (data.success) {
        this.closeModal();
        this.loadContents();
      } else {
        alert(data.error || 'Failed to rename');
      }
    } catch (error) {
      alert('Failed to rename');
    }
  }

  async showMoveModal() {
    // Load folder tree
    try {
      const url = new URL(`${this.config.backendUrl}/api/dam`);
      url.searchParams.set('action', 'get-tree');
      url.searchParams.set('userTags', JSON.stringify(this.config.userTags));
      const response = await fetch(url);
      const data = await response.json();

      if (!data.success) {
        alert('Failed to load folders');
        return;
      }

      const renderTree = (folder, depth = 0) => {
        const padding = depth * 20;
        let html = `<div class="dam-folder-tree-item" data-folder-id="${folder.id}" style="padding-left: ${16 + padding}px">
          &#128193; ${folder.name}
        </div>`;
        if (folder.children) {
          folder.children.forEach(child => {
            html += renderTree(child, depth + 1);
          });
        }
        return html;
      };

      const content = `
        <p>Select destination folder:</p>
        <div style="max-height: 300px; overflow-y: auto; border: 1px solid ${this.config.theme.borderColor}; border-radius: 6px; margin-top: 12px;">
          ${renderTree(data.tree)}
        </div>
      `;
      const footer = `
        <button class="dam-btn dam-btn-secondary" id="dam-modal-cancel">Cancel</button>
        <button class="dam-btn dam-btn-primary" id="dam-modal-move" disabled>Move Here</button>
      `;

      const modal = this.showModal('Move Items', content, footer);
      let selectedFolderId = null;

      modal.querySelectorAll('.dam-folder-tree-item').forEach(item => {
        item.addEventListener('click', () => {
          modal.querySelectorAll('.dam-folder-tree-item').forEach(i => i.classList.remove('selected'));
          item.classList.add('selected');
          selectedFolderId = item.dataset.folderId;
          modal.querySelector('#dam-modal-move').disabled = false;
        });
      });

      modal.querySelector('#dam-modal-cancel').addEventListener('click', () => this.closeModal());
      modal.querySelector('#dam-modal-move').addEventListener('click', () => this.moveItems(selectedFolderId));
    } catch (error) {
      alert('Failed to load folders');
    }
  }

  async moveItems(destinationFolderId) {
    if (!destinationFolderId) return;

    try {
      const data = await this.apiRequest('bulk-move', 'POST', {
        items: this.state.selectedItems,
        destinationFolderId
      });

      if (data.success) {
        this.closeModal();
        this.state.selectedItems = [];
        this.loadContents();
      } else {
        alert(data.error || 'Failed to move items');
      }
    } catch (error) {
      alert('Failed to move items');
    }
  }

  confirmDelete() {
    const count = this.state.selectedItems.length;
    const content = `
      <p>Are you sure you want to delete ${count} item${count > 1 ? 's' : ''}?</p>
      <p style="color: #dc2626; font-size: 14px; margin-top: 8px;">This action cannot be undone.</p>
    `;
    const footer = `
      <button class="dam-btn dam-btn-secondary" id="dam-modal-cancel">Cancel</button>
      <button class="dam-btn dam-btn-primary" style="background: #dc2626" id="dam-modal-delete">Delete</button>
    `;

    const modal = this.showModal('Confirm Delete', content, footer);
    modal.querySelector('#dam-modal-cancel').addEventListener('click', () => this.closeModal());
    modal.querySelector('#dam-modal-delete').addEventListener('click', () => this.deleteItems());
  }

  async deleteItems() {
    try {
      const data = await this.apiRequest('bulk-delete', 'POST', {
        items: this.state.selectedItems
      });

      if (data.success) {
        this.closeModal();
        this.state.selectedItems = [];
        this.loadContents();
      } else {
        alert(data.error || 'Failed to delete items');
      }
    } catch (error) {
      alert('Failed to delete items');
    }
  }

  showUploadModal() {
    const content = `
      <div class="dam-upload-zone" id="dam-upload-zone">
        <div class="dam-upload-icon">&#128194;</div>
        <div class="dam-upload-text">Drag and drop files here</div>
        <div class="dam-upload-hint">or click to browse</div>
        <input type="file" id="dam-file-input" multiple style="display: none;">
      </div>
      <div id="dam-upload-status" style="margin-top: 16px;"></div>
    `;

    const modal = this.showModal('Upload Files', content);
    const zone = modal.querySelector('#dam-upload-zone');
    const input = modal.querySelector('#dam-file-input');

    zone.addEventListener('click', () => input.click());
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      this.uploadFiles(e.dataTransfer.files, modal);
    });
    input.addEventListener('change', () => this.uploadFiles(input.files, modal));
  }

  async uploadFiles(files, modal = null) {
    const statusEl = modal?.querySelector('#dam-upload-status') || null;
    let completed = 0;
    const total = files.length;

    for (const file of files) {
      if (statusEl) {
        statusEl.innerHTML = `
          <div>Uploading: ${file.name}</div>
          <div class="dam-upload-progress">
            <div class="dam-upload-progress-bar" style="width: ${(completed / total) * 100}%"></div>
          </div>
          <div style="font-size: 12px; color: ${this.config.theme.secondaryColor}; margin-top: 4px;">${completed} of ${total} files</div>
        `;
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('folderId', this.state.currentFolderId);

      try {
        await this.apiRequest('upload', 'POST', formData);
      } catch (error) {
        console.error('Upload failed:', file.name, error);
      }

      completed++;
    }

    if (statusEl) {
      statusEl.innerHTML = `<div style="color: green;">&#10003; ${total} file${total > 1 ? 's' : ''} uploaded successfully</div>`;
    }

    setTimeout(() => {
      this.closeModal();
      this.loadContents();
    }, 1000);
  }

  async previewFile(fileId) {
    try {
      const url = new URL(`${this.config.backendUrl}/api/dam`);
      url.searchParams.set('action', 'get-file');
      url.searchParams.set('fileId', fileId);
      url.searchParams.set('userTags', JSON.stringify(this.config.userTags));
      const response = await fetch(url);
      const data = await response.json();

      if (!data.success) {
        alert('Failed to load file');
        return;
      }

      const file = data.file;
      let preview = '';
      if (file.category === 'image') {
        preview = `<img src="${file.previewUrl || file.shopifyUrl}" alt="${file.name}">`;
      } else if (file.category === 'video') {
        preview = `<video controls src="${file.shopifyUrl}"></video>`;
      } else if (file.category === 'pdf') {
        preview = `<iframe src="${file.shopifyUrl}" style="width: 100%; height: 60vh; border: none;"></iframe>`;
      } else {
        preview = `<div style="padding: 40px; color: ${this.config.theme.secondaryColor};">Preview not available for this file type</div>`;
      }

      const content = `
        <div class="dam-preview-content">${preview}</div>
        <div class="dam-preview-info">
          <div class="dam-preview-info-row"><div class="dam-preview-info-label">Name</div><div>${file.name}</div></div>
          <div class="dam-preview-info-row"><div class="dam-preview-info-label">Type</div><div>${file.mimeType}</div></div>
          <div class="dam-preview-info-row"><div class="dam-preview-info-label">Size</div><div>${file.sizeFormatted}</div></div>
          <div class="dam-preview-info-row"><div class="dam-preview-info-label">Modified</div><div>${new Date(file.updatedAt).toLocaleString()}</div></div>
          <div class="dam-preview-info-row"><div class="dam-preview-info-label">Downloads</div><div>${file.downloads || 0}</div></div>
        </div>
      `;
      const footer = `<button class="dam-btn dam-btn-primary" id="dam-download-btn">&#8595; Download</button>`;

      const modal = this.showModal(file.name, content, footer);
      modal.querySelector('.dam-modal').classList.add('dam-preview-modal');
      modal.querySelector('.dam-modal').style.maxWidth = '900px';
      modal.querySelector('#dam-download-btn').addEventListener('click', () => this.downloadFile(fileId));
    } catch (error) {
      alert('Failed to load file preview');
    }
  }

  async downloadFile(fileId) {
    try {
      const url = new URL(`${this.config.backendUrl}/api/dam`);
      url.searchParams.set('action', 'download');
      url.searchParams.set('fileId', fileId);
      url.searchParams.set('userTags', JSON.stringify(this.config.userTags));
      const response = await fetch(url);
      const data = await response.json();

      if (data.success && data.downloadUrl) {
        window.open(data.downloadUrl, '_blank');
      } else {
        alert('Failed to get download URL');
      }
    } catch (error) {
      alert('Failed to download file');
    }
  }

  renderAccessDenied() {
    this.container = document.getElementById(this.config.containerId);
    if (!this.container) return;

    this.injectStyles();
    this.container.innerHTML = `
      <div class="dam-container">
        <div class="dam-access-denied">
          <div class="dam-access-denied-icon">&#128274;</div>
          <div class="dam-access-denied-title">Access Denied</div>
          <div class="dam-access-denied-text">You need admin or affiliate access to use the Digital Asset Manager.</div>
        </div>
      </div>
    `;
  }
}

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DAMComponent;
} else if (typeof window !== 'undefined') {
  window.DAMComponent = DAMComponent;
}
