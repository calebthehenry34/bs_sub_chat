/**
 * DAM Hub - Marketing Resources
 * Dropbox/Google Drive-style file manager
 * Pure Shopify solution - no external services
 *
 * @version 6.0.0
 */

class DAMHub {
  constructor(config = {}) {
    this.config = {
      containerId: config.containerId || 'dam-hub-container',
      userTags: (config.userTags || []).map(t => t.toLowerCase()),
      isAdmin: config.isAdmin || false,
      isDesignMode: config.isDesignMode || false,
      folders: config.folders || [],
      files: config.files || []
    };

    this.isAdmin = this.config.isAdmin || this.config.userTags.includes('admin');

    this.state = {
      currentFolderId: 'root',
      selectedItems: new Set(),
      viewMode: localStorage.getItem('dam_view') || 'list',
      sortBy: 'name',
      sortOrder: 'asc',
      searchQuery: '',
      breadcrumbs: [{ id: 'root', name: 'All files' }],
      lastSelectedIndex: -1
    };

    this.container = null;
    this.allItems = [];
    this.processData();
  }

  processData() {
    this.folderMap = { root: { id: 'root', name: 'All files', parentId: null } };

    for (const folder of this.config.folders) {
      if (folder.id && folder.name) {
        this.folderMap[folder.id] = {
          id: folder.id,
          name: folder.name,
          parentId: folder.parent_id || 'root',
          color: folder.color || '#5F6368'
        };
      }
    }

    this.files = [];
    for (const file of this.config.files) {
      if (file.url && file.name) {
        this.files.push({
          id: file.id || this.generateId(),
          name: file.name,
          url: file.url,
          folderId: file.folder_id || 'root',
          mimeType: this.guessMimeType(file.url, file.name),
          description: file.description || ''
        });
      }
    }
  }

  generateId() {
    return 'f_' + Math.random().toString(36).substr(2, 9);
  }

  guessMimeType(url, name) {
    const ext = (name || url).split('.').pop().toLowerCase();
    const types = {
      jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
      webp: 'image/webp', svg: 'image/svg+xml', mp4: 'video/mp4', webm: 'video/webm',
      mov: 'video/quicktime', pdf: 'application/pdf', doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      zip: 'application/zip', txt: 'text/plain', csv: 'text/csv', ai: 'application/illustrator',
      psd: 'image/vnd.adobe.photoshop', eps: 'application/postscript'
    };
    return types[ext] || 'application/octet-stream';
  }

  getFoldersInFolder(folderId) {
    return Object.values(this.folderMap).filter(f => f.parentId === folderId && f.id !== 'root');
  }

  getFilesInFolder(folderId) {
    let files = this.files.filter(f => f.folderId === folderId);
    if (this.state.searchQuery) {
      const q = this.state.searchQuery.toLowerCase();
      files = files.filter(f => f.name.toLowerCase().includes(q));
    }
    return this.sortItems(files);
  }

  sortItems(items) {
    return items.sort((a, b) => {
      const aVal = a[this.state.sortBy] || a.name;
      const bVal = b[this.state.sortBy] || b.name;
      const cmp = String(aVal).localeCompare(String(bVal));
      return this.state.sortOrder === 'asc' ? cmp : -cmp;
    });
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
    return crumbs.length ? crumbs : [{ id: 'root', name: 'All files' }];
  }

  async init() {
    this.container = document.getElementById(this.config.containerId);
    if (!this.container) return console.error('DAM: Container not found');

    const hasAccess = this.config.userTags.includes('admin') || this.config.userTags.includes('affiliate');
    if (!hasAccess && !this.config.isDesignMode) {
      this.container.innerHTML = this.renderAccessDenied();
      this.injectStyles();
      return;
    }

    this.injectStyles();
    this.loadFolder('root');
    this.bindGlobalEvents();
  }

  loadFolder(folderId) {
    this.state.currentFolderId = folderId;
    this.state.selectedItems.clear();
    this.state.lastSelectedIndex = -1;
    this.state.breadcrumbs = this.getBreadcrumbs(folderId);
    this.render();
  }

