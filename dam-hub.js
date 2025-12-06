/**
 * DAM Hub - Marketing Resources
 * Pure Shopify solution - no external services
 * Files managed via Theme Customizer (paste URLs)
 *
 * @version 5.0.0
 */

class DAMHub {
  constructor(config = {}) {
    this.config = {
      containerId: config.containerId || 'dam-hub-container',
      userTags: (config.userTags || []).map(t => t.toLowerCase()),
      isAdmin: config.isAdmin || false,
      isDesignMode: config.isDesignMode || false,
      // Data passed from liquid template (from theme settings)
      folders: config.folders || [],
      files: config.files || [],
      theme: {
        primaryColor: config.theme?.primaryColor || '#78ABE6',
        accentColor: config.theme?.accentColor || '#00D4AA',
        dangerColor: config.theme?.dangerColor || '#FF3B5C',
        backgroundColor: config.theme?.backgroundColor || '#F7F8FA',
        surfaceColor: config.theme?.surfaceColor || '#FFFFFF',
        textPrimary: config.theme?.textPrimary || '#1A1D26',
        textSecondary: config.theme?.textSecondary || '#6B7280',
        textMuted: config.theme?.textMuted || '#9CA3AF',
        borderColor: config.theme?.borderColor || '#E5E7EB',
        shadowColor: config.theme?.shadowColor || 'rgba(0,0,0,0.08)'
      }
    };

    this.isAdmin = this.config.isAdmin || this.config.userTags.includes('admin');

    this.state = {
      currentFolderId: 'root',
      selectedItems: new Set(),
      viewMode: localStorage.getItem('dam_view') || 'grid',
      sortBy: 'name',
      sortOrder: 'asc',
      searchQuery: '',
      breadcrumbs: [{ id: 'root', name: 'My Files' }]
    };

    this.container = null;

    // Process the data from theme settings
    this.processData();
  }

  // ═══════════════════════════════════════════════════════════
  // DATA PROCESSING
  // ═══════════════════════════════════════════════════════════

  processData() {
    // Build folder map for quick lookup
    this.folderMap = { root: { id: 'root', name: 'My Files', parentId: null } };

    for (const folder of this.config.folders) {
      if (folder.id && folder.name) {
        this.folderMap[folder.id] = {
          id: folder.id,
          name: folder.name,
          parentId: folder.parent_id || 'root',
          color: folder.color || null
        };
      }
    }

    // Build file list with folder assignments
    this.files = [];
    for (const file of this.config.files) {
      if (file.url && file.name) {
        this.files.push({
          id: file.id || this.generateId(),
          name: file.name,
          url: file.url,
          folderId: file.folder_id || 'root',
          mimeType: this.guessMimeType(file.url, file.name),
          description: file.description || '',
          size: null // Unknown for external URLs
        });
      }
    }
  }

  generateId() {
    return 'file_' + Math.random().toString(36).substr(2, 9);
  }

  guessMimeType(url, name) {
    const ext = (name || url).split('.').pop().toLowerCase();
    const types = {
      jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
      webp: 'image/webp', svg: 'image/svg+xml', mp4: 'video/mp4', webm: 'video/webm',
      mov: 'video/quicktime', pdf: 'application/pdf', doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      zip: 'application/zip', txt: 'text/plain', csv: 'text/csv'
    };
    return types[ext] || 'application/octet-stream';
  }

  // ═══════════════════════════════════════════════════════════
  // DATA OPERATIONS
  // ═══════════════════════════════════════════════════════════

  getFoldersInFolder(folderId) {
    return Object.values(this.folderMap).filter(f => f.parentId === folderId && f.id !== 'root');
  }

  getFilesInFolder(folderId) {
    let files = this.files.filter(f => f.folderId === folderId);

    // Apply search
    if (this.state.searchQuery) {
      const q = this.state.searchQuery.toLowerCase();
      files = files.filter(f => f.name.toLowerCase().includes(q));
    }

    // Apply sort
    files.sort((a, b) => {
      const aVal = a[this.state.sortBy] || a.name;
      const bVal = b[this.state.sortBy] || b.name;
      const cmp = String(aVal).localeCompare(String(bVal));
      return this.state.sortOrder === 'asc' ? cmp : -cmp;
    });

    return files;
  }

  getBreadcrumbs(folderId) {
    const crumbs = [];
    let currentId = folderId;

    while (currentId) {
      const folder = this.folderMap[currentId];
      if (!folder) break;
      crumbs.unshift({ id: folder.id, name: folder.name });
      currentId = folder.parentId;
    }

    return crumbs.length ? crumbs : [{ id: 'root', name: 'My Files' }];
  }

  // ═══════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════

  async init() {
    this.container = document.getElementById(this.config.containerId);
    if (!this.container) return console.error('DAM: Container not found');

    const hasAccess = this.config.userTags.includes('admin') || this.config.userTags.includes('affiliate');
    if (!hasAccess && !this.config.isDesignMode) {
      this.container.innerHTML = this.renderAccessDenied();
      return;
    }

    this.injectStyles();
    this.loadFolder('root');
    this.bindGlobalEvents();
  }

