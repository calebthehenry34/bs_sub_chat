/**
 * Shopify Digital Asset Management (DAM) Component - Standalone Version
 *
 * Runs entirely within Shopify - NO external backend required!
 *
 * Storage: localStorage (browser-based) or Shopify metafields (persistent)
 * Files: Referenced by URL from Shopify Admin → Settings → Files
 *
 * Access restricted to users with 'admin' or 'affiliate' tags.
 *
 * @version 2.0.0 - Standalone Edition
 */

class ShopifyDAM {
  constructor(config = {}) {
    this.config = {
      containerId: config.containerId || 'shopify-dam-container',
      userEmail: config.userEmail || '',
      userTags: config.userTags || [],
      allowedTags: config.allowedTags || ['admin', 'affiliate'],
      storageKey: config.storageKey || 'shopify_dam_data',
      maxFileSize: config.maxFileSize || 20 * 1024 * 1024,
      theme: {
        primaryColor: config.theme?.primaryColor || '#2563eb',
        secondaryColor: config.theme?.secondaryColor || '#64748b',
        backgroundColor: config.theme?.backgroundColor || '#f8fafc',
        cardBackground: config.theme?.cardBackground || '#ffffff',
        textColor: config.theme?.textColor || '#1e293b',
        borderColor: config.theme?.borderColor || '#e2e8f0',
        borderRadius: config.theme?.borderRadius || '8px',
        fontFamily: config.theme?.fontFamily || '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        successColor: config.theme?.successColor || '#22c55e',
        errorColor: config.theme?.errorColor || '#ef4444',
        warningColor: config.theme?.warningColor || '#f59e0b'
      }
    };

    this.state = {
      loading: true,
      initialized: false,
      hasAccess: false,
      currentPath: '/',
      folders: [],
      files: [],
      selectedItems: [],
      viewMode: localStorage.getItem('dam_view_mode') || 'grid',
      sortBy: 'name',
      sortOrder: 'asc',
      searchQuery: '',
      clipboard: null,
      contextMenu: null,
      modal: null
    };

    this.container = null;
    this.data = { folders: [], files: [] };
  }

  /**
   * Initialize the DAM component
   */
  async init() {
    this.container = document.getElementById(this.config.containerId);
    if (!this.container) {
      console.error('ShopifyDAM: Container not found');
      return;
    }

    // Check access
    this.state.hasAccess = this.checkAccess();
    if (!this.state.hasAccess) {
      this.renderAccessDenied();
      return;
    }

    this.injectStyles();
    this.renderLoading();

    // Load data from localStorage
    this.loadData();

    // Ensure root folder exists
    if (!this.data.folders.find(f => f.path === '/')) {
      this.data.folders.push({
        id: this.generateId(),
        name: 'Root',
        path: '/',
        parentPath: null,
        createdAt: new Date().toISOString()
      });
      this.saveData();
    }

    this.setupEventListeners();
    this.state.initialized = true;
    this.state.loading = false;
    this.render();
  }

  checkAccess() {
    if (!this.config.userTags || this.config.userTags.length === 0) return false;
    return this.config.allowedTags.some(tag =>
      this.config.userTags.map(t => t.toLowerCase()).includes(tag.toLowerCase())
    );
  }

  loadData() {
    try {
      const stored = localStorage.getItem(this.config.storageKey);
      if (stored) {
        this.data = JSON.parse(stored);
      }
    } catch (e) {
      console.error('Failed to load DAM data:', e);
      this.data = { folders: [], files: [] };
    }
  }

  saveData() {
    try {
      localStorage.setItem(this.config.storageKey, JSON.stringify(this.data));
    } catch (e) {
      console.error('Failed to save DAM data:', e);
      this.showToast('error', 'Failed to save changes');
    }
  }

  generateId() {
    return 'dam_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
  }

  normalizePath(p) {
    let normalized = p || '/';
    if (!normalized.startsWith('/')) normalized = '/' + normalized;
    if (normalized !== '/' && !normalized.endsWith('/')) normalized += '/';
    return normalized.replace(/\/+/g, '/');
  }

  getCurrentItems() {
    const path = this.normalizePath(this.state.currentPath);
    let folders = this.data.folders.filter(f => f.parentPath === path);
    let files = this.data.files.filter(f => f.folderPath === path);

    // Apply search
    if (this.state.searchQuery) {
      const q = this.state.searchQuery.toLowerCase();
      folders = folders.filter(f => f.name.toLowerCase().includes(q));
      files = files.filter(f => f.name.toLowerCase().includes(q));
    }

    // Apply sort
    const sortFn = (a, b) => {
      let cmp = 0;
      switch (this.state.sortBy) {
        case 'name': cmp = a.name.localeCompare(b.name); break;
        case 'date': cmp = new Date(a.createdAt) - new Date(b.createdAt); break;
        case 'size': cmp = (a.size || 0) - (b.size || 0); break;
      }
      return this.state.sortOrder === 'asc' ? cmp : -cmp;
    };

    folders.sort(sortFn);
    files.sort(sortFn);

    return { folders, files };
  }

  // ============ CRUD Operations ============

  createFolder(name) {
    const parentPath = this.normalizePath(this.state.currentPath);
    const folderPath = parentPath + name + '/';

    if (this.data.folders.find(f => f.path === folderPath)) {
      this.showToast('error', 'Folder already exists');
      return false;
    }

    this.data.folders.push({
      id: this.generateId(),
      name,
      path: folderPath,
      parentPath,
      createdAt: new Date().toISOString()
    });

    this.saveData();
    this.showToast('success', `Folder "${name}" created`);
    this.render();
    return true;
  }

  addFile(name, url, type, size) {
    const folderPath = this.normalizePath(this.state.currentPath);

    // Check for duplicates
    let finalName = name;
    let counter = 1;
    while (this.data.files.find(f => f.folderPath === folderPath && f.name === finalName)) {
      const ext = name.includes('.') ? '.' + name.split('.').pop() : '';
      const base = name.replace(ext, '');
      finalName = `${base} (${counter})${ext}`;
      counter++;
    }

    this.data.files.push({
      id: this.generateId(),
      name: finalName,
      url,
      type: type || this.guessFileType(name, url),
      size: size || 0,
      folderPath,
      createdAt: new Date().toISOString()
    });

    this.saveData();
    this.showToast('success', `File "${finalName}" added`);
    this.render();
    return true;
  }