  render() {
    const folders = this.getFoldersInFolder(this.state.currentFolderId);
    const files = this.getFilesInFolder(this.state.currentFolderId);
    this.allItems = [...folders.map(f => ({ ...f, isFolder: true })), ...files.map(f => ({ ...f, isFolder: false }))];
    const hasItems = this.allItems.length > 0;
    const selCount = this.state.selectedItems.size;

    this.container.innerHTML = `
      <div class="dh">
        <header class="dh-header">
          <div class="dh-header-left">
            <h1 class="dh-title">Marketing Resources</h1>
          </div>
          <div class="dh-header-center">
            <div class="dh-search">
              <svg class="dh-search-icon" viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
              <input type="text" class="dh-search-input" placeholder="Search in files" value="${this.esc(this.state.searchQuery)}" id="dhSearch">
              ${this.state.searchQuery ? '<button class="dh-search-clear" id="dhSearchClear"><svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></button>' : ''}
            </div>
          </div>
          <div class="dh-header-right">
            ${this.isAdmin ? '<a href="/admin/themes/current/editor" target="_blank" class="dh-btn dh-btn-primary"><svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>Add files</a>' : ''}
          </div>
        </header>

        <div class="dh-toolbar">
          <nav class="dh-breadcrumbs">
            ${this.state.breadcrumbs.map((c, i) => `
              ${i > 0 ? '<svg class="dh-bc-sep" viewBox="0 0 24 24"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>' : ''}
              <button class="dh-bc-item ${i === this.state.breadcrumbs.length - 1 ? 'active' : ''}" data-folder="${c.id}">${this.esc(c.name)}</button>
            `).join('')}
          </nav>
          <div class="dh-toolbar-right">
            <div class="dh-view-toggle">
              <button class="dh-view-btn ${this.state.viewMode === 'list' ? 'active' : ''}" data-view="list" title="List">
                <svg viewBox="0 0 24 24"><path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/></svg>
              </button>
              <button class="dh-view-btn ${this.state.viewMode === 'grid' ? 'active' : ''}" data-view="grid" title="Grid">
                <svg viewBox="0 0 24 24"><path d="M3 3v8h8V3H3zm6 6H5V5h4v4zm-6 4v8h8v-8H3zm6 6H5v-4h4v4zm4-16v8h8V3h-8zm6 6h-4V5h4v4zm-6 4v8h8v-8h-8zm6 6h-4v-4h4v4z"/></svg>
              </button>
            </div>
          </div>
        </div>

        ${selCount > 0 ? `
          <div class="dh-selection-bar">
            <div class="dh-sel-left">
              <button class="dh-sel-close" id="dhClearSel"><svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></button>
              <span class="dh-sel-count">${selCount} selected</span>
            </div>
            <div class="dh-sel-actions">
              <button class="dh-sel-btn" id="dhDownloadSel"><svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>Download</button>
              <button class="dh-sel-btn" id="dhCopyUrls"><svg viewBox="0 0 24 24"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg>Copy links</button>
            </div>
          </div>
        ` : ''}

        <div class="dh-body">
          ${hasItems ? this.renderItems() : this.renderEmpty()}
        </div>
      </div>
    `;

    this.bindEvents();
  }

  renderItems() {
    if (this.state.viewMode === 'grid') {
      return `<div class="dh-grid">${this.allItems.map((item, i) => this.renderGridItem(item, i)).join('')}</div>`;
    }
    return `
      <table class="dh-table">
        <thead>
          <tr>
            <th class="dh-th-check"><div class="dh-check-wrap"><input type="checkbox" class="dh-check-all" id="dhCheckAll"></div></th>
            <th class="dh-th-name" data-sort="name">Name ${this.state.sortBy === 'name' ? (this.state.sortOrder === 'asc' ? '↑' : '↓') : ''}</th>
            <th class="dh-th-type">Type</th>
            <th class="dh-th-actions"></th>
          </tr>
        </thead>
        <tbody>
          ${this.allItems.map((item, i) => this.renderListRow(item, i)).join('')}
        </tbody>
      </table>
    `;
  }