  loadFolder(folderId) {
    this.state.currentFolderId = folderId;
    this.state.selectedItems.clear();
    this.state.breadcrumbs = this.getBreadcrumbs(folderId);
    this.render();
  }

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════

  render() {
    const folders = this.getFoldersInFolder(this.state.currentFolderId);
    const files = this.getFilesInFolder(this.state.currentFolderId);
    const hasItems = folders.length > 0 || files.length > 0;
    const hasSelection = this.state.selectedItems.size > 0;

    this.container.innerHTML = `
      <div class="dam">
        ${this.renderHeader()}
        ${hasSelection ? this.renderSelectionBar() : ''}
        ${this.renderToolbar()}
        <div class="dam__body">
          ${hasItems ? this.renderItems(folders, files) : this.renderEmpty()}
        </div>
      </div>
    `;

    this.bindEvents();
  }

  renderHeader() {
    return `
      <header class="dam__header">
        <h1 class="dam__title">Marketing Resources</h1>
        <div class="dam__search">
          <span class="dam__search-icon">${this.icons.search}</span>
          <input type="text" class="dam__search-input" placeholder="Search files..." value="${this.esc(this.state.searchQuery)}" id="damSearch">
          ${this.state.searchQuery ? `<button class="dam__search-clear" id="damSearchClear">${this.icons.x}</button>` : ''}
        </div>
        ${this.isAdmin ? `
          <div class="dam__header-actions">
            <a href="/admin/themes/current/editor" target="_blank" class="dam__btn dam__btn--primary">
              ${this.icons.settings}<span>Manage Files</span>
            </a>
          </div>
        ` : ''}
      </header>
    `;
  }

  renderSelectionBar() {
    const count = this.state.selectedItems.size;
    return `
      <div class="dam__selection-bar">
        <div class="dam__selection-info">
          <span class="dam__selection-count">${count}</span>
          <span>item${count > 1 ? 's' : ''} selected</span>
        </div>
        <div class="dam__selection-actions">
          <button class="dam__btn dam__btn--ghost" id="damCopyUrls">${this.icons.link}<span>Copy URLs</span></button>
          <button class="dam__btn dam__btn--ghost" id="damClearSelection">${this.icons.x}</button>
        </div>
      </div>
    `;
  }

  renderToolbar() {
    return `
      <div class="dam__toolbar">
        <nav class="dam__breadcrumbs" aria-label="Breadcrumb">
          ${this.renderBreadcrumbs()}
        </nav>
        <div class="dam__toolbar-actions">
          <div class="dam__view-toggle">
            <button class="dam__view-btn ${this.state.viewMode === 'grid' ? 'active' : ''}" data-view="grid" title="Grid view">${this.icons.grid}</button>
            <button class="dam__view-btn ${this.state.viewMode === 'list' ? 'active' : ''}" data-view="list" title="List view">${this.icons.list}</button>
          </div>
        </div>
      </div>
    `;
  }

  renderBreadcrumbs() {
    let html = '';
    this.state.breadcrumbs.forEach((crumb, i) => {
      const isLast = i === this.state.breadcrumbs.length - 1;
      const icon = i === 0 ? this.icons.home : '';
      const label = i === 0 ? 'Home' : crumb.name;

      if (i > 0) {
        html += `<span class="dam__crumb-sep">${this.icons.chevronRight}</span>`;
      }

      html += `<button class="dam__crumb ${isLast ? 'dam__crumb--active' : ''}" data-folder-id="${crumb.id}">${icon}<span>${this.esc(label)}</span></button>`;
    });

    return html || `<button class="dam__crumb dam__crumb--active" data-folder-id="root">${this.icons.home}<span>Home</span></button>`;
  }

  renderItems(folders, files) {
    if (this.state.viewMode === 'grid') {
      return `
        <div class="dam__grid">
          ${folders.map(f => this.renderGridItem(f, true)).join('')}
          ${files.map(f => this.renderGridItem(f, false)).join('')}
        </div>
      `;
    }
    return `
      <div class="dam__list">
        <div class="dam__list-header">
          <div class="dam__list-col dam__list-col--check"></div>
          <div class="dam__list-col dam__list-col--icon"></div>
          <div class="dam__list-col dam__list-col--name" data-sort="name">Name ${this.state.sortBy === 'name' ? (this.state.sortOrder === 'asc' ? '↑' : '↓') : ''}</div>
          <div class="dam__list-col dam__list-col--type">Type</div>
          <div class="dam__list-col dam__list-col--actions"></div>
        </div>
        ${folders.map(f => this.renderListItem(f, true)).join('')}
        ${files.map(f => this.renderListItem(f, false)).join('')}
      </div>
    `;
  }