  guessFileType(name, url) {
    const ext = (name || url || '').split('.').pop().toLowerCase();
    const typeMap = {
      'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png',
      'gif': 'image/gif', 'webp': 'image/webp', 'svg': 'image/svg+xml',
      'mp4': 'video/mp4', 'webm': 'video/webm', 'mov': 'video/quicktime',
      'pdf': 'application/pdf', 'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel', 'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'zip': 'application/zip', 'rar': 'application/x-rar-compressed'
    };
    return typeMap[ext] || 'application/octet-stream';
  }

  renameItem(id, newName, isFolder) {
    if (isFolder) {
      const folder = this.data.folders.find(f => f.id === id);
      if (!folder) return false;

      const oldPath = folder.path;
      const newPath = folder.parentPath + newName + '/';

      if (this.data.folders.find(f => f.path === newPath && f.id !== id)) {
        this.showToast('error', 'A folder with this name already exists');
        return false;
      }

      folder.name = newName;
      folder.path = newPath;

      // Update nested items
      this.data.folders.forEach(f => {
        if (f.path.startsWith(oldPath) && f.id !== id) {
          f.path = f.path.replace(oldPath, newPath);
          f.parentPath = f.parentPath.replace(oldPath, newPath);
        }
      });

      this.data.files.forEach(f => {
        if (f.folderPath.startsWith(oldPath)) {
          f.folderPath = f.folderPath.replace(oldPath, newPath);
        }
      });
    } else {
      const file = this.data.files.find(f => f.id === id);
      if (!file) return false;

      if (this.data.files.find(f => f.folderPath === file.folderPath && f.name === newName && f.id !== id)) {
        this.showToast('error', 'A file with this name already exists');
        return false;
      }

      file.name = newName;
    }

    this.saveData();
    this.showToast('success', 'Renamed successfully');
    this.render();
    return true;
  }

  deleteItems(items) {
    items.forEach(item => {
      if (item.isFolder) {
        const folder = this.data.folders.find(f => f.id === item.id);
        if (folder && folder.path !== '/') {
          // Delete folder and all nested content
          this.data.folders = this.data.folders.filter(f => !f.path.startsWith(folder.path));
          this.data.files = this.data.files.filter(f => !f.folderPath.startsWith(folder.path));
        }
      } else {
        this.data.files = this.data.files.filter(f => f.id !== item.id);
      }
    });

    this.saveData();
    this.state.selectedItems = [];
    this.showToast('success', `${items.length} item(s) deleted`);
    this.render();
  }

  moveItems(items, destination) {
    const destPath = this.normalizePath(destination);

    // Verify destination exists
    if (destPath !== '/' && !this.data.folders.find(f => f.path === destPath)) {
      this.showToast('error', 'Destination folder not found');
      return false;
    }

    items.forEach(item => {
      if (item.isFolder) {
        const folder = this.data.folders.find(f => f.id === item.id);
        if (folder) {
          if (destPath.startsWith(folder.path)) {
            this.showToast('error', 'Cannot move folder into itself');
            return;
          }

          const oldPath = folder.path;
          const newPath = destPath + folder.name + '/';

          folder.parentPath = destPath;
          folder.path = newPath;

          // Update nested
          this.data.folders.forEach(f => {
            if (f.path.startsWith(oldPath) && f.id !== folder.id) {
              f.path = f.path.replace(oldPath, newPath);
              f.parentPath = f.parentPath.replace(oldPath, newPath);
            }
          });

          this.data.files.forEach(f => {
            if (f.folderPath.startsWith(oldPath)) {
              f.folderPath = f.folderPath.replace(oldPath, newPath);
            }
          });
        }
      } else {
        const file = this.data.files.find(f => f.id === item.id);
        if (file) {
          file.folderPath = destPath;
        }
      }
    });

    this.saveData();
    this.state.selectedItems = [];
    this.showToast('success', 'Items moved');
    this.render();
    return true;
  }

  // ============ Navigation ============

  navigateTo(path) {
    this.state.currentPath = this.normalizePath(path);
    this.state.selectedItems = [];
    this.state.searchQuery = '';
    this.render();
  }

  // ============ Selection ============

  toggleSelection(id, isFolder) {
    const idx = this.state.selectedItems.findIndex(s => s.id === id && s.isFolder === isFolder);
    if (idx >= 0) {
      this.state.selectedItems.splice(idx, 1);
    } else {
      this.state.selectedItems.push({ id, isFolder });
    }
    this.render();
  }

  selectAll() {
    const { folders, files } = this.getCurrentItems();
    this.state.selectedItems = [
      ...folders.map(f => ({ id: f.id, isFolder: true })),
      ...files.map(f => ({ id: f.id, isFolder: false }))
    ];
    this.render();
  }

  deselectAll() {
    this.state.selectedItems = [];
    this.render();
  }

  // ============ Event Listeners ============

  setupEventListeners() {
    document.addEventListener('click', (e) => {
      if (this.state.contextMenu && !e.target.closest('.dam-context-menu')) {
        this.closeContextMenu();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (!this.state.initialized || !this.state.hasAccess) return;
      if (e.target.matches('input, textarea')) return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        this.selectAll();
      }
      if (e.key === 'Escape') {
        this.deselectAll();
        this.closeContextMenu();
        this.closeModal();
      }
      if (e.key === 'Delete' && this.state.selectedItems.length > 0) {
        this.confirmDelete();
      }
    });
  }

  // ============ Rendering ============

  render() {
    const hasSelection = this.state.selectedItems.length > 0;

    this.container.innerHTML = `
      <div class="dam-container">
        ${this.renderHeader()}
        ${hasSelection ? this.renderSelectionBar() : ''}
        ${this.renderToolbar()}
        ${this.renderContent()}
      </div>
    `;

    this.attachEventHandlers();
  }