  renderGridItem(item, index) {
    const key = `${item.isFolder ? 'folder' : 'file'}:${item.id}`;
    const selected = this.state.selectedItems.has(key);

    return `
      <div class="dh-card ${selected ? 'selected' : ''}" data-key="${key}" data-index="${index}">
        <div class="dh-card-select">
          <input type="checkbox" class="dh-checkbox" ${selected ? 'checked' : ''}>
        </div>
        <div class="dh-card-preview">
          ${item.isFolder ? this.renderFolderIcon(item.color) : this.renderFileThumb(item)}
        </div>
        <div class="dh-card-name" title="${this.esc(item.name)}">${this.esc(item.name)}</div>
        <div class="dh-card-actions">
          ${item.isFolder ? '' : `
            <button class="dh-card-btn" data-action="download" title="Download"><svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg></button>
            <button class="dh-card-btn" data-action="copy" title="Copy link"><svg viewBox="0 0 24 24"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg></button>
          `}
        </div>
      </div>
    `;
  }

  renderListRow(item, index) {
    const key = `${item.isFolder ? 'folder' : 'file'}:${item.id}`;
    const selected = this.state.selectedItems.has(key);

    return `
      <tr class="dh-row ${selected ? 'selected' : ''}" data-key="${key}" data-index="${index}">
        <td class="dh-td-check"><div class="dh-check-wrap"><input type="checkbox" class="dh-checkbox" ${selected ? 'checked' : ''}></div></td>
        <td class="dh-td-name">
          <div class="dh-name-cell">
            <div class="dh-file-icon">${item.isFolder ? this.renderFolderIcon(item.color, true) : this.getFileIcon(item.mimeType)}</div>
            <span class="dh-file-name">${this.esc(item.name)}</span>
          </div>
        </td>
        <td class="dh-td-type">${item.isFolder ? 'Folder' : this.getFileTypeLabel(item.mimeType)}</td>
        <td class="dh-td-actions">
          <div class="dh-row-actions">
            ${item.isFolder ? '' : `
              <button class="dh-row-btn" data-action="download" title="Download"><svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg></button>
              <button class="dh-row-btn" data-action="copy" title="Copy link"><svg viewBox="0 0 24 24"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg></button>
              <button class="dh-row-btn" data-action="preview" title="Preview"><svg viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg></button>
            `}
          </div>
        </td>
      </tr>
    `;
  }

  renderFolderIcon(color = '#5F6368', small = false) {
    const size = small ? '24' : '48';
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>`;
  }

  renderFileThumb(file) {
    if (file.mimeType?.startsWith('image/')) {
      return `<img class="dh-thumb" src="${file.url}" alt="" loading="lazy">`;
    }
    return `<div class="dh-file-icon-lg">${this.getFileIcon(file.mimeType, true)}</div>`;
  }

  getFileIcon(mimeType, large = false) {
    const size = large ? '48' : '24';
    let color = '#5F6368';
    let path = 'M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6z';

    if (mimeType?.startsWith('image/')) {
      color = '#EA4335';
      path = 'M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z';
    } else if (mimeType?.startsWith('video/')) {
      color = '#EA4335';
      path = 'M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z';
    } else if (mimeType === 'application/pdf') {
      color = '#EA4335';
      path = 'M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5V11H19v2h-1.5V7h3v1.5zM9 9.5h1v-1H9v1zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm10 5.5h1v-3h-1v3z';
    } else if (mimeType?.includes('word') || mimeType?.includes('document')) {
      color = '#4285F4';
      path = 'M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z';
    } else if (mimeType?.includes('excel') || mimeType?.includes('spreadsheet')) {
      color = '#34A853';
      path = 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z';
    } else if (mimeType?.includes('presentation') || mimeType?.includes('powerpoint')) {
      color = '#FBBC04';
      path = 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z';
    } else if (mimeType?.includes('zip') || mimeType?.includes('rar') || mimeType?.includes('tar')) {
      color = '#5F6368';
      path = 'M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-2 6h-2v2h2v2h-2v2h-2v-2h2v-2h-2v-2h2v-2h-2V8h2v2h2v2z';
    }

    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}"><path d="${path}"/></svg>`;
  }