  renderGridItem(item, isFolder) {
    const key = `${isFolder ? 'folder' : 'file'}:${item.id}`;
    const selected = this.state.selectedItems.has(key);

    return `
      <div class="dam__card ${selected ? 'dam__card--selected' : ''}" data-key="${key}" data-id="${item.id}" data-folder="${isFolder}">
        <div class="dam__card-check">
          <div class="dam__checkbox ${selected ? 'dam__checkbox--checked' : ''}">${selected ? this.icons.check : ''}</div>
        </div>
        <div class="dam__card-preview">
          ${isFolder
            ? `<div class="dam__card-icon dam__card-icon--folder">${this.icons.folder}</div>`
            : this.renderPreviewThumb(item)}
        </div>
        <div class="dam__card-info">
          <div class="dam__card-name" title="${this.esc(item.name)}">${this.esc(item.name)}</div>
          <div class="dam__card-meta">${isFolder ? this.getFilesInFolder(item.id).length + ' items' : this.getFileTypeLabel(item.mimeType)}</div>
        </div>
        <button class="dam__card-menu" data-menu="${key}">${this.icons.moreV}</button>
      </div>
    `;
  }

  renderListItem(item, isFolder) {
    const key = `${isFolder ? 'folder' : 'file'}:${item.id}`;
    const selected = this.state.selectedItems.has(key);

    return `
      <div class="dam__list-row ${selected ? 'dam__list-row--selected' : ''}" data-key="${key}" data-id="${item.id}" data-folder="${isFolder}">
        <div class="dam__list-col dam__list-col--check">
          <div class="dam__checkbox ${selected ? 'dam__checkbox--checked' : ''}">${selected ? this.icons.check : ''}</div>
        </div>
        <div class="dam__list-col dam__list-col--icon">
          ${isFolder ? `<span class="dam__icon dam__icon--folder">${this.icons.folder}</span>` : `<span class="dam__icon">${this.getFileIcon(item.mimeType)}</span>`}
        </div>
        <div class="dam__list-col dam__list-col--name">${this.esc(item.name)}</div>
        <div class="dam__list-col dam__list-col--type">${isFolder ? 'Folder' : this.getFileTypeLabel(item.mimeType)}</div>
        <div class="dam__list-col dam__list-col--actions">
          <button class="dam__icon-btn" data-menu="${key}">${this.icons.moreH}</button>
        </div>
      </div>
    `;
  }

  renderPreviewThumb(file) {
    if (file.mimeType?.startsWith('image/')) {
      return `<img class="dam__card-img" src="${file.url}" alt="" loading="lazy">`;
    }
    if (file.mimeType?.startsWith('video/')) {
      return `<div class="dam__card-icon">${this.icons.video}</div>`;
    }
    return `<div class="dam__card-icon">${this.getFileIcon(file.mimeType)}</div>`;
  }

  renderEmpty() {
    if (this.state.searchQuery) {
      return `
        <div class="dam__empty">
          <div class="dam__empty-icon">${this.icons.search}</div>
          <h3 class="dam__empty-title">No results found</h3>
          <p class="dam__empty-text">Try a different search term</p>
        </div>
      `;
    }
    return `
      <div class="dam__empty">
        <div class="dam__empty-icon">${this.icons.folder}</div>
        <h3 class="dam__empty-title">This folder is empty</h3>
        <p class="dam__empty-text">${this.isAdmin ? 'Add files via the Theme Customizer' : 'No files have been added yet'}</p>
        ${this.isAdmin ? `
          <div class="dam__empty-actions">
            <a href="/admin/themes/current/editor" target="_blank" class="dam__btn dam__btn--primary">${this.icons.settings} Manage Files</a>
          </div>
        ` : ''}
      </div>
    `;
  }

  renderAccessDenied() {
    return `
      <div class="dam dam--denied">
        <div class="dam__denied">
          <div class="dam__denied-icon">${this.icons.lock}</div>
          <h2>Access Restricted</h2>
          <p>This area is only available to administrators and affiliates.</p>
        </div>
      </div>
    `;
  }

  // ═══════════════════════════════════════════════════════════
  // EVENTS
  // ═══════════════════════════════════════════════════════════