  renderHeader() {
    return `
      <div class="dam-header">
        <h1 class="dam-title">
          ${this.icons.folder}
          Digital Asset Manager
        </h1>
        <div class="dam-header-actions">
          <div class="dam-search-wrapper">
            <span class="dam-search-icon">${this.icons.search}</span>
            <input type="text" class="dam-search-input" placeholder="Search..." value="${this.escapeHtml(this.state.searchQuery)}" id="dam-search">
            ${this.state.searchQuery ? `<button class="dam-search-clear" id="dam-search-clear">${this.icons.x}</button>` : ''}
          </div>
          <button class="dam-btn dam-btn-primary" id="dam-add-file-btn">
            ${this.icons.plus}
            Add File
          </button>
        </div>
      </div>
    `;
  }

  renderSelectionBar() {
    const count = this.state.selectedItems.length;
    return `
      <div class="dam-selection-bar">
        <span class="dam-selection-info">${count} item${count > 1 ? 's' : ''} selected</span>
        <div class="dam-selection-actions">
          <button class="dam-btn" id="dam-move-selected">${this.icons.move} Move</button>
          <button class="dam-btn" id="dam-delete-selected">${this.icons.trash} Delete</button>
          <button class="dam-btn" id="dam-clear-selection">${this.icons.x} Clear</button>
        </div>
      </div>
    `;
  }

  renderToolbar() {
    return `
      <div class="dam-toolbar">
        <div class="dam-toolbar-left">
          ${this.renderBreadcrumbs()}
        </div>
        <div class="dam-toolbar-right">
          <button class="dam-btn dam-btn-secondary" id="dam-new-folder">${this.icons.folderPlus} New Folder</button>
          <div class="dam-view-toggle">
            <button data-view="grid" class="${this.state.viewMode === 'grid' ? 'active' : ''}" title="Grid">${this.icons.grid}</button>
            <button data-view="list" class="${this.state.viewMode === 'list' ? 'active' : ''}" title="List">${this.icons.list}</button>
          </div>
        </div>
      </div>
    `;
  }

  renderBreadcrumbs() {
    const parts = this.state.currentPath.split('/').filter(p => p);
    let path = '/';
    const crumbs = [`<span class="dam-breadcrumb${parts.length === 0 ? ' active' : ''}" data-path="/">${this.icons.home}</span>`];

    parts.forEach((part, i) => {
      path += part + '/';
      const isLast = i === parts.length - 1;
      crumbs.push(`<span class="dam-breadcrumb-sep">/</span>`);
      crumbs.push(`<span class="dam-breadcrumb${isLast ? ' active' : ''}" data-path="${this.escapeHtml(path)}">${this.escapeHtml(part)}</span>`);
    });

    return `<div class="dam-breadcrumbs">${crumbs.join('')}</div>`;
  }

  renderContent() {
    const { folders, files } = this.getCurrentItems();

    if (folders.length === 0 && files.length === 0) {
      return `
        <div class="dam-content" id="dam-content">
          <div class="dam-empty">
            ${this.state.searchQuery ? this.icons.search : this.icons.folderOpen}
            <h3 class="dam-empty-title">${this.state.searchQuery ? 'No results found' : 'This folder is empty'}</h3>
            <p class="dam-empty-text">${this.state.searchQuery ? 'Try a different search term' : 'Create a folder or add files to get started'}</p>
            ${!this.state.searchQuery ? `
              <div class="dam-empty-actions">
                <button class="dam-btn dam-btn-secondary" id="dam-new-folder-empty">${this.icons.folderPlus} New Folder</button>
                <button class="dam-btn dam-btn-primary" id="dam-add-file-empty">${this.icons.plus} Add File</button>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }

    return `
      <div class="dam-content" id="dam-content">
        ${this.state.viewMode === 'grid' ? this.renderGrid(folders, files) : this.renderList(folders, files)}
      </div>
    `;
  }

  renderGrid(folders, files) {
    const renderItem = (item, isFolder) => {
      const isSelected = this.state.selectedItems.some(s => s.id === item.id && s.isFolder === isFolder);
      return `
        <div class="dam-item${isSelected ? ' selected' : ''}" data-id="${item.id}" data-type="${isFolder ? 'folder' : 'file'}">
          <div class="dam-item-checkbox">${isSelected ? this.icons.check : ''}</div>
          <div class="dam-item-preview">
            ${isFolder
              ? `<span class="dam-item-icon dam-folder-icon">${this.icons.folder}</span>`
              : this.renderFilePreview(item)}
          </div>
          <div class="dam-item-info">
            <div class="dam-item-name" title="${this.escapeHtml(item.name)}">${this.escapeHtml(item.name)}</div>
            <div class="dam-item-meta">${isFolder ? this.countItems(item.path) + ' items' : this.formatSize(item.size)}</div>
          </div>
        </div>
      `;
    };

    return `<div class="dam-grid">${folders.map(f => renderItem(f, true)).join('')}${files.map(f => renderItem(f, false)).join('')}</div>`;
  }

  renderList(folders, files) {
    const renderItem = (item, isFolder) => {
      const isSelected = this.state.selectedItems.some(s => s.id === item.id && s.isFolder === isFolder);
      return `
        <div class="dam-item${isSelected ? ' selected' : ''}" data-id="${item.id}" data-type="${isFolder ? 'folder' : 'file'}">
          <div class="dam-item-preview">
            ${isFolder
              ? `<span class="dam-item-icon dam-folder-icon">${this.icons.folder}</span>`
              : `<span class="dam-item-icon">${this.getFileIcon(item.type)}</span>`}
          </div>
          <div class="dam-item-name">${this.escapeHtml(item.name)}</div>
          <div class="dam-item-meta">${isFolder ? '-' : this.formatSize(item.size)}</div>
          <div class="dam-item-meta">${isFolder ? 'Folder' : this.getTypeLabel(item.type)}</div>
          <div class="dam-item-meta">${this.formatDate(item.createdAt)}</div>
        </div>
      `;
    };

    return `
      <div class="dam-list">
        <div class="dam-list-header">
          <span></span>
          <span data-sort="name">Name</span>
          <span data-sort="size">Size</span>
          <span>Type</span>
          <span data-sort="date">Date</span>
        </div>
        ${folders.map(f => renderItem(f, true)).join('')}
        ${files.map(f => renderItem(f, false)).join('')}
      </div>
    `;
  }