  getFileTypeLabel(mimeType) {
    if (!mimeType) return 'File';
    if (mimeType.startsWith('image/')) return 'Image';
    if (mimeType.startsWith('video/')) return 'Video';
    if (mimeType === 'application/pdf') return 'PDF';
    if (mimeType.includes('word') || mimeType.includes('document')) return 'Document';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'Spreadsheet';
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'Presentation';
    if (mimeType.includes('zip') || mimeType.includes('rar')) return 'Archive';
    if (mimeType.includes('illustrator') || mimeType.includes('eps')) return 'Vector';
    if (mimeType.includes('photoshop')) return 'Photoshop';
    return 'File';
  }

  renderEmpty() {
    if (this.state.searchQuery) {
      return `
        <div class="dh-empty">
          <svg viewBox="0 0 24 24" width="80" height="80" fill="#dadce0"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
          <h3>No results found</h3>
          <p>Try different keywords or check your spelling</p>
        </div>
      `;
    }
    return `
      <div class="dh-empty">
        <svg viewBox="0 0 24 24" width="80" height="80" fill="#dadce0"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
        <h3>This folder is empty</h3>
        <p>${this.isAdmin ? 'Add files through the Theme Customizer' : 'No files have been added yet'}</p>
        ${this.isAdmin ? '<a href="/admin/themes/current/editor" target="_blank" class="dh-btn dh-btn-primary" style="margin-top:16px"><svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>Add files</a>' : ''}
      </div>
    `;
  }