  bindGlobalEvents() {
    document.addEventListener('keydown', (e) => {
      if (e.target.matches('input, textarea')) return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        this.selectAll();
      }
      if (e.key === 'Escape') {
        this.state.selectedItems.clear();
        this.closeAllModals();
        this.render();
      }
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.dam__context-menu')) {
        document.querySelectorAll('.dam__context-menu').forEach(m => m.remove());
      }
    });
  }

  bindEvents() {
    // Search
    const search = document.getElementById('damSearch');
    if (search) {
      search.addEventListener('input', this.debounce(e => {
        this.state.searchQuery = e.target.value;
        this.render();
      }, 300));
    }
    document.getElementById('damSearchClear')?.addEventListener('click', () => {
      this.state.searchQuery = '';
      this.render();
    });

    // View toggle
    this.container.querySelectorAll('.dam__view-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.state.viewMode = btn.dataset.view;
        localStorage.setItem('dam_view', this.state.viewMode);
        this.render();
      });
    });

    // Breadcrumbs
    this.container.querySelectorAll('.dam__crumb').forEach(btn => {
      btn.addEventListener('click', () => this.loadFolder(btn.dataset.folderId));
    });

    // Items
    this.container.querySelectorAll('[data-key]').forEach(el => {
      el.addEventListener('click', e => this.handleItemClick(e, el));
      el.addEventListener('dblclick', () => this.handleItemDblClick(el));
    });

    // Context menus
    this.container.querySelectorAll('[data-menu]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        this.showContextMenu(e, btn.dataset.menu);
      });
    });

    // Selection bar
    document.getElementById('damCopyUrls')?.addEventListener('click', () => this.copySelectedUrls());
    document.getElementById('damClearSelection')?.addEventListener('click', () => {
      this.state.selectedItems.clear();
      this.render();
    });

    // Sort headers
    this.container.querySelectorAll('[data-sort]').forEach(el => {
      el.addEventListener('click', () => {
        if (this.state.sortBy === el.dataset.sort) {
          this.state.sortOrder = this.state.sortOrder === 'asc' ? 'desc' : 'asc';
        } else {
          this.state.sortBy = el.dataset.sort;
          this.state.sortOrder = 'asc';
        }
        this.render();
      });
    });
  }

  handleItemClick(e, el) {
    const key = el.dataset.key;
    if (e.ctrlKey || e.metaKey || e.target.closest('.dam__checkbox, .dam__card-check, .dam__list-col--check')) {
      if (this.state.selectedItems.has(key)) {
        this.state.selectedItems.delete(key);
      } else {
        this.state.selectedItems.add(key);
      }
      this.render();
    } else if (!e.target.closest('[data-menu]')) {
      this.state.selectedItems.clear();
      this.state.selectedItems.add(key);
      this.render();
    }
  }

  handleItemDblClick(el) {
    const isFolder = el.dataset.folder === 'true';
    const id = el.dataset.id;

    if (isFolder) {
      this.loadFolder(id);
    } else {
      const file = this.files.find(f => f.id === id);
      if (file) this.showPreview(file);
    }
  }

  selectAll() {
    const folders = this.getFoldersInFolder(this.state.currentFolderId);
    const files = this.getFilesInFolder(this.state.currentFolderId);
    folders.forEach(f => this.state.selectedItems.add(`folder:${f.id}`));
    files.forEach(f => this.state.selectedItems.add(`file:${f.id}`));
    this.render();
  }

  copySelectedUrls() {
    const urls = [];
    for (const key of this.state.selectedItems) {
      const [type, id] = key.split(':');
      if (type === 'file') {
        const file = this.files.find(f => f.id === id);
        if (file) urls.push(file.url);
      }
    }
    if (urls.length) {
      navigator.clipboard.writeText(urls.join('\n')).then(() => {
        this.toast(`${urls.length} URL${urls.length > 1 ? 's' : ''} copied`);
      });
    }
  }

  // ═══════════════════════════════════════════════════════════
  // MODALS
  // ═══════════════════════════════════════════════════════════

  showContextMenu(e, key) {
    document.querySelectorAll('.dam__context-menu').forEach(m => m.remove());

    const [type, id] = key.split(':');
    const isFolder = type === 'folder';
    const item = isFolder
      ? this.folderMap[id]
      : this.files.find(f => f.id === id);
    if (!item) return;

    const menu = document.createElement('div');
    menu.className = 'dam__context-menu';

    const actions = isFolder ? [
      { icon: 'folderOpen', label: 'Open', action: 'open' }
    ] : [
      { icon: 'eye', label: 'Preview', action: 'preview' },
      { icon: 'download', label: 'Download', action: 'download' },
      { icon: 'link', label: 'Copy URL', action: 'copy' }
    ];

    menu.innerHTML = actions.map(a => `
      <button class="dam__context-item" data-action="${a.action}">
        ${this.icons[a.icon]} ${a.label}
      </button>
    `).join('');

    document.body.appendChild(menu);

    const rect = e.target.getBoundingClientRect();
    menu.style.top = `${rect.bottom + 4}px`;
    menu.style.left = `${rect.left}px`;

    const menuRect = menu.getBoundingClientRect();
    if (menuRect.right > window.innerWidth) menu.style.left = `${window.innerWidth - menuRect.width - 8}px`;
    if (menuRect.bottom > window.innerHeight) menu.style.top = `${rect.top - menuRect.height - 4}px`;

    menu.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        menu.remove();
        this.handleContextAction(btn.dataset.action, item, isFolder);
      });
    });
  }

  handleContextAction(action, item, isFolder) {
    switch (action) {
      case 'open':
        this.loadFolder(item.id);
        break;
      case 'preview':
        this.showPreview(item);
        break;
      case 'download':
        this.downloadFile(item);
        break;
      case 'copy':
        navigator.clipboard.writeText(item.url).then(() => this.toast('URL copied'));
        break;
    }
  }

  downloadFile(file) {
    const a = document.createElement('a');
    a.href = file.url;
    a.download = file.name;
    a.target = '_blank';
    a.click();
  }

  showPreview(file) {
    const url = file.url;
    let content = '';

    if (file.mimeType?.startsWith('image/')) {
      content = `<img src="${url}" alt="${this.esc(file.name)}" class="dam__preview-img">`;
    } else if (file.mimeType?.startsWith('video/')) {
      content = `<video src="${url}" controls autoplay class="dam__preview-video"></video>`;
    } else if (file.mimeType === 'application/pdf') {
      content = `<iframe src="${url}" class="dam__preview-pdf"></iframe>`;
    } else {
      content = `
        <div class="dam__preview-fallback">
          ${this.getFileIcon(file.mimeType)}
          <p>Preview not available</p>
        </div>
      `;
    }

    this.showModal({
      title: file.name,
      content: `
        <div class="dam__preview">${content}</div>
        <div class="dam__preview-bar">
          <span>${this.getFileTypeLabel(file.mimeType)}</span>
          <div class="dam__preview-actions">
            <button class="dam__btn dam__btn--secondary dam__btn--sm" id="damPreviewCopy">${this.icons.link} Copy URL</button>
            <button class="dam__btn dam__btn--secondary dam__btn--sm" id="damPreviewDownload">${this.icons.download} Download</button>
          </div>
        </div>
      `,
      actions: [],
      large: true,
      onMount: () => {
        document.getElementById('damPreviewDownload')?.addEventListener('click', () => this.downloadFile(file));
        document.getElementById('damPreviewCopy')?.addEventListener('click', () => {
          navigator.clipboard.writeText(file.url).then(() => this.toast('URL copied'));
        });
      }
    });
  }

  showModal({ title, content, actions = [], onAction, large, onMount }) {
    this.closeAllModals();

    const modal = document.createElement('div');
    modal.className = 'dam__modal-overlay';
    modal.id = 'damModal';
    modal.innerHTML = `
      <div class="dam__modal ${large ? 'dam__modal--large' : ''}">
        <div class="dam__modal-header">
          <h3>${title}</h3>
          <button class="dam__modal-close" data-action="close">${this.icons.x}</button>
        </div>
        <div class="dam__modal-body">${content}</div>
        ${actions.length ? `
          <div class="dam__modal-footer">
            ${actions.map(a => `<button class="dam__btn dam__btn--${a.type}" data-action="${a.action}">${a.label}</button>`).join('')}
          </div>
        ` : ''}
      </div>
    `;

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';

    modal.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (btn.dataset.action === 'close') {
          this.closeAllModals();
        } else if (onAction) {
          const shouldClose = await onAction(btn.dataset.action);
          if (shouldClose) this.closeAllModals();
        }
      });
    });

    modal.addEventListener('click', e => {
      if (e.target === modal) this.closeAllModals();
    });

    if (onMount) onMount();
  }

  closeAllModals() {
    document.getElementById('damModal')?.remove();
    document.body.style.overflow = '';
  }

  toast(message, type = 'success') {
    let container = document.querySelector('.dam__toasts');
    if (!container) {
      container = document.createElement('div');
      container.className = 'dam__toasts';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `dam__toast dam__toast--${type}`;
    toast.innerHTML = `
      <span class="dam__toast-icon">${type === 'success' ? this.icons.check : this.icons.alertCircle}</span>
      <span>${this.esc(message)}</span>
    `;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('dam__toast--exit');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // ═══════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════

  getFileTypeLabel(mimeType) {
    if (!mimeType) return 'File';
    if (mimeType.startsWith('image/')) return 'Image';
    if (mimeType.startsWith('video/')) return 'Video';
    if (mimeType === 'application/pdf') return 'PDF';
    if (mimeType.includes('word') || mimeType.includes('document')) return 'Document';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'Spreadsheet';
    if (mimeType.includes('zip')) return 'Archive';
    return 'File';
  }

  getFileIcon(mimeType) {
    if (!mimeType) return this.icons.file;
    if (mimeType.startsWith('image/')) return this.icons.image;
    if (mimeType.startsWith('video/')) return this.icons.video;
    if (mimeType === 'application/pdf') return this.icons.fileText;
    if (mimeType.includes('zip') || mimeType.includes('rar')) return this.icons.archive;
    return this.icons.file;
  }

  esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  debounce(fn, delay) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
  }

  // ═══════════════════════════════════════════════════════════
  // ICONS
  // ═══════════════════════════════════════════════════════════

  get icons() {
    return {
      folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
      folderOpen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><path d="M2 10h20"/></svg>',
      file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
      fileText: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>',
      image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
      video: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>',
      archive: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>',
      download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
      search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
      grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
      list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
      home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
      chevronRight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>',
      moreV: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>',
      moreH: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>',
      link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
      eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
      x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
      check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
      alertCircle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
      lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
      settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>'
    };
  }

  // ═══════════════════════════════════════════════════════════
  // STYLES
  // ═══════════════════════════════════════════════════════════

  injectStyles() {
    if (document.getElementById('dam-hub-styles')) return;
    const t = this.config.theme;
    const style = document.createElement('style');
    style.id = 'dam-hub-styles';
    style.textContent = `
.dam {
  --primary: ${t.primaryColor};
  --accent: ${t.accentColor};
  --danger: ${t.dangerColor};
  --bg: ${t.backgroundColor};
  --surface: ${t.surfaceColor};
  --text: ${t.textPrimary};
  --text-secondary: ${t.textSecondary};
  --text-muted: ${t.textMuted};
  --border: ${t.borderColor};
  --shadow: ${t.shadowColor};
  --radius: 12px;
  --radius-sm: 8px;
  --radius-xs: 6px;
  font-family: inherit;
  font-size: 14px;
  line-height: 1.5;
  color: var(--text);
  background: var(--bg);
  min-height: 500px;
  border-radius: var(--radius);
  overflow: hidden;
}
.dam *, .dam *::before, .dam *::after { box-sizing: border-box; }
.dam svg { width: 20px; height: 20px; flex-shrink: 0; }

.dam__header { display: flex; align-items: center; justify-content: space-between; gap: 24px; padding: 20px 24px; background: var(--surface); border-bottom: 1px solid var(--border); }
.dam__title { font-size: 20px; font-weight: 700; margin: 0; letter-spacing: -0.3px; white-space: nowrap; }
.dam__search { flex: 1; max-width: 400px; position: relative; }
.dam__search-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--text-muted); }
.dam__search-icon svg { width: 18px; height: 18px; }
.dam__search-input { width: 100%; padding: 10px 14px 10px 44px; border: 1px solid #e5e7eb; border-radius: 10px; font-size: 14px; background: #ffffff; color: var(--text); transition: all 0.2s; }
.dam__search-input:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px rgba(120, 171, 230, 0.2); }
.dam__search-input::placeholder { color: var(--text-muted); }
.dam__search-clear { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 4px; border-radius: 4px; }
.dam__search-clear:hover { color: var(--text); background: var(--bg); }
.dam__header-actions { display: flex; gap: 10px; }

.dam__btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 10px 18px; font-size: 14px; font-weight: 600; border-radius: var(--radius-sm); border: none; cursor: pointer; transition: all 0.2s; white-space: nowrap; text-decoration: none; }
.dam__btn svg { width: 18px; height: 18px; }
.dam__btn--primary { background: var(--primary); color: white; box-shadow: 0 2px 8px rgba(120, 171, 230, 0.4); }
.dam__btn--primary:hover { background: #5a95db; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(120, 171, 230, 0.5); }
.dam__btn--secondary { background: #ffffff; color: var(--text); border: 1px solid var(--border); }
.dam__btn--secondary:hover { background: #f3f4f6; border-color: var(--text-muted); }
.dam__btn--ghost { background: transparent; color: var(--text); }
.dam__btn--ghost:hover { background: #f3f4f6; }
.dam__btn--sm { padding: 8px 14px; font-size: 13px; }
.dam__btn--sm svg { width: 16px; height: 16px; }
.dam__icon-btn { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; background: none; border: none; border-radius: var(--radius-xs); color: var(--text-muted); cursor: pointer; transition: all 0.15s; }
.dam__icon-btn:hover { background: var(--bg); color: var(--text); }

.dam__selection-bar { display: flex; align-items: center; justify-content: space-between; padding: 12px 24px; background: var(--primary); color: white; }
.dam__selection-info { display: flex; align-items: center; gap: 8px; font-weight: 500; }
.dam__selection-count { background: rgba(255,255,255,0.2); padding: 2px 10px; border-radius: 20px; font-weight: 700; }
.dam__selection-actions { display: flex; gap: 8px; }
.dam__selection-actions .dam__btn--ghost { color: rgba(255,255,255,0.9); }
.dam__selection-actions .dam__btn--ghost:hover { background: rgba(255,255,255,0.15); color: white; }

.dam__toolbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px 24px; background: var(--surface); border-bottom: 1px solid var(--border); }
.dam__breadcrumbs { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.dam__crumb { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; font-size: 13px; font-weight: 500; color: var(--text-secondary); background: none; border: none; border-radius: var(--radius-xs); cursor: pointer; transition: all 0.15s; }
.dam__crumb svg { width: 16px; height: 16px; }
.dam__crumb:hover { background: var(--bg); color: var(--primary); }
.dam__crumb--active { color: var(--text); font-weight: 600; cursor: default; }
.dam__crumb--active:hover { background: transparent; color: var(--text); }
.dam__crumb-sep { color: var(--text-muted); }
.dam__crumb-sep svg { width: 14px; height: 14px; }
.dam__toolbar-actions { display: flex; align-items: center; gap: 12px; }
.dam__view-toggle { display: flex; background: var(--bg); border-radius: var(--radius-xs); padding: 3px; }
.dam__view-btn { width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; background: none; border: none; border-radius: var(--radius-xs); color: var(--text-muted); cursor: pointer; transition: all 0.15s; }
.dam__view-btn:hover { color: var(--text); }
.dam__view-btn.active { background: var(--surface); color: var(--primary); box-shadow: 0 1px 3px var(--shadow); }
.dam__view-btn svg { width: 18px; height: 18px; }

.dam__body { padding: 24px; min-height: 300px; }

.dam__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 20px; }
.dam__card { position: relative; background: #ffffff; border-radius: 14px; border: 2px solid transparent; cursor: pointer; transition: all 0.2s; overflow: hidden; }
.dam__card:hover { border-color: var(--border); box-shadow: 0 8px 24px var(--shadow); transform: translateY(-2px); }
.dam__card--selected { border-color: var(--primary); background: rgba(120, 171, 230, 0.04); }
.dam__card-check { position: absolute; top: 12px; left: 12px; z-index: 2; opacity: 0; transition: opacity 0.15s; }
.dam__card:hover .dam__card-check, .dam__card--selected .dam__card-check { opacity: 1; }
.dam__checkbox { width: 22px; height: 22px; border: 2px solid #d1d5db; border-radius: 6px; background: #ffffff; display: flex; align-items: center; justify-content: center; transition: all 0.15s; }
.dam__checkbox svg { width: 14px; height: 14px; }
.dam__checkbox--checked { background: var(--primary); border-color: var(--primary); color: white; }
.dam__card-preview { height: 140px; background: var(--bg); display: flex; align-items: center; justify-content: center; overflow: hidden; }
.dam__card-img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s; }
.dam__card:hover .dam__card-img { transform: scale(1.05); }
.dam__card-icon { color: var(--text-muted); }
.dam__card-icon svg { width: 48px; height: 48px; }
.dam__card-icon--folder { color: var(--primary); }
.dam__card-info { padding: 14px 16px; }
.dam__card-name { font-weight: 600; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 4px; }
.dam__card-meta { font-size: 12px; color: var(--text-muted); }
.dam__card-menu { position: absolute; top: 12px; right: 12px; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; background: #ffffff; border: none; border-radius: 8px; color: var(--text-muted); cursor: pointer; opacity: 0; transition: all 0.15s; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
.dam__card:hover .dam__card-menu { opacity: 1; }
.dam__card-menu:hover { color: var(--text); background: #f3f4f6; }
.dam__card-menu svg { width: 16px; height: 16px; }

.dam__list { display: flex; flex-direction: column; }
.dam__list-header { display: grid; grid-template-columns: 40px 44px 1fr 120px 48px; gap: 12px; align-items: center; padding: 10px 16px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); border-bottom: 1px solid var(--border); }
.dam__list-header [data-sort] { cursor: pointer; }
.dam__list-header [data-sort]:hover { color: var(--text); }
.dam__list-row { display: grid; grid-template-columns: 40px 44px 1fr 120px 48px; gap: 12px; align-items: center; padding: 12px 16px; border-radius: var(--radius-sm); cursor: pointer; transition: all 0.15s; }
.dam__list-row:hover { background: var(--bg); }
.dam__list-row--selected { background: rgba(120, 171, 230, 0.06); }
.dam__list-col--icon { display: flex; justify-content: center; }
.dam__icon { color: var(--text-muted); display: flex; }
.dam__icon svg { width: 22px; height: 22px; }
.dam__icon--folder { color: var(--primary); }
.dam__list-col--name { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dam__list-col--type { font-size: 13px; color: var(--text-secondary); }
.dam__list-col--actions { display: flex; justify-content: flex-end; }

.dam__empty { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 80px 24px; }
.dam__empty-icon { width: 80px; height: 80px; background: var(--bg); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--text-muted); margin-bottom: 24px; }
.dam__empty-icon svg { width: 36px; height: 36px; }
.dam__empty-title { font-size: 20px; font-weight: 700; margin: 0 0 8px; }
.dam__empty-text { color: var(--text-secondary); margin: 0 0 24px; max-width: 300px; }
.dam__empty-actions { display: flex; gap: 12px; }

.dam__context-menu { position: fixed; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; box-shadow: 0 12px 40px rgba(0,0,0,0.15); min-width: 180px; padding: 6px; z-index: 1000; animation: damContextIn 0.15s ease; }
@keyframes damContextIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
.dam__context-item { display: flex; align-items: center; gap: 12px; width: 100%; padding: 10px 14px; font-size: 14px; background: none; border: none; border-radius: var(--radius-xs); color: var(--text); cursor: pointer; transition: all 0.1s; text-align: left; }
.dam__context-item:hover { background: #f3f4f6; }
.dam__context-item svg { width: 18px; height: 18px; color: var(--text-secondary); }

.dam__modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 2000; padding: 24px; animation: damFadeIn 0.2s ease; }
@keyframes damFadeIn { from { opacity: 0; } to { opacity: 1; } }
.dam__modal { background: #ffffff; border-radius: 16px; max-width: 480px; width: 100%; max-height: 90vh; overflow: auto; animation: damSlideUp 0.25s ease; box-shadow: 0 24px 80px rgba(0,0,0,0.25); }
@keyframes damSlideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
.dam__modal--large { max-width: 900px; }
.dam__modal-header { display: flex; align-items: center; justify-content: space-between; padding: 20px 24px; border-bottom: 1px solid #e5e7eb; }
.dam__modal-header h3 { font-size: 18px; font-weight: 700; margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dam__modal-close { width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; background: none; border: none; border-radius: var(--radius-sm); color: var(--text-muted); cursor: pointer; transition: all 0.15s; }
.dam__modal-close:hover { background: #f3f4f6; color: var(--text); }
.dam__modal-body { padding: 24px; }
.dam__modal-footer { display: flex; justify-content: flex-end; gap: 12px; padding: 16px 24px; border-top: 1px solid #e5e7eb; background: #f9fafb; }

.dam__preview { background: #0a0a0a; display: flex; align-items: center; justify-content: center; min-height: 300px; border-radius: var(--radius-sm); overflow: hidden; }
.dam__preview-img { max-width: 100%; max-height: 60vh; object-fit: contain; }
.dam__preview-video { max-width: 100%; max-height: 60vh; }
.dam__preview-pdf { width: 100%; height: 60vh; border: none; }
.dam__preview-fallback { text-align: center; color: #666; padding: 60px; }
.dam__preview-fallback svg { width: 64px; height: 64px; margin-bottom: 16px; }
.dam__preview-bar { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; background: #1a1a1a; color: #999; font-size: 13px; margin-top: 16px; border-radius: var(--radius-sm); }
.dam__preview-actions { display: flex; gap: 8px; }

.dam__toasts { position: fixed; bottom: 24px; right: 24px; z-index: 3000; display: flex; flex-direction: column; gap: 10px; }
.dam__toast { display: flex; align-items: center; gap: 12px; padding: 14px 20px; background: #ffffff; border-radius: 12px; box-shadow: 0 12px 40px rgba(0,0,0,0.2); animation: damToastIn 0.3s ease; font-weight: 500; }
@keyframes damToastIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
.dam__toast--exit { animation: damToastOut 0.3s ease forwards; }
@keyframes damToastOut { to { opacity: 0; transform: translateX(20px); } }
.dam__toast-icon { display: flex; }
.dam__toast--success .dam__toast-icon { color: var(--accent); }
.dam__toast--error .dam__toast-icon { color: var(--danger); }

.dam--denied { display: flex; align-items: center; justify-content: center; min-height: 500px; }
.dam__denied { text-align: center; padding: 60px; }
.dam__denied-icon { width: 80px; height: 80px; background: rgba(255, 59, 92, 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--danger); margin: 0 auto 24px; }
.dam__denied-icon svg { width: 36px; height: 36px; }
.dam__denied h2 { font-size: 24px; margin: 0 0 12px; }
.dam__denied p { color: var(--text-secondary); margin: 0; }

@media (max-width: 768px) {
  .dam__header { flex-direction: column; align-items: stretch; gap: 12px; padding: 16px; }
  .dam__search { max-width: none; }
  .dam__header-actions { justify-content: center; }
  .dam__toolbar { flex-direction: column; align-items: stretch; gap: 12px; padding: 12px 16px; }
  .dam__toolbar-actions { justify-content: space-between; }
  .dam__body { padding: 16px; }
  .dam__grid { grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; }
  .dam__card-preview { height: 100px; }
  .dam__card-icon svg { width: 36px; height: 36px; }
  .dam__card-info { padding: 10px 12px; }
  .dam__card-name { font-size: 13px; }
  .dam__list-header { display: none; }
  .dam__list-row { grid-template-columns: 40px 40px 1fr 40px; padding: 10px 12px; }
  .dam__list-col--type { display: none; }
  .dam__selection-bar { flex-direction: column; gap: 12px; padding: 12px 16px; }
  .dam__btn span { display: none; }
  .dam__btn--primary span { display: inline; }
  .dam__modal { margin: 16px; max-height: calc(100vh - 32px); }
  .dam__toasts { bottom: 16px; right: 16px; left: 16px; }
  .dam__toast { width: 100%; }
}

@media (max-width: 480px) {
  .dam__grid { grid-template-columns: repeat(2, 1fr); }
  .dam__empty { padding: 40px 16px; }
  .dam__empty-actions { flex-direction: column; width: 100%; }
  .dam__empty-actions .dam__btn { width: 100%; justify-content: center; }
}
`;
    document.head.appendChild(style);
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DAMHub;
} else if (typeof window !== 'undefined') {
  window.DAMHub = DAMHub;
}