  renderFilePreview(file) {
    if (file.type && file.type.startsWith('image/') && file.url) {
      return `<img src="${file.url}" alt="${this.escapeHtml(file.name)}" loading="lazy">`;
    }
    return `<span class="dam-item-icon">${this.getFileIcon(file.type)}</span>`;
  }

  countItems(folderPath) {
    const subfolders = this.data.folders.filter(f => f.parentPath === folderPath).length;
    const files = this.data.files.filter(f => f.folderPath === folderPath).length;
    return subfolders + files;
  }

  // ============ Event Handlers ============

  attachEventHandlers() {
    // Search
    const searchInput = document.getElementById('dam-search');
    if (searchInput) {
      searchInput.addEventListener('input', this.debounce((e) => {
        this.state.searchQuery = e.target.value;
        this.render();
      }, 200));
    }

    document.getElementById('dam-search-clear')?.addEventListener('click', () => {
      this.state.searchQuery = '';
      this.render();
    });

    // Add file button
    document.getElementById('dam-add-file-btn')?.addEventListener('click', () => this.showAddFileModal());
    document.getElementById('dam-add-file-empty')?.addEventListener('click', () => this.showAddFileModal());

    // New folder button
    document.getElementById('dam-new-folder')?.addEventListener('click', () => this.showNewFolderModal());
    document.getElementById('dam-new-folder-empty')?.addEventListener('click', () => this.showNewFolderModal());

    // View toggle
    this.container.querySelectorAll('.dam-view-toggle button').forEach(btn => {
      btn.addEventListener('click', () => {
        this.state.viewMode = btn.dataset.view;
        localStorage.setItem('dam_view_mode', this.state.viewMode);
        this.render();
      });
    });

    // Breadcrumbs
    this.container.querySelectorAll('.dam-breadcrumb').forEach(crumb => {
      crumb.addEventListener('click', () => {
        if (!crumb.classList.contains('active')) {
          this.navigateTo(crumb.dataset.path);
        }
      });
    });

    // Items
    this.container.querySelectorAll('.dam-item').forEach(item => {
      item.addEventListener('click', (e) => this.handleItemClick(e, item));
      item.addEventListener('dblclick', () => this.handleItemDblClick(item));
      item.addEventListener('contextmenu', (e) => this.handleItemContextMenu(e, item));
    });

    // Selection actions
    document.getElementById('dam-move-selected')?.addEventListener('click', () => this.showMoveModal());
    document.getElementById('dam-delete-selected')?.addEventListener('click', () => this.confirmDelete());
    document.getElementById('dam-clear-selection')?.addEventListener('click', () => this.deselectAll());

    // Sort headers
    this.container.querySelectorAll('.dam-list-header span[data-sort]').forEach(header => {
      header.addEventListener('click', () => {
        if (this.state.sortBy === header.dataset.sort) {
          this.state.sortOrder = this.state.sortOrder === 'asc' ? 'desc' : 'asc';
        } else {
          this.state.sortBy = header.dataset.sort;
          this.state.sortOrder = 'asc';
        }
        this.render();
      });
    });
  }

  handleItemClick(e, item) {
    const id = item.dataset.id;
    const isFolder = item.dataset.type === 'folder';

    if (e.ctrlKey || e.metaKey || e.target.closest('.dam-item-checkbox')) {
      this.toggleSelection(id, isFolder);
    } else {
      this.state.selectedItems = [{ id, isFolder }];
      this.render();
    }
  }

  handleItemDblClick(item) {
    const id = item.dataset.id;
    const isFolder = item.dataset.type === 'folder';

    if (isFolder) {
      const folder = this.data.folders.find(f => f.id === id);
      if (folder) this.navigateTo(folder.path);
    } else {
      const file = this.data.files.find(f => f.id === id);
      if (file) this.showPreview(file);
    }
  }

  handleItemContextMenu(e, item) {
    e.preventDefault();
    const id = item.dataset.id;
    const isFolder = item.dataset.type === 'folder';

    if (!this.state.selectedItems.some(s => s.id === id)) {
      this.state.selectedItems = [{ id, isFolder }];
      this.render();
    }

    this.showContextMenu(e.clientX, e.clientY, isFolder);
  }

  // ============ Modals ============

  showAddFileModal() {
    this.showModal({
      title: 'Add File',
      content: `
        <p class="dam-modal-hint">Add a file from Shopify. Go to <strong>Settings → Files</strong> in your Shopify admin, upload your file, then copy the URL here.</p>
        <div class="dam-form-group">
          <label class="dam-label">File Name</label>
          <input type="text" class="dam-input" id="dam-file-name" placeholder="my-image.jpg">
        </div>
        <div class="dam-form-group">
          <label class="dam-label">File URL</label>
          <input type="text" class="dam-input" id="dam-file-url" placeholder="https://cdn.shopify.com/s/files/...">
        </div>
        <div class="dam-form-row">
          <div class="dam-form-group">
            <label class="dam-label">Type (optional)</label>
            <select class="dam-input" id="dam-file-type">
              <option value="">Auto-detect</option>
              <option value="image/jpeg">Image (JPEG)</option>
              <option value="image/png">Image (PNG)</option>
              <option value="image/gif">Image (GIF)</option>
              <option value="image/webp">Image (WebP)</option>
              <option value="video/mp4">Video (MP4)</option>
              <option value="application/pdf">PDF</option>
              <option value="application/zip">Archive (ZIP)</option>
            </select>
          </div>
          <div class="dam-form-group">
            <label class="dam-label">Size (bytes, optional)</label>
            <input type="number" class="dam-input" id="dam-file-size" placeholder="0">
          </div>
        </div>
      `,
      actions: [
        { label: 'Cancel', type: 'secondary', action: 'close' },
        { label: 'Add File', type: 'primary', action: 'add' }
      ],
      onAction: (action) => {
        if (action === 'add') {
          const name = document.getElementById('dam-file-name').value.trim();
          const url = document.getElementById('dam-file-url').value.trim();
          const type = document.getElementById('dam-file-type').value;
          const size = parseInt(document.getElementById('dam-file-size').value) || 0;

          if (!name || !url) {
            this.showToast('error', 'Name and URL are required');
            return false;
          }

          return this.addFile(name, url, type, size);
        }
        return true;
      }
    });
  }

