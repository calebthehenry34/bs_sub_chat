/**
 * Shopify DAM - Premium Digital Asset Manager
 *
 * Features:
 * - Direct file upload (drag & drop + file picker)
 * - Admin-only upload/delete permissions
 * - Affiliate read-only access
 * - High-end responsive UI
 *
 * @version 3.0.0
 */

class ShopifyDAM {
  constructor(config = {}) {
    this.config = {
      containerId: config.containerId || 'shopify-dam-container',
      userEmail: config.userEmail || '',
      userTags: (config.userTags || []).map(t => t.toLowerCase()),
      isAdmin: config.isAdmin || false,
      isDesignMode: config.isDesignMode || false,
      storageKey: config.storageKey || 'shopify_dam_data_v3',
      maxFileSize: config.maxFileSize || 50 * 1024 * 1024, // 50MB
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

    // Check if user is admin
    this.isAdmin = this.config.isAdmin || this.config.userTags.includes('admin');

    this.state = {
      currentPath: '/',
      selectedItems: new Set(),
      viewMode: localStorage.getItem('dam_view') || 'grid',
      sortBy: 'name',
      sortOrder: 'asc',
      searchQuery: '',
      isDragging: false
    };

    this.container = null;
    this.data = { folders: [], files: [] };
  }

  async init() {
    this.container = document.getElementById(this.config.containerId);
    if (!this.container) return console.error('DAM: Container not found');

    // Check access
    const hasAccess = this.config.userTags.includes('admin') || this.config.userTags.includes('affiliate');
    if (!hasAccess && !this.config.isDesignMode) {
      this.container.innerHTML = this.renderAccessDenied();
      return;
    }

    this.injectStyles();
    this.loadData();

    // Ensure root exists
    if (!this.data.folders.find(f => f.path === '/')) {
      this.data.folders.push({ id: this.uid(), name: 'Root', path: '/', parentPath: null, createdAt: Date.now() });
      this.saveData();
    }

    this.render();
    this.bindGlobalEvents();
  }

  // ═══════════════════════════════════════════════════════════
  // DATA
  // ═══════════════════════════════════════════════════════════

  loadData() {
    try {
      const d = localStorage.getItem(this.config.storageKey);
      if (d) this.data = JSON.parse(d);
    } catch (e) {
      this.data = { folders: [], files: [] };
    }
  }

  saveData() {
    try {
      localStorage.setItem(this.config.storageKey, JSON.stringify(this.data));
    } catch (e) {
      this.toast('Storage full - please delete some files', 'error');
    }
  }

  uid() {
    return 'f' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  normalizePath(p) {
    let n = (p || '/').replace(/\/+/g, '/');
    if (!n.startsWith('/')) n = '/' + n;
    if (n !== '/' && !n.endsWith('/')) n += '/';
    return n;
  }

  getCurrentItems() {
    const path = this.normalizePath(this.state.currentPath);
    let folders = this.data.folders.filter(f => f.parentPath === path);
    let files = this.data.files.filter(f => f.folderPath === path);

    if (this.state.searchQuery) {
      const q = this.state.searchQuery.toLowerCase();
      folders = folders.filter(f => f.name.toLowerCase().includes(q));
      files = files.filter(f => f.name.toLowerCase().includes(q));
    }

    const sort = (a, b) => {
      let c = 0;
      if (this.state.sortBy === 'name') c = a.name.localeCompare(b.name);
      else if (this.state.sortBy === 'date') c = (a.createdAt || 0) - (b.createdAt || 0);
      else if (this.state.sortBy === 'size') c = (a.size || 0) - (b.size || 0);
      return this.state.sortOrder === 'asc' ? c : -c;
    };

    return { folders: folders.sort(sort), files: files.sort(sort) };
  }

  // ═══════════════════════════════════════════════════════════
  // CRUD OPERATIONS
  // ═══════════════════════════════════════════════════════════

  createFolder(name) {
    const parentPath = this.normalizePath(this.state.currentPath);
    const path = parentPath + name + '/';

    if (this.data.folders.find(f => f.path === path)) {
      this.toast('Folder already exists', 'error');
      return false;
    }

    this.data.folders.push({
      id: this.uid(),
      name,
      path,
      parentPath,
      createdAt: Date.now()
    });

    this.saveData();
    this.toast('Folder created');
    this.render();
    return true;
  }

  async uploadFiles(fileList) {
    if (!this.isAdmin) {
      this.toast('Only admins can upload files', 'error');
      return;
    }

    const files = Array.from(fileList);
    const folderPath = this.normalizePath(this.state.currentPath);
    let uploaded = 0;

    for (const file of files) {
      if (file.size > this.config.maxFileSize) {
        this.toast(`${file.name} is too large (max 50MB)`, 'error');
        continue;
      }

      try {
        const dataUrl = await this.readFileAsDataURL(file);

        let name = file.name;
        let counter = 1;
        while (this.data.files.find(f => f.folderPath === folderPath && f.name === name)) {
          const ext = file.name.includes('.') ? '.' + file.name.split('.').pop() : '';
          const base = file.name.replace(ext, '');
          name = `${base} (${counter})${ext}`;
          counter++;
        }

        this.data.files.push({
          id: this.uid(),
          name,
          url: dataUrl,
          type: file.type || this.guessType(file.name),
          size: file.size,
          folderPath,
          createdAt: Date.now()
        });
        uploaded++;
      } catch (e) {
        this.toast(`Failed to upload ${file.name}`, 'error');
      }
    }

    if (uploaded > 0) {
      this.saveData();
      this.toast(`${uploaded} file${uploaded > 1 ? 's' : ''} uploaded`);
      this.render();
    }
  }

  readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  guessType(name) {
    const ext = (name || '').split('.').pop().toLowerCase();
    const map = {
      jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
      webp: 'image/webp', svg: 'image/svg+xml', mp4: 'video/mp4', webm: 'video/webm',
      mov: 'video/quicktime', pdf: 'application/pdf', zip: 'application/zip'
    };
    return map[ext] || 'application/octet-stream';
  }

  renameItem(id, newName, isFolder) {
    if (isFolder) {
      const folder = this.data.folders.find(f => f.id === id);
      if (!folder) return;

      const oldPath = folder.path;
      const newPath = folder.parentPath + newName + '/';

      if (this.data.folders.find(f => f.path === newPath && f.id !== id)) {
        this.toast('Name already exists', 'error');
        return;
      }

      folder.name = newName;
      folder.path = newPath;

      // Update children
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
      if (!file) return;

      if (this.data.files.find(f => f.folderPath === file.folderPath && f.name === newName && f.id !== id)) {
        this.toast('Name already exists', 'error');
        return;
      }
      file.name = newName;
    }

    this.saveData();
    this.toast('Renamed');
    this.render();
  }

  deleteSelected() {
    if (!this.isAdmin) {
      this.toast('Only admins can delete', 'error');
      return;
    }

    this.state.selectedItems.forEach(key => {
      const [type, id] = key.split(':');
      if (type === 'folder') {
        const folder = this.data.folders.find(f => f.id === id);
        if (folder && folder.path !== '/') {
          this.data.folders = this.data.folders.filter(f => !f.path.startsWith(folder.path));
          this.data.files = this.data.files.filter(f => !f.folderPath.startsWith(folder.path));
        }
      } else {
        this.data.files = this.data.files.filter(f => f.id !== id);
      }
    });

    const count = this.state.selectedItems.size;
    this.state.selectedItems.clear();
    this.saveData();
    this.toast(`${count} item${count > 1 ? 's' : ''} deleted`);
    this.render();
  }

  moveSelected(destPath) {
    const dest = this.normalizePath(destPath);

    this.state.selectedItems.forEach(key => {
      const [type, id] = key.split(':');
      if (type === 'folder') {
        const folder = this.data.folders.find(f => f.id === id);
        if (folder && !dest.startsWith(folder.path)) {
          const oldPath = folder.path;
          const newPath = dest + folder.name + '/';
          folder.parentPath = dest;
          folder.path = newPath;

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
        }
      } else {
        const file = this.data.files.find(f => f.id === id);
        if (file) file.folderPath = dest;
      }
    });

    this.state.selectedItems.clear();
    this.saveData();
    this.toast('Moved');
    this.render();
  }

  // ═══════════════════════════════════════════════════════════
  // NAVIGATION
  // ═══════════════════════════════════════════════════════════

  navigate(path) {
    this.state.currentPath = this.normalizePath(path);
    this.state.selectedItems.clear();
    this.state.searchQuery = '';
    this.render();
  }

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════

  render() {
    const { folders, files } = this.getCurrentItems();
    const hasItems = folders.length > 0 || files.length > 0;
    const hasSelection = this.state.selectedItems.size > 0;

    this.container.innerHTML = `
      <div class="dam ${this.state.isDragging ? 'dam--dragging' : ''}">
        ${this.renderHeader()}
        ${hasSelection ? this.renderSelectionBar() : ''}
        ${this.renderToolbar()}
        <div class="dam__body">
          ${hasItems ? this.renderItems(folders, files) : this.renderEmpty()}
        </div>
        ${this.isAdmin ? this.renderDropZone() : ''}
      </div>
    `;

    this.bindEvents();
  }

  renderHeader() {
    return `
      <header class="dam__header">
        <div class="dam__brand">
          <div class="dam__logo">${this.icons.layers}</div>
          <div class="dam__brand-text">
            <h1 class="dam__title">Asset Manager</h1>
            <span class="dam__badge ${this.isAdmin ? 'dam__badge--admin' : 'dam__badge--viewer'}">${this.isAdmin ? 'Admin' : 'Viewer'}</span>
          </div>
        </div>
        <div class="dam__search">
          <span class="dam__search-icon">${this.icons.search}</span>
          <input type="text" class="dam__search-input" placeholder="Search files and folders..." value="${this.esc(this.state.searchQuery)}" id="damSearch">
          ${this.state.searchQuery ? `<button class="dam__search-clear" id="damSearchClear">${this.icons.x}</button>` : ''}
        </div>
        <div class="dam__header-actions">
          ${this.isAdmin ? `<button class="dam__btn dam__btn--primary" id="damUploadBtn">${this.icons.upload}<span>Upload</span></button>` : ''}
        </div>
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
          <button class="dam__btn dam__btn--ghost" id="damMoveBtn">${this.icons.move}<span>Move</span></button>
          ${this.isAdmin ? `<button class="dam__btn dam__btn--danger" id="damDeleteBtn">${this.icons.trash}<span>Delete</span></button>` : ''}
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
          <button class="dam__btn dam__btn--secondary dam__btn--sm" id="damNewFolder">${this.icons.folderPlus}<span>New Folder</span></button>
          <div class="dam__view-toggle">
            <button class="dam__view-btn ${this.state.viewMode === 'grid' ? 'active' : ''}" data-view="grid" title="Grid view">${this.icons.grid}</button>
            <button class="dam__view-btn ${this.state.viewMode === 'list' ? 'active' : ''}" data-view="list" title="List view">${this.icons.list}</button>
          </div>
        </div>
      </div>
    `;
  }

  renderBreadcrumbs() {
    const parts = this.state.currentPath.split('/').filter(Boolean);
    let path = '/';

    let html = `<button class="dam__crumb ${parts.length === 0 ? 'dam__crumb--active' : ''}" data-path="/">${this.icons.home}<span>Home</span></button>`;

    parts.forEach((part, i) => {
      path += part + '/';
      const isLast = i === parts.length - 1;
      html += `<span class="dam__crumb-sep">${this.icons.chevronRight}</span>`;
      html += `<button class="dam__crumb ${isLast ? 'dam__crumb--active' : ''}" data-path="${this.esc(path)}">${this.esc(part)}</button>`;
    });

    return html;
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
          <div class="dam__list-col dam__list-col--size" data-sort="size">Size</div>
          <div class="dam__list-col dam__list-col--date" data-sort="date">Modified</div>
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
          <div class="dam__card-meta">${isFolder ? this.countChildren(item.path) + ' items' : this.formatSize(item.size)}</div>
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
          ${isFolder ? `<span class="dam__icon dam__icon--folder">${this.icons.folder}</span>` : `<span class="dam__icon">${this.getFileIcon(item.type)}</span>`}
        </div>
        <div class="dam__list-col dam__list-col--name">${this.esc(item.name)}</div>
        <div class="dam__list-col dam__list-col--size">${isFolder ? '—' : this.formatSize(item.size)}</div>
        <div class="dam__list-col dam__list-col--date">${this.formatDate(item.createdAt)}</div>
        <div class="dam__list-col dam__list-col--actions">
          <button class="dam__icon-btn" data-menu="${key}">${this.icons.moreH}</button>
        </div>
      </div>
    `;
  }

  renderPreviewThumb(file) {
    if (file.type?.startsWith('image/') && file.url) {
      return `<img class="dam__card-img" src="${file.url}" alt="" loading="lazy">`;
    }
    if (file.type?.startsWith('video/')) {
      return `<div class="dam__card-icon">${this.icons.video}</div>`;
    }
    return `<div class="dam__card-icon">${this.getFileIcon(file.type)}</div>`;
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
        <p class="dam__empty-text">${this.isAdmin ? 'Drop files here or click upload to get started' : 'No files have been added yet'}</p>
        ${this.isAdmin ? `
          <div class="dam__empty-actions">
            <button class="dam__btn dam__btn--secondary" id="damNewFolderEmpty">${this.icons.folderPlus} New Folder</button>
            <button class="dam__btn dam__btn--primary" id="damUploadEmpty">${this.icons.upload} Upload Files</button>
          </div>
        ` : ''}
      </div>
    `;
  }

  renderDropZone() {
    return `
      <div class="dam__dropzone" id="damDropzone">
        <div class="dam__dropzone-content">
          <div class="dam__dropzone-icon">${this.icons.upload}</div>
          <div class="dam__dropzone-text">Drop files to upload</div>
        </div>
      </div>
      <input type="file" id="damFileInput" multiple hidden>
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
      if (e.key === 'Delete' && this.state.selectedItems.size > 0 && this.isAdmin) {
        this.confirmDelete();
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
      }, 200));
    }
    document.getElementById('damSearchClear')?.addEventListener('click', () => {
      this.state.searchQuery = '';
      this.render();
    });

    // Upload buttons
    document.getElementById('damUploadBtn')?.addEventListener('click', () => this.triggerUpload());
    document.getElementById('damUploadEmpty')?.addEventListener('click', () => this.triggerUpload());

    // New folder
    document.getElementById('damNewFolder')?.addEventListener('click', () => this.showNewFolderModal());
    document.getElementById('damNewFolderEmpty')?.addEventListener('click', () => this.showNewFolderModal());

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
      btn.addEventListener('click', () => this.navigate(btn.dataset.path));
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
    document.getElementById('damMoveBtn')?.addEventListener('click', () => this.showMoveModal());
    document.getElementById('damDeleteBtn')?.addEventListener('click', () => this.confirmDelete());
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

    // File input
    const fileInput = document.getElementById('damFileInput');
    if (fileInput) {
      fileInput.addEventListener('change', e => {
        if (e.target.files.length) this.uploadFiles(e.target.files);
        e.target.value = '';
      });
    }

    // Drag and drop
    if (this.isAdmin) {
      const body = this.container.querySelector('.dam__body');
      if (body) {
        body.addEventListener('dragover', e => {
          e.preventDefault();
          this.state.isDragging = true;
          this.container.querySelector('.dam')?.classList.add('dam--dragging');
        });
        body.addEventListener('dragleave', e => {
          if (!body.contains(e.relatedTarget)) {
            this.state.isDragging = false;
            this.container.querySelector('.dam')?.classList.remove('dam--dragging');
          }
        });
        body.addEventListener('drop', e => {
          e.preventDefault();
          this.state.isDragging = false;
          this.container.querySelector('.dam')?.classList.remove('dam--dragging');
          if (e.dataTransfer.files.length) this.uploadFiles(e.dataTransfer.files);
        });
      }
    }
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
      const folder = this.data.folders.find(f => f.id === id);
      if (folder) this.navigate(folder.path);
    } else {
      const file = this.data.files.find(f => f.id === id);
      if (file) this.showPreview(file);
    }
  }

  triggerUpload() {
    document.getElementById('damFileInput')?.click();
  }

  selectAll() {
    const { folders, files } = this.getCurrentItems();
    folders.forEach(f => this.state.selectedItems.add(`folder:${f.id}`));
    files.forEach(f => this.state.selectedItems.add(`file:${f.id}`));
    this.render();
  }

  // ═══════════════════════════════════════════════════════════
  // MODALS
  // ═══════════════════════════════════════════════════════════

  showContextMenu(e, key) {
    document.querySelectorAll('.dam__context-menu').forEach(m => m.remove());

    const [type, id] = key.split(':');
    const isFolder = type === 'folder';
    const item = isFolder
      ? this.data.folders.find(f => f.id === id)
      : this.data.files.find(f => f.id === id);
    if (!item) return;

    const menu = document.createElement('div');
    menu.className = 'dam__context-menu';

    const actions = isFolder ? [
      { icon: 'folderOpen', label: 'Open', action: 'open' },
      { icon: 'edit', label: 'Rename', action: 'rename' },
      ...(this.isAdmin ? [{ icon: 'trash', label: 'Delete', action: 'delete', danger: true }] : [])
    ] : [
      { icon: 'eye', label: 'Preview', action: 'preview' },
      { icon: 'download', label: 'Download', action: 'download' },
      { icon: 'link', label: 'Copy URL', action: 'copy' },
      { icon: 'edit', label: 'Rename', action: 'rename' },
      ...(this.isAdmin ? [{ icon: 'trash', label: 'Delete', action: 'delete', danger: true }] : [])
    ];

    menu.innerHTML = actions.map(a => `
      <button class="dam__context-item ${a.danger ? 'dam__context-item--danger' : ''}" data-action="${a.action}">
        ${this.icons[a.icon]} ${a.label}
      </button>
    `).join('');

    document.body.appendChild(menu);

    // Position
    const rect = e.target.getBoundingClientRect();
    menu.style.top = `${rect.bottom + 4}px`;
    menu.style.left = `${rect.left}px`;

    // Adjust if off screen
    const menuRect = menu.getBoundingClientRect();
    if (menuRect.right > window.innerWidth) menu.style.left = `${window.innerWidth - menuRect.width - 8}px`;
    if (menuRect.bottom > window.innerHeight) menu.style.top = `${rect.top - menuRect.height - 4}px`;

    // Actions
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
        this.navigate(item.path);
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
      case 'rename':
        this.showRenameModal(item, isFolder);
        break;
      case 'delete':
        this.state.selectedItems.clear();
        this.state.selectedItems.add(`${isFolder ? 'folder' : 'file'}:${item.id}`);
        this.confirmDelete();
        break;
    }
  }

  downloadFile(file) {
    const a = document.createElement('a');
    a.href = file.url;
    a.download = file.name;
    a.click();
  }

  showNewFolderModal() {
    this.showModal({
      title: 'New Folder',
      content: `
        <div class="dam__form-group">
          <label class="dam__label">Folder name</label>
          <input type="text" class="dam__input" id="damFolderName" placeholder="My Folder" autofocus>
        </div>
      `,
      actions: [
        { label: 'Cancel', type: 'secondary', action: 'close' },
        { label: 'Create', type: 'primary', action: 'create' }
      ],
      onAction: (action) => {
        if (action === 'create') {
          const name = document.getElementById('damFolderName')?.value.trim();
          if (!name) {
            this.toast('Enter a folder name', 'error');
            return false;
          }
          return this.createFolder(name);
        }
        return true;
      }
    });
    setTimeout(() => document.getElementById('damFolderName')?.focus(), 100);
  }

  showRenameModal(item, isFolder) {
    this.showModal({
      title: `Rename ${isFolder ? 'Folder' : 'File'}`,
      content: `
        <div class="dam__form-group">
          <label class="dam__label">New name</label>
          <input type="text" class="dam__input" id="damRenameInput" value="${this.esc(item.name)}">
        </div>
      `,
      actions: [
        { label: 'Cancel', type: 'secondary', action: 'close' },
        { label: 'Rename', type: 'primary', action: 'rename' }
      ],
      onAction: (action) => {
        if (action === 'rename') {
          const name = document.getElementById('damRenameInput')?.value.trim();
          if (!name) {
            this.toast('Enter a name', 'error');
            return false;
          }
          this.renameItem(item.id, name, isFolder);
        }
        return true;
      }
    });
    setTimeout(() => {
      const input = document.getElementById('damRenameInput');
      if (input) {
        input.focus();
        const dot = item.name.lastIndexOf('.');
        input.setSelectionRange(0, dot > 0 && !isFolder ? dot : item.name.length);
      }
    }, 100);
  }

  showMoveModal() {
    const folders = this.data.folders.filter(f => f.path !== '/');
    this.showModal({
      title: 'Move Items',
      content: `
        <div class="dam__form-group">
          <label class="dam__label">Destination</label>
          <select class="dam__input" id="damMoveDest">
            <option value="/">/ (Root)</option>
            ${folders.map(f => `<option value="${this.esc(f.path)}">${this.esc(f.path)}</option>`).join('')}
          </select>
        </div>
      `,
      actions: [
        { label: 'Cancel', type: 'secondary', action: 'close' },
        { label: 'Move', type: 'primary', action: 'move' }
      ],
      onAction: (action) => {
        if (action === 'move') {
          const dest = document.getElementById('damMoveDest')?.value;
          this.moveSelected(dest);
        }
        return true;
      }
    });
  }

  confirmDelete() {
    const count = this.state.selectedItems.size;
    this.showModal({
      title: 'Delete Items',
      content: `
        <p>Are you sure you want to delete ${count} item${count > 1 ? 's' : ''}?</p>
        <p class="dam__modal-warning">This action cannot be undone.</p>
      `,
      actions: [
        { label: 'Cancel', type: 'secondary', action: 'close' },
        { label: 'Delete', type: 'danger', action: 'delete' }
      ],
      onAction: (action) => {
        if (action === 'delete') this.deleteSelected();
        return true;
      }
    });
  }

  showPreview(file) {
    let content = '';

    if (file.type?.startsWith('image/')) {
      content = `<img src="${file.url}" alt="${this.esc(file.name)}" class="dam__preview-img">`;
    } else if (file.type?.startsWith('video/')) {
      content = `<video src="${file.url}" controls autoplay class="dam__preview-video"></video>`;
    } else if (file.type === 'application/pdf') {
      content = `<iframe src="${file.url}" class="dam__preview-pdf"></iframe>`;
    } else {
      content = `
        <div class="dam__preview-fallback">
          ${this.getFileIcon(file.type)}
          <p>Preview not available</p>
        </div>
      `;
    }

    this.showModal({
      title: file.name,
      content: `
        <div class="dam__preview">${content}</div>
        <div class="dam__preview-bar">
          <span>${this.formatSize(file.size)}</span>
          <div class="dam__preview-actions">
            <button class="dam__btn dam__btn--secondary dam__btn--sm" id="damPreviewDownload">${this.icons.download} Download</button>
          </div>
        </div>
      `,
      actions: [],
      large: true,
      onMount: () => {
        document.getElementById('damPreviewDownload')?.addEventListener('click', () => this.downloadFile(file));
      }
    });
  }

  showModal({ title, content, actions, onAction, large, onMount }) {
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

    // Enter to submit
    modal.querySelector('input')?.addEventListener('keydown', async e => {
      if (e.key === 'Enter' && onAction) {
        const primary = actions.find(a => a.type === 'primary' || a.type === 'danger');
        if (primary) {
          const shouldClose = await onAction(primary.action);
          if (shouldClose) this.closeAllModals();
        }
      }
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

  countChildren(path) {
    return this.data.folders.filter(f => f.parentPath === path).length +
           this.data.files.filter(f => f.folderPath === path).length;
  }

  formatSize(bytes) {
    if (!bytes) return '—';
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    while (bytes >= 1024 && i < units.length - 1) { bytes /= 1024; i++; }
    return `${bytes.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
  }

  formatDate(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    const now = new Date();
    const diff = now - d;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;

    return d.toLocaleDateString();
  }

  getFileIcon(type) {
    if (!type) return this.icons.file;
    if (type.startsWith('image/')) return this.icons.image;
    if (type.startsWith('video/')) return this.icons.video;
    if (type === 'application/pdf') return this.icons.fileText;
    if (type.includes('zip') || type.includes('rar')) return this.icons.archive;
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
      layers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>',
      folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
      folderOpen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><path d="M2 10h20"/></svg>',
      folderPlus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>',
      file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
      fileText: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>',
      image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
      video: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>',
      archive: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>',
      upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
      download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
      search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
      grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
      list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
      home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
      chevronRight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>',
      moreV: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>',
      moreH: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>',
      edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
      trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
      move: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="5 9 2 12 5 15"/><polyline points="9 5 12 2 15 5"/><polyline points="15 19 12 22 9 19"/><polyline points="19 9 22 12 19 15"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/></svg>',
      link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
      eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
      x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
      check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
      alertCircle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
      lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>'
    };
  }

  // ═══════════════════════════════════════════════════════════
  // STYLES
  // ═══════════════════════════════════════════════════════════

  injectStyles() {
    if (document.getElementById('dam-styles-v3')) return;
    const t = this.config.theme;
    const style = document.createElement('style');
    style.id = 'dam-styles-v3';
    style.textContent = `
/* ═══════════════════════════════════════════════════════════════════
   SHOPIFY DAM - Premium Styles
   ═══════════════════════════════════════════════════════════════════ */

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

  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  color: var(--text);
  background: var(--bg);
  min-height: 600px;
  border-radius: var(--radius);
  overflow: hidden;
  position: relative;
}

.dam *, .dam *::before, .dam *::after { box-sizing: border-box; }
.dam svg { width: 20px; height: 20px; flex-shrink: 0; }

/* ─── Header ─────────────────────────────────────────────────────── */

.dam__header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 24px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
}

.dam__brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.dam__logo {
  width: 40px;
  height: 40px;
  background: var(--primary);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

.dam__logo svg { width: 22px; height: 22px; }

.dam__brand-text { display: flex; flex-direction: column; gap: 2px; }
.dam__title { font-size: 18px; font-weight: 700; margin: 0; letter-spacing: -0.3px; }

.dam__badge {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 2px 6px;
  border-radius: 4px;
  width: fit-content;
}

.dam__badge--admin { background: var(--primary); color: white; }
.dam__badge--viewer { background: var(--bg); color: var(--text-secondary); }

.dam__search {
  flex: 1;
  max-width: 400px;
  position: relative;
}

.dam__search-icon {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
}

.dam__search-icon svg { width: 18px; height: 18px; }

.dam__search-input {
  width: 100%;
  padding: 10px 14px 10px 44px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  font-size: 14px;
  background: #ffffff;
  color: var(--text);
  transition: all 0.2s;
}

.dam__search-input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(120, 171, 230, 0.2);
  background: #ffffff;
}

.dam__search-input::placeholder { color: var(--text-muted); }

.dam__search-clear {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
}

.dam__search-clear:hover { color: var(--text); background: var(--bg); }

.dam__header-actions { display: flex; gap: 10px; margin-left: auto; }

/* ─── Buttons ────────────────────────────────────────────────────── */

.dam__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 18px;
  font-size: 14px;
  font-weight: 600;
  border-radius: var(--radius-sm);
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.dam__btn svg { width: 18px; height: 18px; }

.dam__btn--primary {
  background: var(--primary);
  color: white;
  box-shadow: 0 2px 8px rgba(120, 171, 230, 0.4);
}

.dam__btn--primary:hover {
  background: #5a95db;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(120, 171, 230, 0.5);
}

.dam__btn--secondary {
  background: #ffffff;
  color: var(--text);
  border: 1px solid var(--border);
}

.dam__btn--secondary:hover { background: #f3f4f6; border-color: var(--text-muted); }

.dam__btn--ghost {
  background: transparent;
  color: var(--text);
}

.dam__btn--ghost:hover { background: #f3f4f6; color: var(--text); }

.dam__btn--danger {
  background: var(--danger);
  color: white;
}

.dam__btn--danger:hover { background: #e6354f; }

.dam__btn--sm { padding: 8px 14px; font-size: 13px; }
.dam__btn--sm svg { width: 16px; height: 16px; }

.dam__icon-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  border-radius: var(--radius-xs);
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s;
}

.dam__icon-btn:hover { background: var(--bg); color: var(--text); }

/* ─── Selection Bar ──────────────────────────────────────────────── */

.dam__selection-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  background: var(--primary);
  color: white;
  border-radius: var(--radius);
  margin: 0 16px;
}

.dam__selection-info { display: flex; align-items: center; gap: 8px; font-weight: 500; }

.dam__selection-count {
  background: rgba(255,255,255,0.2);
  padding: 2px 10px;
  border-radius: 20px;
  font-weight: 700;
}

.dam__selection-actions { display: flex; gap: 8px; }
.dam__selection-actions .dam__btn--ghost { color: rgba(255,255,255,0.9); }
.dam__selection-actions .dam__btn--ghost:hover { background: rgba(255,255,255,0.15); color: white; }
.dam__selection-actions .dam__btn--danger { background: rgba(255,255,255,0.2); }
.dam__selection-actions .dam__btn--danger:hover { background: rgba(255,255,255,0.3); }

/* ─── Toolbar ────────────────────────────────────────────────────── */

.dam__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 24px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
}

.dam__breadcrumbs {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.dam__crumb {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  background: none;
  border: none;
  border-radius: var(--radius-xs);
  cursor: pointer;
  transition: all 0.15s;
}

.dam__crumb svg { width: 16px; height: 16px; }
.dam__crumb:hover { background: var(--bg); color: var(--primary); }
.dam__crumb--active { color: var(--text); font-weight: 600; cursor: default; }
.dam__crumb--active:hover { background: transparent; color: var(--text); }

.dam__crumb-sep { color: var(--text-muted); }
.dam__crumb-sep svg { width: 14px; height: 14px; }

.dam__toolbar-actions { display: flex; align-items: center; gap: 12px; }

.dam__view-toggle {
  display: flex;
  background: var(--bg);
  border-radius: var(--radius-xs);
  padding: 3px;
}

.dam__view-btn {
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  border-radius: var(--radius-xs);
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s;
}

.dam__view-btn:hover { color: var(--text); }
.dam__view-btn.active { background: var(--surface); color: var(--primary); box-shadow: 0 1px 3px var(--shadow); }
.dam__view-btn svg { width: 18px; height: 18px; }

/* ─── Body ───────────────────────────────────────────────────────── */

.dam__body {
  padding: 24px;
  min-height: 400px;
}

/* ─── Grid View ──────────────────────────────────────────────────── */

.dam__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 20px;
}

.dam__card {
  position: relative;
  background: #ffffff;
  border-radius: 14px;
  border: 2px solid transparent;
  cursor: pointer;
  transition: all 0.2s;
  overflow: hidden;
}

.dam__card:hover {
  border-color: var(--border);
  box-shadow: 0 8px 24px var(--shadow);
  transform: translateY(-2px);
}

.dam__card--selected {
  border-color: var(--primary);
  background: rgba(0, 102, 255, 0.04);
}

.dam__card-check {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 2;
  opacity: 0;
  transition: opacity 0.15s;
}

.dam__card:hover .dam__card-check,
.dam__card--selected .dam__card-check { opacity: 1; }

.dam__checkbox {
  width: 22px;
  height: 22px;
  border: 2px solid #d1d5db;
  border-radius: 6px;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.dam__checkbox svg { width: 14px; height: 14px; }

.dam__checkbox--checked {
  background: var(--primary);
  border-color: var(--primary);
  color: white;
}

.dam__card-preview {
  height: 140px;
  background: var(--bg);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.dam__card-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s;
}

.dam__card:hover .dam__card-img { transform: scale(1.05); }

.dam__card-icon { color: var(--text-muted); }
.dam__card-icon svg { width: 48px; height: 48px; }
.dam__card-icon--folder { color: var(--primary); }

.dam__card-info { padding: 14px 16px; }

.dam__card-name {
  font-weight: 600;
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 4px;
}

.dam__card-meta {
  font-size: 12px;
  color: var(--text-muted);
}

.dam__card-menu {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #ffffff;
  border: none;
  border-radius: 8px;
  color: var(--text-muted);
  cursor: pointer;
  opacity: 0;
  transition: all 0.15s;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.dam__card:hover .dam__card-menu { opacity: 1; }
.dam__card-menu:hover { color: var(--text); background: #f3f4f6; }
.dam__card-menu svg { width: 16px; height: 16px; }

/* ─── List View ──────────────────────────────────────────────────── */

.dam__list { display: flex; flex-direction: column; }

.dam__list-header {
  display: grid;
  grid-template-columns: 40px 44px 1fr 100px 120px 48px;
  gap: 12px;
  align-items: center;
  padding: 10px 16px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-muted);
  border-bottom: 1px solid var(--border);
}

.dam__list-header [data-sort] { cursor: pointer; }
.dam__list-header [data-sort]:hover { color: var(--text); }

.dam__list-row {
  display: grid;
  grid-template-columns: 40px 44px 1fr 100px 120px 48px;
  gap: 12px;
  align-items: center;
  padding: 12px 16px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.15s;
}

.dam__list-row:hover { background: var(--bg); }
.dam__list-row--selected { background: rgba(0, 102, 255, 0.06); }

.dam__list-col--icon { display: flex; justify-content: center; }
.dam__icon { color: var(--text-muted); display: flex; }
.dam__icon svg { width: 22px; height: 22px; }
.dam__icon--folder { color: var(--primary); }

.dam__list-col--name { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dam__list-col--size, .dam__list-col--date { font-size: 13px; color: var(--text-secondary); }
.dam__list-col--actions { display: flex; justify-content: flex-end; }

/* ─── Empty State ────────────────────────────────────────────────── */

.dam__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 80px 24px;
}

.dam__empty-icon {
  width: 80px;
  height: 80px;
  background: var(--bg);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  margin-bottom: 24px;
}

.dam__empty-icon svg { width: 36px; height: 36px; }
.dam__empty-title { font-size: 20px; font-weight: 700; margin: 0 0 8px; }
.dam__empty-text { color: var(--text-secondary); margin: 0 0 24px; max-width: 300px; }
.dam__empty-actions { display: flex; gap: 12px; }

/* ─── Dropzone ───────────────────────────────────────────────────── */

.dam__dropzone {
  position: absolute;
  inset: 0;
  background: rgba(0, 102, 255, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s;
}

.dam--dragging .dam__dropzone { opacity: 1; pointer-events: auto; }

.dam__dropzone-content { text-align: center; color: white; }
.dam__dropzone-icon { margin-bottom: 16px; }
.dam__dropzone-icon svg { width: 64px; height: 64px; }
.dam__dropzone-text { font-size: 20px; font-weight: 600; }

/* ─── Context Menu ───────────────────────────────────────────────── */

.dam__context-menu {
  position: fixed;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  box-shadow: 0 12px 40px rgba(0,0,0,0.15);
  min-width: 180px;
  padding: 6px;
  z-index: 1000;
  animation: damContextIn 0.15s ease;
}

@keyframes damContextIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

.dam__context-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 14px;
  font-size: 14px;
  background: none;
  border: none;
  border-radius: var(--radius-xs);
  color: var(--text);
  cursor: pointer;
  transition: all 0.1s;
  text-align: left;
}

.dam__context-item:hover { background: #f3f4f6; }
.dam__context-item svg { width: 18px; height: 18px; color: var(--text-secondary); }
.dam__context-item--danger { color: var(--danger); }
.dam__context-item--danger:hover { background: rgba(255, 59, 92, 0.08); }
.dam__context-item--danger svg { color: var(--danger); }

/* ─── Modal ──────────────────────────────────────────────────────── */

.dam__modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 24px;
  animation: damFadeIn 0.2s ease;
}

@keyframes damFadeIn { from { opacity: 0; } to { opacity: 1; } }

.dam__modal {
  background: #ffffff;
  border-radius: 16px;
  max-width: 480px;
  width: 100%;
  max-height: 90vh;
  overflow: auto;
  animation: damSlideUp 0.25s ease;
  box-shadow: 0 24px 80px rgba(0,0,0,0.25);
}

@keyframes damSlideUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

.dam__modal--large { max-width: 900px; }

.dam__modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid #e5e7eb;
  background: #ffffff;
  border-radius: 16px 16px 0 0;
}

.dam__modal-header h3 {
  font-size: 18px;
  font-weight: 700;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dam__modal-close {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s;
}

.dam__modal-close:hover { background: #f3f4f6; color: var(--text); }

.dam__modal-body { padding: 24px; background: #ffffff; }
.dam__modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid #e5e7eb;
  background: #f9fafb;
  border-radius: 0 0 16px 16px;
}

.dam__modal-warning { color: var(--danger); font-size: 13px; margin-top: 12px; }

.dam__form-group { margin-bottom: 20px; }
.dam__form-group:last-child { margin-bottom: 0; }
.dam__label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 8px; color: var(--text-secondary); }

.dam__input {
  width: 100%;
  padding: 12px 16px;
  font-size: 14px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #ffffff;
  color: var(--text);
  transition: all 0.2s;
}

.dam__input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(120, 171, 230, 0.2);
}

/* ─── Preview ────────────────────────────────────────────────────── */

.dam__preview {
  background: #0a0a0a;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.dam__preview-img { max-width: 100%; max-height: 60vh; object-fit: contain; }
.dam__preview-video { max-width: 100%; max-height: 60vh; }
.dam__preview-pdf { width: 100%; height: 60vh; border: none; }

.dam__preview-fallback {
  text-align: center;
  color: #666;
  padding: 60px;
}

.dam__preview-fallback svg { width: 64px; height: 64px; margin-bottom: 16px; }

.dam__preview-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: #1a1a1a;
  color: #999;
  font-size: 13px;
  margin-top: 16px;
  border-radius: var(--radius-sm);
}

.dam__preview-actions { display: flex; gap: 8px; }

/* ─── Toasts ─────────────────────────────────────────────────────── */

.dam__toasts {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 3000;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.dam__toast {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 20px;
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 12px 40px rgba(0,0,0,0.2);
  animation: damToastIn 0.3s ease;
  font-weight: 500;
}

@keyframes damToastIn {
  from { opacity: 0; transform: translateX(20px); }
  to { opacity: 1; transform: translateX(0); }
}

.dam__toast--exit {
  animation: damToastOut 0.3s ease forwards;
}

@keyframes damToastOut {
  to { opacity: 0; transform: translateX(20px); }
}

.dam__toast-icon { display: flex; }
.dam__toast--success .dam__toast-icon { color: var(--accent); }
.dam__toast--error .dam__toast-icon { color: var(--danger); }

/* ─── Access Denied ──────────────────────────────────────────────── */

.dam--denied { display: flex; align-items: center; justify-content: center; min-height: 500px; }

.dam__denied {
  text-align: center;
  padding: 60px;
}

.dam__denied-icon {
  width: 80px;
  height: 80px;
  background: rgba(255, 59, 92, 0.1);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--danger);
  margin: 0 auto 24px;
}

.dam__denied-icon svg { width: 36px; height: 36px; }
.dam__denied h2 { font-size: 24px; margin: 0 0 12px; }
.dam__denied p { color: var(--text-secondary); margin: 0; }

/* ─── Responsive ─────────────────────────────────────────────────── */

@media (max-width: 768px) {
  .dam__header {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
    padding: 16px;
  }

  .dam__brand { justify-content: center; }
  .dam__search { max-width: none; }
  .dam__header-actions { justify-content: center; }

  .dam__toolbar {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
    padding: 12px 16px;
  }

  .dam__toolbar-actions { justify-content: space-between; }

  .dam__body { padding: 16px; }

  .dam__grid {
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 12px;
  }

  .dam__card-preview { height: 100px; }
  .dam__card-icon svg { width: 36px; height: 36px; }
  .dam__card-info { padding: 10px 12px; }
  .dam__card-name { font-size: 13px; }

  .dam__list-header { display: none; }

  .dam__list-row {
    grid-template-columns: 40px 40px 1fr 40px;
    padding: 10px 12px;
  }

  .dam__list-col--size,
  .dam__list-col--date { display: none; }

  .dam__selection-bar {
    flex-direction: column;
    gap: 12px;
    padding: 12px 16px;
  }

  .dam__btn span { display: none; }
  .dam__btn--primary span,
  .dam__toolbar-actions .dam__btn span { display: inline; }

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
  module.exports = ShopifyDAM;
} else if (typeof window !== 'undefined') {
  window.ShopifyDAM = ShopifyDAM;
}