  renderAccessDenied() {
    return `
      <div class="dh">
        <div class="dh-denied">
          <svg viewBox="0 0 24 24" width="64" height="64" fill="#5f6368"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
          <h2>Access Restricted</h2>
          <p>This area is only available to administrators and affiliates.</p>
        </div>
      </div>
    `;
  }

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
  }

  bindEvents() {
    const search = document.getElementById('dhSearch');
    if (search) {
      search.addEventListener('input', this.debounce(e => {
        this.state.searchQuery = e.target.value;
        this.render();
      }, 200));
    }
    document.getElementById('dhSearchClear')?.addEventListener('click', () => {
      this.state.searchQuery = '';
      this.render();
    });

    this.container.querySelectorAll('.dh-view-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.state.viewMode = btn.dataset.view;
        localStorage.setItem('dam_view', this.state.viewMode);
        this.render();
      });
    });

    this.container.querySelectorAll('.dh-bc-item').forEach(btn => {
      btn.addEventListener('click', () => this.loadFolder(btn.dataset.folder));
    });

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

    const checkAll = document.getElementById('dhCheckAll');
    if (checkAll) {
      checkAll.addEventListener('change', () => {
        if (checkAll.checked) {
          this.selectAll();
        } else {
          this.state.selectedItems.clear();
          this.render();
        }
      });
    }

    this.container.querySelectorAll('[data-key]').forEach(el => {
      el.addEventListener('click', e => this.handleItemClick(e, el));
      el.addEventListener('dblclick', e => this.handleItemDblClick(e, el));
    });

    this.container.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const row = btn.closest('[data-key]');
        if (row) {
          const [type, id] = row.dataset.key.split(':');
          const item = type === 'folder' ? this.folderMap[id] : this.files.find(f => f.id === id);
          if (item) this.handleAction(btn.dataset.action, item, type === 'folder');
        }
      });
    });

    document.getElementById('dhClearSel')?.addEventListener('click', () => {
      this.state.selectedItems.clear();
      this.render();
    });

    document.getElementById('dhDownloadSel')?.addEventListener('click', () => this.downloadSelected());
    document.getElementById('dhCopyUrls')?.addEventListener('click', () => this.copySelectedUrls());
  }

  handleItemClick(e, el) {
    if (e.target.closest('[data-action]')) return;

    const key = el.dataset.key;
    const index = parseInt(el.dataset.index);
    const checkbox = el.querySelector('.dh-checkbox');

    if (e.target === checkbox || e.target.closest('.dh-check-wrap') || e.target.closest('.dh-card-select')) {
      if (this.state.selectedItems.has(key)) {
        this.state.selectedItems.delete(key);
      } else {
        this.state.selectedItems.add(key);
      }
      this.state.lastSelectedIndex = index;
      this.render();
    } else if (e.shiftKey && this.state.lastSelectedIndex >= 0) {
      const start = Math.min(this.state.lastSelectedIndex, index);
      const end = Math.max(this.state.lastSelectedIndex, index);
      for (let i = start; i <= end; i++) {
        const item = this.allItems[i];
        if (item) {
          this.state.selectedItems.add(`${item.isFolder ? 'folder' : 'file'}:${item.id}`);
        }
      }
      this.render();
    } else if (e.ctrlKey || e.metaKey) {
      if (this.state.selectedItems.has(key)) {
        this.state.selectedItems.delete(key);
      } else {
        this.state.selectedItems.add(key);
      }
      this.state.lastSelectedIndex = index;
      this.render();
    } else {
      this.state.selectedItems.clear();
      this.state.selectedItems.add(key);
      this.state.lastSelectedIndex = index;
      this.render();
    }
  }

  handleItemDblClick(e, el) {
    if (e.target.closest('[data-action]') || e.target.closest('.dh-checkbox')) return;

    const [type, id] = el.dataset.key.split(':');
    if (type === 'folder') {
      this.loadFolder(id);
    } else {
      const file = this.files.find(f => f.id === id);
      if (file) this.showPreview(file);
    }
  }

  handleAction(action, item, isFolder) {
    switch (action) {
      case 'download':
        this.downloadFile(item);
        break;
      case 'copy':
        navigator.clipboard.writeText(item.url).then(() => this.toast('Link copied to clipboard'));
        break;
      case 'preview':
        this.showPreview(item);
        break;
    }
  }

  selectAll() {
    this.allItems.forEach(item => {
      this.state.selectedItems.add(`${item.isFolder ? 'folder' : 'file'}:${item.id}`);
    });
    this.render();
  }

  downloadFile(file) {
    const a = document.createElement('a');
    a.href = file.url;
    a.download = file.name;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  downloadSelected() {
    for (const key of this.state.selectedItems) {
      const [type, id] = key.split(':');
      if (type === 'file') {
        const file = this.files.find(f => f.id === id);
        if (file) this.downloadFile(file);
      }
    }
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
        this.toast(`${urls.length} link${urls.length > 1 ? 's' : ''} copied to clipboard`);
      });
    }
  }

  showPreview(file) {
    let content = '';
    if (file.mimeType?.startsWith('image/')) {
      content = `<img src="${file.url}" alt="${this.esc(file.name)}" class="dh-preview-img">`;
    } else if (file.mimeType?.startsWith('video/')) {
      content = `<video src="${file.url}" controls autoplay class="dh-preview-video"></video>`;
    } else if (file.mimeType === 'application/pdf') {
      content = `<iframe src="${file.url}" class="dh-preview-pdf"></iframe>`;
    } else {
      content = `<div class="dh-preview-fallback">${this.getFileIcon(file.mimeType, true)}<p>Preview not available</p><a href="${file.url}" target="_blank" class="dh-btn dh-btn-primary">Download file</a></div>`;
    }

    const modal = document.createElement('div');
    modal.className = 'dh-modal-overlay';
    modal.id = 'dhModal';
    modal.innerHTML = `
      <div class="dh-modal dh-modal-preview">
        <div class="dh-modal-header">
          <div class="dh-modal-title">
            ${this.getFileIcon(file.mimeType)}
            <span>${this.esc(file.name)}</span>
          </div>
          <div class="dh-modal-actions">
            <button class="dh-modal-btn" data-action="download" title="Download"><svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg></button>
            <button class="dh-modal-btn" data-action="copy" title="Copy link"><svg viewBox="0 0 24 24"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg></button>
            <button class="dh-modal-btn" data-action="close" title="Close"><svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></button>
          </div>
        </div>
        <div class="dh-modal-body">${content}</div>
      </div>
    `;

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';

    modal.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        if (action === 'close') {
          this.closeAllModals();
        } else if (action === 'download') {
          this.downloadFile(file);
        } else if (action === 'copy') {
          navigator.clipboard.writeText(file.url).then(() => this.toast('Link copied'));
        }
      });
    });

    modal.addEventListener('click', e => {
      if (e.target === modal) this.closeAllModals();
    });
  }

  closeAllModals() {
    document.getElementById('dhModal')?.remove();
    document.body.style.overflow = '';
  }

  toast(message) {
    let container = document.querySelector('.dh-toasts');
    if (!container) {
      container = document.createElement('div');
      container.className = 'dh-toasts';
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = 'dh-toast';
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('exit');
      setTimeout(() => toast.remove(), 200);
    }, 3000);
  }

  esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  debounce(fn, delay) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
  }

  injectStyles() {
    if (document.getElementById('dh-styles')) return;
    const style = document.createElement('style');
    style.id = 'dh-styles';
    style.textContent = `
.dh{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen,Ubuntu,sans-serif;font-size:14px;line-height:1.5;color:#202124;background:#fff;min-height:100vh;display:flex;flex-direction:column}
.dh *,.dh *::before,.dh *::after{box-sizing:border-box}
.dh svg{flex-shrink:0;fill:currentColor}

.dh-header{display:flex;align-items:center;gap:16px;padding:8px 16px;border-bottom:1px solid #e0e0e0;min-height:64px}
.dh-header-left{flex-shrink:0}
.dh-header-center{flex:1;max-width:720px;margin:0 auto}
.dh-header-right{flex-shrink:0}
.dh-title{font-size:22px;font-weight:400;margin:0;color:#5f6368}

.dh-search{position:relative;width:100%}
.dh-search-icon{position:absolute;left:12px;top:50%;transform:translateY(-50%);width:24px;height:24px;color:#5f6368;pointer-events:none}
.dh-search-input{width:100%;height:48px;padding:0 48px;font-size:16px;border:none;border-radius:8px;background:#f1f3f4;color:#202124;outline:none;transition:background .2s,box-shadow .2s}
.dh-search-input:hover{background:#e8eaed}
.dh-search-input:focus{background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.1),0 4px 8px rgba(0,0,0,.08)}
.dh-search-input::placeholder{color:#5f6368}
.dh-search-clear{position:absolute;right:8px;top:50%;transform:translateY(-50%);width:32px;height:32px;display:flex;align-items:center;justify-content:center;background:none;border:none;border-radius:50%;color:#5f6368;cursor:pointer}
.dh-search-clear:hover{background:#e8eaed}
.dh-search-clear svg{width:20px;height:20px}

.dh-btn{display:inline-flex;align-items:center;gap:8px;padding:0 16px;height:36px;font-size:14px;font-weight:500;border:none;border-radius:4px;cursor:pointer;text-decoration:none;transition:background .2s,box-shadow .2s}
.dh-btn svg{width:20px;height:20px}
.dh-btn-primary{background:#1a73e8;color:#fff}
.dh-btn-primary:hover{background:#1765cc;box-shadow:0 1px 3px rgba(26,115,232,.3)}

.dh-toolbar{display:flex;align-items:center;justify-content:space-between;padding:4px 16px;border-bottom:1px solid #e0e0e0;min-height:48px}
.dh-breadcrumbs{display:flex;align-items:center;gap:4px;flex-wrap:wrap}
.dh-bc-item{padding:6px 8px;font-size:14px;font-weight:500;color:#5f6368;background:none;border:none;border-radius:16px;cursor:pointer}
.dh-bc-item:hover{background:#f1f3f4}
.dh-bc-item.active{color:#202124;cursor:default}
.dh-bc-item.active:hover{background:transparent}
.dh-bc-sep{width:20px;height:20px;color:#5f6368}
.dh-toolbar-right{display:flex;align-items:center;gap:8px}
.dh-view-toggle{display:flex;gap:4px}
.dh-view-btn{width:36px;height:36px;display:flex;align-items:center;justify-content:center;background:none;border:none;border-radius:50%;color:#5f6368;cursor:pointer}
.dh-view-btn:hover{background:#f1f3f4}
.dh-view-btn.active{background:#e8f0fe;color:#1a73e8}
.dh-view-btn svg{width:20px;height:20px}

.dh-selection-bar{display:flex;align-items:center;justify-content:space-between;padding:8px 16px;background:#e8f0fe;border-bottom:1px solid #d2e3fc}
.dh-sel-left{display:flex;align-items:center;gap:12px}
.dh-sel-close{width:36px;height:36px;display:flex;align-items:center;justify-content:center;background:none;border:none;border-radius:50%;cursor:pointer;color:#1a73e8}
.dh-sel-close:hover{background:#d2e3fc}
.dh-sel-close svg{width:20px;height:20px}
.dh-sel-count{font-size:14px;font-weight:500;color:#1a73e8}
.dh-sel-actions{display:flex;gap:8px}
.dh-sel-btn{display:flex;align-items:center;gap:6px;padding:8px 12px;font-size:14px;font-weight:500;background:none;border:none;border-radius:4px;color:#1a73e8;cursor:pointer}
.dh-sel-btn:hover{background:#d2e3fc}
.dh-sel-btn svg{width:18px;height:18px}

.dh-body{flex:1;padding:16px;overflow:auto}

.dh-table{width:100%;border-collapse:collapse}
.dh-table th{text-align:left;font-size:12px;font-weight:500;color:#5f6368;padding:8px 12px;border-bottom:1px solid #e0e0e0;user-select:none}
.dh-th-check{width:48px}
.dh-th-name{cursor:pointer}
.dh-th-name:hover{color:#202124}
.dh-th-type{width:120px}
.dh-th-actions{width:120px}

.dh-row{border-bottom:1px solid #f1f3f4;cursor:pointer;transition:background .1s}
.dh-row:hover{background:#f1f3f4}
.dh-row.selected{background:#e8f0fe}
.dh-row.selected:hover{background:#d2e3fc}
.dh-row td{padding:8px 12px}
.dh-td-check{width:48px}
.dh-check-wrap{display:flex;align-items:center;justify-content:center;width:24px;height:24px}
.dh-checkbox{width:18px;height:18px;cursor:pointer;accent-color:#1a73e8}
.dh-name-cell{display:flex;align-items:center;gap:12px}
.dh-file-icon{display:flex;flex-shrink:0}
.dh-file-icon svg{width:24px;height:24px}
.dh-file-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dh-td-type{color:#5f6368;font-size:13px}
.dh-td-actions{width:120px}
.dh-row-actions{display:flex;gap:4px;opacity:0;transition:opacity .15s}
.dh-row:hover .dh-row-actions{opacity:1}
.dh-row-btn{width:32px;height:32px;display:flex;align-items:center;justify-content:center;background:none;border:none;border-radius:50%;color:#5f6368;cursor:pointer}
.dh-row-btn:hover{background:#e8eaed}
.dh-row-btn svg{width:20px;height:20px}

.dh-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px}
.dh-card{position:relative;background:#fff;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;cursor:pointer;transition:box-shadow .2s,border-color .2s}
.dh-card:hover{border-color:#d2e3fc;box-shadow:0 2px 6px rgba(0,0,0,.1)}
.dh-card.selected{border-color:#1a73e8;background:#e8f0fe}
.dh-card-select{position:absolute;top:8px;left:8px;z-index:1;opacity:0;transition:opacity .15s}
.dh-card:hover .dh-card-select,.dh-card.selected .dh-card-select{opacity:1}
.dh-card-preview{height:160px;background:#f1f3f4;display:flex;align-items:center;justify-content:center;overflow:hidden}
.dh-thumb{width:100%;height:100%;object-fit:cover}
.dh-file-icon-lg{display:flex}
.dh-file-icon-lg svg{width:48px;height:48px}
.dh-card-name{padding:12px;font-size:14px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dh-card-actions{position:absolute;top:8px;right:8px;display:flex;gap:4px;opacity:0;transition:opacity .15s}
.dh-card:hover .dh-card-actions{opacity:1}
.dh-card-btn{width:32px;height:32px;display:flex;align-items:center;justify-content:center;background:#fff;border:none;border-radius:50%;color:#5f6368;cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,.2)}
.dh-card-btn:hover{background:#f1f3f4}
.dh-card-btn svg{width:18px;height:18px}

.dh-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:80px 24px;color:#5f6368}
.dh-empty h3{font-size:22px;font-weight:400;margin:24px 0 8px;color:#202124}
.dh-empty p{margin:0;font-size:14px}

.dh-denied{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:80px 24px;min-height:400px}
.dh-denied h2{font-size:24px;font-weight:400;margin:24px 0 8px;color:#202124}
.dh-denied p{margin:0;font-size:14px;color:#5f6368}

.dh-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:1000;padding:24px;animation:dhFadeIn .2s}
@keyframes dhFadeIn{from{opacity:0}to{opacity:1}}
.dh-modal{background:#fff;border-radius:8px;max-width:960px;width:100%;max-height:90vh;display:flex;flex-direction:column;animation:dhSlideUp .25s}
@keyframes dhSlideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
.dh-modal-preview{max-width:1200px}
.dh-modal-header{display:flex;align-items:center;justify-content:space-between;padding:8px 8px 8px 16px;border-bottom:1px solid #e0e0e0}
.dh-modal-title{display:flex;align-items:center;gap:12px;font-size:18px;font-weight:400;overflow:hidden}
.dh-modal-title svg{width:24px;height:24px;flex-shrink:0}
.dh-modal-title span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dh-modal-actions{display:flex;gap:4px}
.dh-modal-btn{width:40px;height:40px;display:flex;align-items:center;justify-content:center;background:none;border:none;border-radius:50%;color:#5f6368;cursor:pointer}
.dh-modal-btn:hover{background:#f1f3f4}
.dh-modal-btn svg{width:24px;height:24px}
.dh-modal-body{flex:1;overflow:auto;background:#202124;display:flex;align-items:center;justify-content:center;min-height:400px}
.dh-preview-img{max-width:100%;max-height:80vh;object-fit:contain}
.dh-preview-video{max-width:100%;max-height:80vh}
.dh-preview-pdf{width:100%;height:80vh;border:none}
.dh-preview-fallback{text-align:center;color:#9aa0a6;padding:48px}
.dh-preview-fallback svg{margin-bottom:16px}
.dh-preview-fallback p{margin:0 0 16px;font-size:14px}

.dh-toasts{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:2000;display:flex;flex-direction:column;gap:8px}
.dh-toast{padding:12px 24px;background:#323232;color:#fff;border-radius:4px;font-size:14px;animation:dhToastIn .2s;box-shadow:0 4px 12px rgba(0,0,0,.3)}
@keyframes dhToastIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
.dh-toast.exit{animation:dhToastOut .2s forwards}
@keyframes dhToastOut{to{opacity:0;transform:translateY(-16px)}}

@media(max-width:768px){
  .dh-header{flex-wrap:wrap;gap:12px}
  .dh-header-center{order:3;flex-basis:100%;max-width:none}
  .dh-title{font-size:18px}
  .dh-search-input{height:40px;font-size:14px}
  .dh-toolbar{flex-wrap:wrap;gap:8px}
  .dh-body{padding:8px}
  .dh-grid{grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
  .dh-card-preview{height:120px}
  .dh-table th:not(.dh-th-check):not(.dh-th-name),.dh-td-type,.dh-td-actions{display:none}
  .dh-row-actions{opacity:1}
  .dh-sel-btn span{display:none}
}
`;
    document.head.appendChild(style);
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = DAMHub;
} else if (typeof window !== 'undefined') {
  window.DAMHub = DAMHub;
}