  showNewFolderModal() {
    this.showModal({
      title: 'New Folder',
      content: `
        <div class="dam-form-group">
          <label class="dam-label">Folder Name</label>
          <input type="text" class="dam-input" id="dam-folder-name" placeholder="My Folder" autofocus>
        </div>
      `,
      actions: [
        { label: 'Cancel', type: 'secondary', action: 'close' },
        { label: 'Create', type: 'primary', action: 'create' }
      ],
      onAction: (action) => {
        if (action === 'create') {
          const name = document.getElementById('dam-folder-name').value.trim();
          if (!name) {
            this.showToast('error', 'Please enter a folder name');
            return false;
          }
          return this.createFolder(name);
        }
        return true;
      }
    });

    setTimeout(() => document.getElementById('dam-folder-name')?.focus(), 100);
  }

  showRenameModal(item, isFolder) {
    this.showModal({
      title: `Rename ${isFolder ? 'Folder' : 'File'}`,
      content: `
        <div class="dam-form-group">
          <label class="dam-label">New Name</label>
          <input type="text" class="dam-input" id="dam-rename-input" value="${this.escapeHtml(item.name)}">
        </div>
      `,
      actions: [
        { label: 'Cancel', type: 'secondary', action: 'close' },
        { label: 'Rename', type: 'primary', action: 'rename' }
      ],
      onAction: (action) => {
        if (action === 'rename') {
          const newName = document.getElementById('dam-rename-input').value.trim();
          if (!newName) {
            this.showToast('error', 'Please enter a name');
            return false;
          }
          return this.renameItem(item.id, newName, isFolder);
        }
        return true;
      }
    });

    setTimeout(() => {
      const input = document.getElementById('dam-rename-input');
      if (input) {
        input.focus();
        const dot = item.name.lastIndexOf('.');
        input.setSelectionRange(0, dot > 0 ? dot : item.name.length);
      }
    }, 100);
  }

  showMoveModal() {
    const folderOptions = this.data.folders
      .filter(f => f.path !== '/')
      .map(f => `<option value="${this.escapeHtml(f.path)}">${this.escapeHtml(f.path)}</option>`)
      .join('');

    this.showModal({
      title: 'Move Items',
      content: `
        <div class="dam-form-group">
          <label class="dam-label">Destination Folder</label>
          <select class="dam-input" id="dam-move-dest">
            <option value="/">/ (Root)</option>
            ${folderOptions}
          </select>
        </div>
      `,
      actions: [
        { label: 'Cancel', type: 'secondary', action: 'close' },
        { label: 'Move', type: 'primary', action: 'move' }
      ],
      onAction: (action) => {
        if (action === 'move') {
          const dest = document.getElementById('dam-move-dest').value;
          return this.moveItems([...this.state.selectedItems], dest);
        }
        return true;
      }
    });
  }

  confirmDelete() {
    const count = this.state.selectedItems.length;
    this.showModal({
      title: 'Delete Items',
      content: `
        <p>Are you sure you want to delete ${count} item${count > 1 ? 's' : ''}?</p>
        <p class="dam-modal-warning">This action cannot be undone.</p>
      `,
      actions: [
        { label: 'Cancel', type: 'secondary', action: 'close' },
        { label: 'Delete', type: 'danger', action: 'delete' }
      ],
      onAction: (action) => {
        if (action === 'delete') {
          this.deleteItems([...this.state.selectedItems]);
        }
        return true;
      }
    });
  }

  showPreview(file) {
    let content = '';

    if (file.type?.startsWith('image/')) {
      content = `<img src="${file.url}" alt="${this.escapeHtml(file.name)}" style="max-width:100%;max-height:60vh;">`;
    } else if (file.type?.startsWith('video/')) {
      content = `<video src="${file.url}" controls autoplay style="max-width:100%;max-height:60vh;"></video>`;
    } else if (file.type === 'application/pdf') {
      content = `<iframe src="${file.url}" style="width:100%;height:60vh;border:none;"></iframe>`;
    } else {
      content = `
        <div style="text-align:center;padding:40px;">
          ${this.getFileIcon(file.type)}
          <p style="margin-top:16px;color:#64748b;">Preview not available</p>
        </div>
      `;
    }

    this.showModal({
      title: file.name,
      content: `
        <div class="dam-preview-content">${content}</div>
        <div class="dam-preview-info">
          <span>${this.formatSize(file.size)} • ${this.getTypeLabel(file.type)}</span>
          <div class="dam-preview-actions">
            <a href="${file.url}" target="_blank" class="dam-btn dam-btn-secondary">${this.icons.externalLink} Open</a>
            <a href="${file.url}" download="${file.name}" class="dam-btn dam-btn-primary">${this.icons.download} Download</a>
          </div>
        </div>
      `,
      actions: [],
      large: true
    });
  }

  showContextMenu(x, y, isFolder) {
    this.closeContextMenu();

    const menu = document.createElement('div');
    menu.className = 'dam-context-menu';
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    const items = isFolder ? [
      { label: 'Open', icon: this.icons.folderOpen, action: 'open' },
      { type: 'sep' },
      { label: 'Rename', icon: this.icons.edit, action: 'rename' },
      { label: 'Move', icon: this.icons.move, action: 'move' },
      { type: 'sep' },
      { label: 'Delete', icon: this.icons.trash, action: 'delete', danger: true }
    ] : [
      { label: 'Preview', icon: this.icons.eye, action: 'preview' },
      { label: 'Open in new tab', icon: this.icons.externalLink, action: 'open-new' },
      { label: 'Copy URL', icon: this.icons.link, action: 'copy-url' },
      { type: 'sep' },
      { label: 'Rename', icon: this.icons.edit, action: 'rename' },
      { label: 'Move', icon: this.icons.move, action: 'move' },
      { type: 'sep' },
      { label: 'Delete', icon: this.icons.trash, action: 'delete', danger: true }
    ];

    menu.innerHTML = items.map(item => {
      if (item.type === 'sep') return '<div class="dam-context-sep"></div>';
      return `<div class="dam-context-item${item.danger ? ' danger' : ''}" data-action="${item.action}">
        <span class="dam-context-icon">${item.icon}</span>${item.label}
      </div>`;
    }).join('');

    document.body.appendChild(menu);
    this.state.contextMenu = menu;

    // Adjust position
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) menu.style.left = `${x - rect.width}px`;
    if (rect.bottom > window.innerHeight) menu.style.top = `${y - rect.height}px`;

    menu.querySelectorAll('.dam-context-item').forEach(item => {
      item.addEventListener('click', () => {
        this.handleContextAction(item.dataset.action);
        this.closeContextMenu();
      });
    });
  }

  handleContextAction(action) {
    const selected = this.state.selectedItems[0];
    if (!selected) return;

    const item = selected.isFolder
      ? this.data.folders.find(f => f.id === selected.id)
      : this.data.files.find(f => f.id === selected.id);

    if (!item) return;

    switch (action) {
      case 'open':
        if (selected.isFolder) this.navigateTo(item.path);
        break;
      case 'preview':
        this.showPreview(item);
        break;
      case 'open-new':
        window.open(item.url, '_blank');
        break;
      case 'copy-url':
        navigator.clipboard.writeText(item.url).then(() => this.showToast('success', 'URL copied'));
        break;
      case 'rename':
        this.showRenameModal(item, selected.isFolder);
        break;
      case 'move':
        this.showMoveModal();
        break;
      case 'delete':
        this.confirmDelete();
        break;
    }
  }

  closeContextMenu() {
    if (this.state.contextMenu) {
      this.state.contextMenu.remove();
      this.state.contextMenu = null;
    }
  }

  showModal({ title, content, actions, onAction, large }) {
    this.closeModal();

    const modal = document.createElement('div');
    modal.className = 'dam-modal-overlay';
    modal.id = 'dam-modal';
    modal.innerHTML = `
      <div class="dam-modal${large ? ' dam-modal-large' : ''}">
        <div class="dam-modal-header">
          <h3>${title}</h3>
          <button class="dam-modal-close" data-action="close">${this.icons.x}</button>
        </div>
        <div class="dam-modal-body">${content}</div>
        ${actions.length ? `
          <div class="dam-modal-footer">
            ${actions.map(a => `<button class="dam-btn dam-btn-${a.type}" data-action="${a.action}">${a.label}</button>`).join('')}
          </div>
        ` : ''}
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const action = btn.dataset.action;
        if (action === 'close') {
          this.closeModal();
        } else if (onAction) {
          const shouldClose = await onAction(action);
          if (shouldClose) this.closeModal();
        }
      });
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) this.closeModal();
    });

    modal.querySelector('input')?.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter' && onAction) {
        const primary = actions.find(a => a.type === 'primary' || a.type === 'danger');
        if (primary) {
          const shouldClose = await onAction(primary.action);
          if (shouldClose) this.closeModal();
        }
      }
    });
  }

  closeModal() {
    document.getElementById('dam-modal')?.remove();
  }

  showToast(type, message) {
    let container = document.querySelector('.dam-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'dam-toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `dam-toast dam-toast-${type}`;
    toast.innerHTML = `<span class="dam-toast-icon">${type === 'success' ? this.icons.check : this.icons.x}</span><span>${this.escapeHtml(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.remove();
      if (container.children.length === 0) container.remove();
    }, 3000);
  }

  renderLoading() {
    this.container.innerHTML = `
      <div class="dam-container">
        <div class="dam-loading"><div class="dam-spinner"></div><p>Loading...</p></div>
      </div>
    `;
  }

  renderAccessDenied() {
    this.container.innerHTML = `
      <div class="dam-access-denied">
        ${this.icons.lock}
        <h2>Access Restricted</h2>
        <p>The Digital Asset Manager is only available to administrators and affiliate partners.</p>
      </div>
    `;
  }

  // ============ Helpers ============

  formatSize(bytes) {
    if (!bytes) return '-';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  }

  formatDate(date) {
    if (!date) return '-';
    return new Date(date).toLocaleDateString();
  }

  getFileIcon(type) {
    if (!type) return this.icons.file;
    if (type.startsWith('image/')) return this.icons.image;
    if (type.startsWith('video/')) return this.icons.video;
    if (type === 'application/pdf') return this.icons.pdf;
    if (type.includes('zip') || type.includes('rar')) return this.icons.archive;
    return this.icons.file;
  }

  getTypeLabel(type) {
    if (!type) return 'File';
    if (type.startsWith('image/')) return 'Image';
    if (type.startsWith('video/')) return 'Video';
    if (type === 'application/pdf') return 'PDF';
    if (type.includes('zip')) return 'Archive';
    return 'File';
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  debounce(fn, delay) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  // ============ Styles ============

  injectStyles() {
    if (document.getElementById('dam-styles')) return;

    const style = document.createElement('style');
    style.id = 'dam-styles';
    style.textContent = `
      .dam-container { font-family: ${this.config.theme.fontFamily}; background: ${this.config.theme.backgroundColor}; color: ${this.config.theme.textColor}; min-height: 500px; border-radius: ${this.config.theme.borderRadius}; overflow: hidden; }
      .dam-header { background: ${this.config.theme.cardBackground}; border-bottom: 1px solid ${this.config.theme.borderColor}; padding: 16px 20px; display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
      .dam-title { font-size: 20px; font-weight: 600; margin: 0; display: flex; align-items: center; gap: 10px; }
      .dam-title svg { width: 24px; height: 24px; color: ${this.config.theme.primaryColor}; }
      .dam-header-actions { display: flex; align-items: center; gap: 12px; }
      .dam-search-wrapper { position: relative; }
      .dam-search-input { padding: 8px 12px 8px 36px; border: 1px solid ${this.config.theme.borderColor}; border-radius: 6px; font-size: 14px; outline: none; width: 200px; }
      .dam-search-input:focus { border-color: ${this.config.theme.primaryColor}; box-shadow: 0 0 0 3px ${this.config.theme.primaryColor}20; }
      .dam-search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: ${this.config.theme.secondaryColor}; }
      .dam-search-icon svg { width: 18px; height: 18px; }
      .dam-search-clear { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: none; border: none; color: ${this.config.theme.secondaryColor}; cursor: pointer; padding: 2px; }
      .dam-btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 6px; font-size: 14px; font-weight: 500; cursor: pointer; border: 1px solid transparent; transition: all 0.15s; text-decoration: none; }
      .dam-btn svg { width: 18px; height: 18px; }
      .dam-btn-primary { background: ${this.config.theme.primaryColor}; color: white; }
      .dam-btn-primary:hover { background: ${this.config.theme.primaryColor}dd; }
      .dam-btn-secondary { background: ${this.config.theme.cardBackground}; border-color: ${this.config.theme.borderColor}; color: ${this.config.theme.textColor}; }
      .dam-btn-secondary:hover { background: ${this.config.theme.backgroundColor}; }
      .dam-btn-danger { background: ${this.config.theme.errorColor}; color: white; }
      .dam-btn-danger:hover { background: ${this.config.theme.errorColor}dd; }
      .dam-selection-bar { background: ${this.config.theme.primaryColor}; color: white; padding: 10px 20px; display: flex; align-items: center; justify-content: space-between; }
      .dam-selection-info { font-size: 14px; font-weight: 500; }
      .dam-selection-actions { display: flex; gap: 8px; }
      .dam-selection-actions .dam-btn { background: rgba(255,255,255,0.2); color: white; }
      .dam-selection-actions .dam-btn:hover { background: rgba(255,255,255,0.3); }
      .dam-toolbar { background: ${this.config.theme.cardBackground}; border-bottom: 1px solid ${this.config.theme.borderColor}; padding: 10px 20px; display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
      .dam-toolbar-left, .dam-toolbar-right { display: flex; align-items: center; gap: 8px; }
      .dam-breadcrumbs { display: flex; align-items: center; gap: 4px; font-size: 14px; flex-wrap: wrap; }
      .dam-breadcrumb { color: ${this.config.theme.secondaryColor}; cursor: pointer; padding: 4px 8px; border-radius: 4px; }
      .dam-breadcrumb:hover { background: ${this.config.theme.backgroundColor}; color: ${this.config.theme.primaryColor}; }
      .dam-breadcrumb.active { color: ${this.config.theme.textColor}; font-weight: 500; cursor: default; }
      .dam-breadcrumb.active:hover { background: transparent; color: ${this.config.theme.textColor}; }
      .dam-breadcrumb svg { width: 16px; height: 16px; }
      .dam-breadcrumb-sep { color: ${this.config.theme.secondaryColor}; }
      .dam-view-toggle { display: flex; border: 1px solid ${this.config.theme.borderColor}; border-radius: 6px; overflow: hidden; }
      .dam-view-toggle button { background: ${this.config.theme.cardBackground}; border: none; padding: 6px 10px; cursor: pointer; color: ${this.config.theme.secondaryColor}; }
      .dam-view-toggle button:not(:last-child) { border-right: 1px solid ${this.config.theme.borderColor}; }
      .dam-view-toggle button:hover { background: ${this.config.theme.backgroundColor}; }
      .dam-view-toggle button.active { background: ${this.config.theme.primaryColor}; color: white; }
      .dam-view-toggle svg { width: 18px; height: 18px; }
      .dam-content { padding: 20px; min-height: 300px; }
      .dam-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 16px; }
      .dam-item { background: ${this.config.theme.cardBackground}; border: 2px solid transparent; border-radius: 8px; cursor: pointer; transition: all 0.15s; position: relative; overflow: hidden; }
      .dam-item:hover { border-color: ${this.config.theme.borderColor}; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
      .dam-item.selected { border-color: ${this.config.theme.primaryColor}; background: ${this.config.theme.primaryColor}08; }
      .dam-item-checkbox { position: absolute; top: 8px; left: 8px; width: 20px; height: 20px; border: 2px solid white; border-radius: 4px; background: rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.15s; color: white; z-index: 1; }
      .dam-item-checkbox svg { width: 14px; height: 14px; }
      .dam-item:hover .dam-item-checkbox, .dam-item.selected .dam-item-checkbox { opacity: 1; }
      .dam-item.selected .dam-item-checkbox { background: ${this.config.theme.primaryColor}; border-color: ${this.config.theme.primaryColor}; }
      .dam-item-preview { height: 100px; display: flex; align-items: center; justify-content: center; background: ${this.config.theme.backgroundColor}; overflow: hidden; }
      .dam-item-preview img { width: 100%; height: 100%; object-fit: cover; }
      .dam-item-icon { color: ${this.config.theme.secondaryColor}; }
      .dam-item-icon svg { width: 40px; height: 40px; }
      .dam-folder-icon { color: ${this.config.theme.primaryColor}; }
      .dam-item-info { padding: 10px 12px; }
      .dam-item-name { font-size: 13px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .dam-item-meta { font-size: 11px; color: ${this.config.theme.secondaryColor}; margin-top: 4px; }
      .dam-list { display: flex; flex-direction: column; gap: 2px; }
      .dam-list-header { display: grid; grid-template-columns: 40px 1fr 100px 100px 100px; gap: 12px; padding: 8px 12px; font-size: 12px; font-weight: 600; color: ${this.config.theme.secondaryColor}; text-transform: uppercase; border-bottom: 1px solid ${this.config.theme.borderColor}; }
      .dam-list-header span[data-sort] { cursor: pointer; }
      .dam-list-header span[data-sort]:hover { color: ${this.config.theme.textColor}; }
      .dam-list .dam-item { display: grid; grid-template-columns: 40px 1fr 100px 100px 100px; gap: 12px; align-items: center; padding: 8px 12px; border-radius: 6px; }
      .dam-list .dam-item-preview { width: 40px; height: 40px; border-radius: 4px; }
      .dam-list .dam-item-preview .dam-item-icon svg { width: 24px; height: 24px; }
      .dam-list .dam-item-name { font-size: 14px; }
      .dam-list .dam-item-meta { margin-top: 0; font-size: 13px; }
      .dam-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px; text-align: center; }
      .dam-empty svg { width: 48px; height: 48px; color: ${this.config.theme.secondaryColor}; margin-bottom: 16px; }
      .dam-empty-title { font-size: 18px; font-weight: 600; margin-bottom: 8px; }
      .dam-empty-text { color: ${this.config.theme.secondaryColor}; margin-bottom: 20px; }
      .dam-empty-actions { display: flex; gap: 12px; }
      .dam-context-menu { position: fixed; background: ${this.config.theme.cardBackground}; border: 1px solid ${this.config.theme.borderColor}; border-radius: 8px; box-shadow: 0 10px 40px rgba(0,0,0,0.15); min-width: 180px; padding: 6px; z-index: 1000; }
      .dam-context-item { display: flex; align-items: center; gap: 10px; padding: 8px 12px; font-size: 14px; cursor: pointer; border-radius: 4px; }
      .dam-context-item:hover { background: ${this.config.theme.backgroundColor}; }
      .dam-context-item.danger { color: ${this.config.theme.errorColor}; }
      .dam-context-item.danger:hover { background: ${this.config.theme.errorColor}10; }
      .dam-context-icon svg { width: 16px; height: 16px; }
      .dam-context-sep { height: 1px; background: ${this.config.theme.borderColor}; margin: 6px 0; }
      .dam-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 2000; padding: 20px; }
      .dam-modal { background: ${this.config.theme.cardBackground}; border-radius: 12px; max-width: 480px; width: 100%; max-height: 90vh; overflow: auto; }
      .dam-modal-large { max-width: 800px; }
      .dam-modal-header { padding: 16px 20px; border-bottom: 1px solid ${this.config.theme.borderColor}; display: flex; align-items: center; justify-content: space-between; }
      .dam-modal-header h3 { font-size: 18px; font-weight: 600; margin: 0; }
      .dam-modal-close { background: none; border: none; color: ${this.config.theme.secondaryColor}; cursor: pointer; padding: 4px; }
      .dam-modal-close:hover { color: ${this.config.theme.textColor}; }
      .dam-modal-close svg { width: 20px; height: 20px; }
      .dam-modal-body { padding: 20px; }
      .dam-modal-footer { padding: 16px 20px; border-top: 1px solid ${this.config.theme.borderColor}; display: flex; justify-content: flex-end; gap: 12px; }
      .dam-modal-hint { font-size: 13px; color: ${this.config.theme.secondaryColor}; margin-bottom: 16px; line-height: 1.5; }
      .dam-modal-warning { color: ${this.config.theme.errorColor}; font-size: 13px; margin-top: 12px; }
      .dam-form-group { margin-bottom: 16px; }
      .dam-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
      .dam-label { display: block; font-size: 14px; font-weight: 500; margin-bottom: 6px; }
      .dam-input { width: 100%; padding: 10px 14px; border: 1px solid ${this.config.theme.borderColor}; border-radius: 6px; font-size: 14px; outline: none; }
      .dam-input:focus { border-color: ${this.config.theme.primaryColor}; box-shadow: 0 0 0 3px ${this.config.theme.primaryColor}20; }
      .dam-preview-content { display: flex; align-items: center; justify-content: center; padding: 20px; background: #111; min-height: 200px; }
      .dam-preview-info { padding: 12px 20px; background: #222; color: #ccc; font-size: 13px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
      .dam-preview-actions { display: flex; gap: 8px; }
      .dam-preview-actions .dam-btn { font-size: 13px; padding: 6px 12px; }
      .dam-toast-container { position: fixed; top: 20px; right: 20px; z-index: 3000; display: flex; flex-direction: column; gap: 10px; }
      .dam-toast { background: ${this.config.theme.cardBackground}; border-radius: 8px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); padding: 12px 16px; display: flex; align-items: center; gap: 10px; animation: damToast 0.3s ease; }
      @keyframes damToast { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
      .dam-toast-icon svg { width: 20px; height: 20px; }
      .dam-toast-success .dam-toast-icon { color: ${this.config.theme.successColor}; }
      .dam-toast-error .dam-toast-icon { color: ${this.config.theme.errorColor}; }
      .dam-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px; }
      .dam-spinner { width: 40px; height: 40px; border: 3px solid ${this.config.theme.borderColor}; border-top-color: ${this.config.theme.primaryColor}; border-radius: 50%; animation: damSpin 0.8s linear infinite; margin-bottom: 16px; }
      @keyframes damSpin { to { transform: rotate(360deg); } }
      .dam-access-denied { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px; text-align: center; background: ${this.config.theme.cardBackground}; border-radius: ${this.config.theme.borderRadius}; min-height: 400px; }
      .dam-access-denied svg { width: 48px; height: 48px; color: ${this.config.theme.errorColor}; margin-bottom: 16px; }
      .dam-access-denied h2 { font-size: 20px; margin-bottom: 8px; }
      .dam-access-denied p { color: ${this.config.theme.secondaryColor}; max-width: 400px; }
      @media (max-width: 768px) {
        .dam-header { flex-direction: column; align-items: stretch; }
        .dam-toolbar { flex-direction: column; align-items: stretch; }
        .dam-search-input { width: 100%; }
        .dam-grid { grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); }
        .dam-list .dam-item { grid-template-columns: 40px 1fr; }
        .dam-list-header { display: none; }
        .dam-form-row { grid-template-columns: 1fr; }
      }
    `;
    document.head.appendChild(style);
  }

  // ============ Icons ============

  get icons() {
    return {
      folder: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>',
      folderOpen: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path><path d="M2 10h20"></path></svg>',
      folderPlus: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path><line x1="12" y1="11" x2="12" y2="17"></line><line x1="9" y1="14" x2="15" y2="14"></line></svg>',
      file: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>',
      image: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>',
      video: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>',
      pdf: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>',
      archive: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="22" height="5"></rect></svg>',
      plus: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>',
      search: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>',
      grid: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>',
      list: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>',
      edit: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>',
      trash: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>',
      move: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="5 9 2 12 5 15"></polyline><polyline points="9 5 12 2 15 5"></polyline><polyline points="15 19 12 22 9 19"></polyline><polyline points="19 9 22 12 19 15"></polyline><line x1="2" y1="12" x2="22" y2="12"></line><line x1="12" y1="2" x2="12" y2="22"></line></svg>',
      link: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>',
      eye: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>',
      download: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>',
      externalLink: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>',
      x: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',
      check: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>',
      home: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>',
      lock: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>'
    };
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ShopifyDAM;
} else if (typeof window !== 'undefined') {
  window.ShopifyDAM = ShopifyDAM;
}
