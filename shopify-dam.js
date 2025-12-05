/**
 * Shopify Digital Asset Management (DAM) Component
 *
 * A Dropbox/Google Drive-like file management system for Shopify stores.
 * Access restricted to users with 'admin' or 'affiliate' tags.
 *
 * Features:
 * - Folder structure with create/rename/delete
 * - File upload, preview, download
 * - Search functionality
 * - Grid and list view modes
 * - Drag and drop support
 * - Multi-select operations
 * - Breadcrumb navigation
 *
 * @author Claude
 * @version 1.0.0
 */

class ShopifyDAM {
  constructor(config = {}) {
    this.config = {
      containerId: config.containerId || 'shopify-dam-container',
      backendUrl: config.backendUrl || '',
      userEmail: config.userEmail || '',
      userTags: config.userTags || [],
      allowedTags: config.allowedTags || ['admin', 'affiliate'],
      maxFileSize: config.maxFileSize || 20 * 1024 * 1024, // 20MB default
      allowedFileTypes: config.allowedFileTypes || {
        images: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
        videos: ['video/mp4', 'video/webm', 'video/quicktime'],
        documents: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        archives: ['application/zip', 'application/x-rar-compressed'],
        other: ['text/plain', 'text/csv', 'application/json']
      },
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
      viewMode: 'grid', // 'grid' or 'list'
      sortBy: 'name', // 'name', 'date', 'size', 'type'
      sortOrder: 'asc',
      searchQuery: '',
      searchResults: null,
      clipboard: null, // { action: 'copy'|'cut', items: [] }
      dragState: null,
      contextMenu: null,
      renameTarget: null,
      uploadProgress: {},
      previewFile: null
    };

    this.container = null;
    this.uploadQueue = [];
    this.isUploading = false;
  }

  /**
   * Initialize the DAM component
   */
  async init() {
    this.container = document.getElementById(this.config.containerId);

    if (!this.container) {
      console.error('ShopifyDAM: Container not found:', this.config.containerId);
      return;
    }

    // Check access
    this.state.hasAccess = this.checkAccess();

    if (!this.state.hasAccess) {
      this.renderAccessDenied();
      return;
    }

    // Inject styles
    this.injectStyles();

    // Render initial loading state
    this.renderLoading();

    // Load initial data
    await this.loadCurrentFolder();

    // Set up event listeners
    this.setupEventListeners();

    this.state.initialized = true;
    this.state.loading = false;

    // Render the full interface
    this.render();
  }

  /**
   * Check if user has access to DAM
   */
  checkAccess() {
    if (!this.config.userTags || this.config.userTags.length === 0) {
      return false;
    }

    return this.config.allowedTags.some(tag =>
      this.config.userTags.includes(tag) ||
      this.config.userTags.includes(tag.toLowerCase())
    );
  }

  /**
   * Inject CSS styles
   */
  injectStyles() {
    if (document.getElementById('shopify-dam-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'shopify-dam-styles';
    styles.textContent = `
      .dam-container {
        font-family: ${this.config.theme.fontFamily};
        background: ${this.config.theme.backgroundColor};
        color: ${this.config.theme.textColor};
        min-height: 600px;
        border-radius: ${this.config.theme.borderRadius};
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }

      /* Header */
      .dam-header {
        background: ${this.config.theme.cardBackground};
        border-bottom: 1px solid ${this.config.theme.borderColor};
        padding: 16px 20px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        flex-wrap: wrap;
      }

      .dam-title {
        font-size: 20px;
        font-weight: 600;
        margin: 0;
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .dam-title-icon {
        width: 28px;
        height: 28px;
        color: ${this.config.theme.primaryColor};
      }

      .dam-header-actions {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      /* Toolbar */
      .dam-toolbar {
        background: ${this.config.theme.cardBackground};
        border-bottom: 1px solid ${this.config.theme.borderColor};
        padding: 12px 20px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        flex-wrap: wrap;
      }

      .dam-toolbar-left {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .dam-toolbar-right {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      /* Breadcrumbs */
      .dam-breadcrumbs {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 14px;
        flex-wrap: wrap;
      }

      .dam-breadcrumb {
        color: ${this.config.theme.secondaryColor};
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 4px;
        transition: all 0.15s ease;
      }

      .dam-breadcrumb:hover {
        background: ${this.config.theme.backgroundColor};
        color: ${this.config.theme.primaryColor};
      }

      .dam-breadcrumb.active {
        color: ${this.config.theme.textColor};
        font-weight: 500;
        cursor: default;
      }

      .dam-breadcrumb.active:hover {
        background: transparent;
        color: ${this.config.theme.textColor};
      }

      .dam-breadcrumb-sep {
        color: ${this.config.theme.secondaryColor};
      }

      /* Search */
      .dam-search-wrapper {
        position: relative;
        width: 300px;
      }

      .dam-search-input {
        width: 100%;
        padding: 8px 12px 8px 36px;
        border: 1px solid ${this.config.theme.borderColor};
        border-radius: 6px;
        font-size: 14px;
        outline: none;
        transition: border-color 0.15s ease, box-shadow 0.15s ease;
      }

      .dam-search-input:focus {
        border-color: ${this.config.theme.primaryColor};
        box-shadow: 0 0 0 3px ${this.config.theme.primaryColor}20;
      }

      .dam-search-icon {
        position: absolute;
        left: 10px;
        top: 50%;
        transform: translateY(-50%);
        color: ${this.config.theme.secondaryColor};
        width: 18px;
        height: 18px;
      }

      .dam-search-clear {
        position: absolute;
        right: 8px;
        top: 50%;
        transform: translateY(-50%);
        background: none;
        border: none;
        color: ${this.config.theme.secondaryColor};
        cursor: pointer;
        padding: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .dam-search-clear:hover {
        color: ${this.config.theme.textColor};
      }

      /* Buttons */
      .dam-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 8px 14px;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        border: 1px solid transparent;
        transition: all 0.15s ease;
        white-space: nowrap;
      }

      .dam-btn-icon {
        width: 18px;
        height: 18px;
      }

      .dam-btn-primary {
        background: ${this.config.theme.primaryColor};
        color: white;
      }

      .dam-btn-primary:hover {
        background: ${this.config.theme.primaryColor}dd;
      }

      .dam-btn-secondary {
        background: ${this.config.theme.cardBackground};
        border-color: ${this.config.theme.borderColor};
        color: ${this.config.theme.textColor};
      }

      .dam-btn-secondary:hover {
        background: ${this.config.theme.backgroundColor};
        border-color: ${this.config.theme.secondaryColor};
      }

      .dam-btn-icon-only {
        padding: 8px;
      }

      .dam-btn-danger {
        background: ${this.config.theme.errorColor};
        color: white;
      }

      .dam-btn-danger:hover {
        background: ${this.config.theme.errorColor}dd;
      }

      .dam-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      /* View Toggle */
      .dam-view-toggle {
        display: flex;
        border: 1px solid ${this.config.theme.borderColor};
        border-radius: 6px;
        overflow: hidden;
      }

      .dam-view-toggle button {
        background: ${this.config.theme.cardBackground};
        border: none;
        padding: 6px 10px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        color: ${this.config.theme.secondaryColor};
        transition: all 0.15s ease;
      }

      .dam-view-toggle button:not(:last-child) {
        border-right: 1px solid ${this.config.theme.borderColor};
      }

      .dam-view-toggle button:hover {
        background: ${this.config.theme.backgroundColor};
      }

      .dam-view-toggle button.active {
        background: ${this.config.theme.primaryColor};
        color: white;
      }

      /* Content Area */
      .dam-content {
        flex: 1;
        overflow: auto;
        padding: 20px;
        min-height: 400px;
        position: relative;
      }

      .dam-content.drag-over {
        background: ${this.config.theme.primaryColor}10;
      }

      .dam-content.drag-over::after {
        content: 'Drop files here to upload';
        position: absolute;
        inset: 20px;
        border: 2px dashed ${this.config.theme.primaryColor};
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        font-weight: 500;
        color: ${this.config.theme.primaryColor};
        background: ${this.config.theme.primaryColor}10;
        pointer-events: none;
        z-index: 10;
      }

      /* Grid View */
      .dam-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
        gap: 16px;
      }

      .dam-item {
        background: ${this.config.theme.cardBackground};
        border: 2px solid transparent;
        border-radius: 8px;
        overflow: hidden;
        cursor: pointer;
        transition: all 0.15s ease;
        position: relative;
      }

      .dam-item:hover {
        border-color: ${this.config.theme.borderColor};
        box-shadow: 0 4px 12px rgba(0,0,0,0.08);
      }

      .dam-item.selected {
        border-color: ${this.config.theme.primaryColor};
        background: ${this.config.theme.primaryColor}08;
      }

      .dam-item-preview {
        height: 120px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: ${this.config.theme.backgroundColor};
        position: relative;
        overflow: hidden;
      }

      .dam-item-preview img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .dam-item-preview video {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .dam-item-icon {
        width: 48px;
        height: 48px;
        color: ${this.config.theme.secondaryColor};
      }

      .dam-folder-icon {
        color: ${this.config.theme.primaryColor};
      }

      .dam-item-checkbox {
        position: absolute;
        top: 8px;
        left: 8px;
        width: 20px;
        height: 20px;
        border: 2px solid white;
        border-radius: 4px;
        background: rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.15s ease;
        color: white;
      }

      .dam-item:hover .dam-item-checkbox,
      .dam-item.selected .dam-item-checkbox {
        opacity: 1;
      }

      .dam-item.selected .dam-item-checkbox {
        background: ${this.config.theme.primaryColor};
        border-color: ${this.config.theme.primaryColor};
      }

      .dam-item-info {
        padding: 10px 12px;
      }

      .dam-item-name {
        font-size: 13px;
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        margin-bottom: 4px;
      }

      .dam-item-meta {
        font-size: 11px;
        color: ${this.config.theme.secondaryColor};
        display: flex;
        align-items: center;
        gap: 8px;
      }

      /* List View */
      .dam-list {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .dam-list-header {
        display: grid;
        grid-template-columns: 40px 1fr 120px 120px 100px;
        gap: 12px;
        padding: 8px 12px;
        font-size: 12px;
        font-weight: 600;
        color: ${this.config.theme.secondaryColor};
        text-transform: uppercase;
        letter-spacing: 0.5px;
        border-bottom: 1px solid ${this.config.theme.borderColor};
      }

      .dam-list-header span {
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .dam-list-header span:hover {
        color: ${this.config.theme.textColor};
      }

      .dam-list .dam-item {
        display: grid;
        grid-template-columns: 40px 1fr 120px 120px 100px;
        gap: 12px;
        align-items: center;
        padding: 8px 12px;
        border-radius: 6px;
      }

      .dam-list .dam-item-preview {
        width: 40px;
        height: 40px;
        border-radius: 4px;
      }

      .dam-list .dam-item-preview .dam-item-icon {
        width: 24px;
        height: 24px;
      }

      .dam-list .dam-item-name {
        margin-bottom: 0;
        font-size: 14px;
      }

      .dam-list .dam-item-meta {
        font-size: 13px;
      }

      /* Empty State */
      .dam-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 60px 20px;
        text-align: center;
      }

      .dam-empty-icon {
        width: 64px;
        height: 64px;
        color: ${this.config.theme.secondaryColor};
        margin-bottom: 16px;
      }

      .dam-empty-title {
        font-size: 18px;
        font-weight: 600;
        margin-bottom: 8px;
      }

      .dam-empty-text {
        color: ${this.config.theme.secondaryColor};
        margin-bottom: 20px;
      }

      /* Context Menu */
      .dam-context-menu {
        position: fixed;
        background: ${this.config.theme.cardBackground};
        border: 1px solid ${this.config.theme.borderColor};
        border-radius: 8px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.15);
        min-width: 180px;
        padding: 6px;
        z-index: 1000;
      }

      .dam-context-menu-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 12px;
        font-size: 14px;
        cursor: pointer;
        border-radius: 4px;
        transition: background 0.1s ease;
      }

      .dam-context-menu-item:hover {
        background: ${this.config.theme.backgroundColor};
      }

      .dam-context-menu-item.danger {
        color: ${this.config.theme.errorColor};
      }

      .dam-context-menu-item.danger:hover {
        background: ${this.config.theme.errorColor}10;
      }

      .dam-context-menu-icon {
        width: 16px;
        height: 16px;
        flex-shrink: 0;
      }

      .dam-context-menu-sep {
        height: 1px;
        background: ${this.config.theme.borderColor};
        margin: 6px 0;
      }

      /* Modal */
      .dam-modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2000;
        padding: 20px;
      }

      .dam-modal {
        background: ${this.config.theme.cardBackground};
        border-radius: 12px;
        max-width: 500px;
        width: 100%;
        max-height: 90vh;
        overflow: auto;
        box-shadow: 0 20px 60px rgba(0,0,0,0.2);
      }

      .dam-modal-header {
        padding: 16px 20px;
        border-bottom: 1px solid ${this.config.theme.borderColor};
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .dam-modal-title {
        font-size: 18px;
        font-weight: 600;
        margin: 0;
      }

      .dam-modal-close {
        background: none;
        border: none;
        color: ${this.config.theme.secondaryColor};
        cursor: pointer;
        padding: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .dam-modal-close:hover {
        color: ${this.config.theme.textColor};
      }

      .dam-modal-body {
        padding: 20px;
      }

      .dam-modal-footer {
        padding: 16px 20px;
        border-top: 1px solid ${this.config.theme.borderColor};
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 12px;
      }

      /* Form Elements */
      .dam-input {
        width: 100%;
        padding: 10px 14px;
        border: 1px solid ${this.config.theme.borderColor};
        border-radius: 6px;
        font-size: 14px;
        outline: none;
        transition: border-color 0.15s ease, box-shadow 0.15s ease;
      }

      .dam-input:focus {
        border-color: ${this.config.theme.primaryColor};
        box-shadow: 0 0 0 3px ${this.config.theme.primaryColor}20;
      }

      .dam-label {
        display: block;
        font-size: 14px;
        font-weight: 500;
        margin-bottom: 6px;
      }

      .dam-form-group {
        margin-bottom: 16px;
      }

      /* Upload Progress */
      .dam-upload-progress {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: ${this.config.theme.cardBackground};
        border-radius: 12px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.15);
        min-width: 320px;
        max-width: 400px;
        z-index: 1500;
        overflow: hidden;
      }

      .dam-upload-header {
        padding: 12px 16px;
        background: ${this.config.theme.primaryColor};
        color: white;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .dam-upload-header h4 {
        margin: 0;
        font-size: 14px;
        font-weight: 600;
      }

      .dam-upload-list {
        max-height: 300px;
        overflow-y: auto;
      }

      .dam-upload-item {
        padding: 12px 16px;
        border-bottom: 1px solid ${this.config.theme.borderColor};
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .dam-upload-item:last-child {
        border-bottom: none;
      }

      .dam-upload-item-icon {
        width: 32px;
        height: 32px;
        flex-shrink: 0;
      }

      .dam-upload-item-info {
        flex: 1;
        min-width: 0;
      }

      .dam-upload-item-name {
        font-size: 13px;
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .dam-upload-item-status {
        font-size: 12px;
        color: ${this.config.theme.secondaryColor};
      }

      .dam-upload-item-progress {
        height: 4px;
        background: ${this.config.theme.borderColor};
        border-radius: 2px;
        margin-top: 6px;
        overflow: hidden;
      }

      .dam-upload-item-progress-bar {
        height: 100%;
        background: ${this.config.theme.primaryColor};
        border-radius: 2px;
        transition: width 0.3s ease;
      }

      .dam-upload-item-progress-bar.complete {
        background: ${this.config.theme.successColor};
      }

      .dam-upload-item-progress-bar.error {
        background: ${this.config.theme.errorColor};
      }

      /* Preview Modal */
      .dam-preview-modal {
        max-width: 90vw;
        max-height: 90vh;
        width: auto;
        background: #111;
      }

      .dam-preview-modal .dam-modal-header {
        background: #111;
        color: white;
        border-bottom-color: #333;
      }

      .dam-preview-modal .dam-modal-close {
        color: #888;
      }

      .dam-preview-modal .dam-modal-close:hover {
        color: white;
      }

      .dam-preview-content {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        min-height: 300px;
        max-height: 70vh;
        overflow: auto;
      }

      .dam-preview-content img {
        max-width: 100%;
        max-height: 60vh;
        object-fit: contain;
      }

      .dam-preview-content video {
        max-width: 100%;
        max-height: 60vh;
      }

      .dam-preview-info {
        padding: 16px 20px;
        background: #222;
        color: #ccc;
        font-size: 13px;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .dam-preview-actions {
        display: flex;
        gap: 10px;
      }

      /* Toast Notifications */
      .dam-toast-container {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 3000;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .dam-toast {
        background: ${this.config.theme.cardBackground};
        border-radius: 8px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        padding: 12px 16px;
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 280px;
        animation: damToastIn 0.3s ease;
      }

      @keyframes damToastIn {
        from {
          opacity: 0;
          transform: translateX(20px);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }

      .dam-toast-icon {
        width: 20px;
        height: 20px;
        flex-shrink: 0;
      }

      .dam-toast-success .dam-toast-icon {
        color: ${this.config.theme.successColor};
      }

      .dam-toast-error .dam-toast-icon {
        color: ${this.config.theme.errorColor};
      }

      .dam-toast-warning .dam-toast-icon {
        color: ${this.config.theme.warningColor};
      }

      .dam-toast-message {
        flex: 1;
        font-size: 14px;
      }

      /* Loading State */
      .dam-loading {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 60px 20px;
      }

      .dam-spinner {
        width: 40px;
        height: 40px;
        border: 3px solid ${this.config.theme.borderColor};
        border-top-color: ${this.config.theme.primaryColor};
        border-radius: 50%;
        animation: damSpin 0.8s linear infinite;
        margin-bottom: 16px;
      }

      @keyframes damSpin {
        to { transform: rotate(360deg); }
      }

      /* Access Denied */
      .dam-access-denied {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 60px 20px;
        text-align: center;
        min-height: 400px;
        background: ${this.config.theme.cardBackground};
        border-radius: ${this.config.theme.borderRadius};
      }

      .dam-access-denied-icon {
        width: 64px;
        height: 64px;
        color: ${this.config.theme.errorColor};
        margin-bottom: 16px;
      }

      .dam-access-denied-title {
        font-size: 20px;
        font-weight: 600;
        margin-bottom: 8px;
      }

      .dam-access-denied-text {
        color: ${this.config.theme.secondaryColor};
        max-width: 400px;
      }

      /* Selection Bar */
      .dam-selection-bar {
        background: ${this.config.theme.primaryColor};
        color: white;
        padding: 12px 20px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
      }

      .dam-selection-info {
        font-size: 14px;
        font-weight: 500;
      }

      .dam-selection-actions {
        display: flex;
        gap: 8px;
      }

      .dam-selection-actions .dam-btn {
        background: rgba(255,255,255,0.2);
        border-color: transparent;
        color: white;
      }

      .dam-selection-actions .dam-btn:hover {
        background: rgba(255,255,255,0.3);
      }

      /* Rename Input */
      .dam-rename-input {
        padding: 4px 8px;
        border: 2px solid ${this.config.theme.primaryColor};
        border-radius: 4px;
        font-size: 13px;
        width: 100%;
        outline: none;
      }

      /* Responsive */
      @media (max-width: 768px) {
        .dam-header {
          flex-direction: column;
          align-items: stretch;
        }

        .dam-toolbar {
          flex-direction: column;
          align-items: stretch;
        }

        .dam-search-wrapper {
          width: 100%;
        }

        .dam-grid {
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
        }

        .dam-list .dam-item {
          grid-template-columns: 40px 1fr;
        }

        .dam-list-header {
          display: none;
        }

        .dam-list .dam-item-meta {
          display: none;
        }
      }
    `;

    document.head.appendChild(styles);
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Global click to close context menu
    document.addEventListener('click', (e) => {
      if (this.state.contextMenu && !e.target.closest('.dam-context-menu')) {
        this.closeContextMenu();
      }
    });

    // Global keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (!this.state.initialized || !this.state.hasAccess) return;

      // Check if we're in an input field
      if (e.target.matches('input, textarea')) return;

      // Ctrl/Cmd + A: Select all
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        this.selectAll();
      }

      // Escape: Deselect all
      if (e.key === 'Escape') {
        this.deselectAll();
        this.closeContextMenu();
        this.closeModal();
      }

      // Delete: Delete selected
      if (e.key === 'Delete' && this.state.selectedItems.length > 0) {
        this.deleteSelected();
      }

      // Ctrl/Cmd + C: Copy
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        this.copySelected();
      }

      // Ctrl/Cmd + X: Cut
      if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
        this.cutSelected();
      }

      // Ctrl/Cmd + V: Paste
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        this.paste();
      }
    });
  }

  /**
   * Render access denied state
   */
  renderAccessDenied() {
    this.container.innerHTML = `
      <div class="dam-access-denied">
        ${this.icons.lock}
        <h2 class="dam-access-denied-title">Access Restricted</h2>
        <p class="dam-access-denied-text">
          The Digital Asset Management system is only available to administrators and affiliate partners.
          Please contact support if you believe you should have access.
        </p>
      </div>
    `;
  }

  /**
   * Render loading state
   */
  renderLoading() {
    this.container.innerHTML = `
      <div class="dam-container">
        <div class="dam-loading">
          <div class="dam-spinner"></div>
          <p>Loading Digital Asset Manager...</p>
        </div>
      </div>
    `;
  }

  /**
   * Main render function
   */
  render() {
    const hasSelection = this.state.selectedItems.length > 0;

    this.container.innerHTML = `
      <div class="dam-container">
        ${this.renderHeader()}
        ${hasSelection ? this.renderSelectionBar() : ''}
        ${this.renderToolbar()}
        ${this.renderContent()}
      </div>
      ${this.renderUploadProgress()}
    `;

    this.attachEventHandlers();
  }

  /**
   * Render header
   */
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
            <input
              type="text"
              class="dam-search-input"
              placeholder="Search files and folders..."
              value="${this.escapeHtml(this.state.searchQuery)}"
              id="dam-search"
            >
            ${this.state.searchQuery ? `
              <button class="dam-search-clear" id="dam-search-clear">
                ${this.icons.x}
              </button>
            ` : ''}
          </div>
          <button class="dam-btn dam-btn-primary" id="dam-upload-btn">
            ${this.icons.upload}
            Upload
          </button>
          <input
            type="file"
            id="dam-file-input"
            multiple
            style="display: none;"
          >
        </div>
      </div>
    `;
  }

  /**
   * Render selection bar
   */
  renderSelectionBar() {
    const count = this.state.selectedItems.length;
    return `
      <div class="dam-selection-bar">
        <span class="dam-selection-info">
          ${count} item${count > 1 ? 's' : ''} selected
        </span>
        <div class="dam-selection-actions">
          <button class="dam-btn" id="dam-download-selected">
            ${this.icons.download}
            Download
          </button>
          <button class="dam-btn" id="dam-move-selected">
            ${this.icons.move}
            Move
          </button>
          <button class="dam-btn" id="dam-delete-selected">
            ${this.icons.trash}
            Delete
          </button>
          <button class="dam-btn" id="dam-clear-selection">
            ${this.icons.x}
            Clear
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Render toolbar
   */
  renderToolbar() {
    return `
      <div class="dam-toolbar">
        <div class="dam-toolbar-left">
          ${this.renderBreadcrumbs()}
        </div>
        <div class="dam-toolbar-right">
          <button class="dam-btn dam-btn-secondary" id="dam-new-folder">
            ${this.icons.folderPlus}
            New Folder
          </button>
          <div class="dam-view-toggle">
            <button
              data-view="grid"
              class="${this.state.viewMode === 'grid' ? 'active' : ''}"
              title="Grid view"
            >
              ${this.icons.grid}
            </button>
            <button
              data-view="list"
              class="${this.state.viewMode === 'list' ? 'active' : ''}"
              title="List view"
            >
              ${this.icons.list}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render breadcrumbs
   */
  renderBreadcrumbs() {
    const parts = this.state.currentPath.split('/').filter(p => p);
    let path = '/';

    const breadcrumbs = [
      `<span class="dam-breadcrumb${parts.length === 0 ? ' active' : ''}" data-path="/">
        ${this.icons.home}
      </span>`
    ];

    parts.forEach((part, i) => {
      path += part + '/';
      const isLast = i === parts.length - 1;
      breadcrumbs.push(`<span class="dam-breadcrumb-sep">/</span>`);
      breadcrumbs.push(`
        <span class="dam-breadcrumb${isLast ? ' active' : ''}" data-path="${this.escapeHtml(path)}">
          ${this.escapeHtml(part)}
        </span>
      `);
    });

    return `<div class="dam-breadcrumbs">${breadcrumbs.join('')}</div>`;
  }

  /**
   * Render content area
   */
  renderContent() {
    if (this.state.loading) {
      return `
        <div class="dam-content">
          <div class="dam-loading">
            <div class="dam-spinner"></div>
            <p>Loading...</p>
          </div>
        </div>
      `;
    }

    const items = this.getDisplayItems();

    if (items.folders.length === 0 && items.files.length === 0) {
      return `
        <div class="dam-content" id="dam-content">
          <div class="dam-empty">
            ${this.state.searchQuery ? this.icons.search : this.icons.folderOpen}
            <h3 class="dam-empty-title">
              ${this.state.searchQuery ? 'No results found' : 'This folder is empty'}
            </h3>
            <p class="dam-empty-text">
              ${this.state.searchQuery
                ? `No files or folders match "${this.escapeHtml(this.state.searchQuery)}"`
                : 'Drag and drop files here or click Upload to add files'}
            </p>
            ${!this.state.searchQuery ? `
              <button class="dam-btn dam-btn-primary" id="dam-upload-empty">
                ${this.icons.upload}
                Upload Files
              </button>
            ` : ''}
          </div>
        </div>
      `;
    }

    return `
      <div class="dam-content" id="dam-content">
        ${this.state.viewMode === 'grid'
          ? this.renderGridView(items)
          : this.renderListView(items)}
      </div>
    `;
  }

  /**
   * Render grid view
   */
  renderGridView(items) {
    const renderItem = (item, isFolder) => {
      const isSelected = this.state.selectedItems.some(s =>
        s.id === item.id && s.isFolder === isFolder
      );

      return `
        <div
          class="dam-item${isSelected ? ' selected' : ''}"
          data-id="${item.id}"
          data-type="${isFolder ? 'folder' : 'file'}"
          data-name="${this.escapeHtml(item.name)}"
        >
          <div class="dam-item-checkbox">
            ${isSelected ? this.icons.check : ''}
          </div>
          <div class="dam-item-preview">
            ${isFolder
              ? `<span class="dam-item-icon dam-folder-icon">${this.icons.folder}</span>`
              : this.renderFilePreview(item)}
          </div>
          <div class="dam-item-info">
            <div class="dam-item-name" title="${this.escapeHtml(item.name)}">
              ${this.escapeHtml(item.name)}
            </div>
            <div class="dam-item-meta">
              ${isFolder
                ? `${item.itemCount || 0} items`
                : `${this.formatFileSize(item.size)} &bull; ${this.formatDate(item.updatedAt)}`}
            </div>
          </div>
        </div>
      `;
    };

    return `
      <div class="dam-grid">
        ${items.folders.map(f => renderItem(f, true)).join('')}
        ${items.files.map(f => renderItem(f, false)).join('')}
      </div>
    `;
  }

  /**
   * Render list view
   */
  renderListView(items) {
    const renderItem = (item, isFolder) => {
      const isSelected = this.state.selectedItems.some(s =>
        s.id === item.id && s.isFolder === isFolder
      );

      return `
        <div
          class="dam-item${isSelected ? ' selected' : ''}"
          data-id="${item.id}"
          data-type="${isFolder ? 'folder' : 'file'}"
          data-name="${this.escapeHtml(item.name)}"
        >
          <div class="dam-item-preview">
            ${isFolder
              ? `<span class="dam-item-icon dam-folder-icon">${this.icons.folder}</span>`
              : `<span class="dam-item-icon">${this.getFileIcon(item.type)}</span>`}
          </div>
          <div class="dam-item-name" title="${this.escapeHtml(item.name)}">
            ${this.escapeHtml(item.name)}
          </div>
          <div class="dam-item-meta">${isFolder ? '-' : this.formatFileSize(item.size)}</div>
          <div class="dam-item-meta">${isFolder ? 'Folder' : this.getFileTypeLabel(item.type)}</div>
          <div class="dam-item-meta">${this.formatDate(item.updatedAt)}</div>
        </div>
      `;
    };

    return `
      <div class="dam-list">
        <div class="dam-list-header">
          <span></span>
          <span data-sort="name">Name ${this.state.sortBy === 'name' ? (this.state.sortOrder === 'asc' ? '↑' : '↓') : ''}</span>
          <span data-sort="size">Size ${this.state.sortBy === 'size' ? (this.state.sortOrder === 'asc' ? '↑' : '↓') : ''}</span>
          <span data-sort="type">Type ${this.state.sortBy === 'type' ? (this.state.sortOrder === 'asc' ? '↑' : '↓') : ''}</span>
          <span data-sort="date">Modified ${this.state.sortBy === 'date' ? (this.state.sortOrder === 'asc' ? '↑' : '↓') : ''}</span>
        </div>
        ${items.folders.map(f => renderItem(f, true)).join('')}
        ${items.files.map(f => renderItem(f, false)).join('')}
      </div>
    `;
  }

  /**
   * Render file preview thumbnail
   */
  renderFilePreview(file) {
    if (file.type.startsWith('image/') && file.thumbnailUrl) {
      return `<img src="${file.thumbnailUrl}" alt="${this.escapeHtml(file.name)}" loading="lazy">`;
    }
    if (file.type.startsWith('video/') && file.thumbnailUrl) {
      return `
        <img src="${file.thumbnailUrl}" alt="${this.escapeHtml(file.name)}" loading="lazy">
        <span class="dam-video-indicator">${this.icons.play}</span>
      `;
    }
    return `<span class="dam-item-icon">${this.getFileIcon(file.type)}</span>`;
  }

  /**
   * Render upload progress panel
   */
  renderUploadProgress() {
    const uploads = Object.values(this.state.uploadProgress);
    if (uploads.length === 0) return '';

    const inProgress = uploads.filter(u => u.status === 'uploading').length;
    const completed = uploads.filter(u => u.status === 'complete').length;
    const failed = uploads.filter(u => u.status === 'error').length;

    return `
      <div class="dam-upload-progress" id="dam-upload-progress">
        <div class="dam-upload-header">
          <h4>
            ${inProgress > 0
              ? `Uploading ${inProgress} file${inProgress > 1 ? 's' : ''}...`
              : `Uploaded ${completed} file${completed > 1 ? 's' : ''}${failed > 0 ? `, ${failed} failed` : ''}`}
          </h4>
          <button class="dam-modal-close" id="dam-close-upload-progress">
            ${this.icons.x}
          </button>
        </div>
        <div class="dam-upload-list">
          ${uploads.map(upload => `
            <div class="dam-upload-item">
              <span class="dam-upload-item-icon">${this.getFileIcon(upload.type)}</span>
              <div class="dam-upload-item-info">
                <div class="dam-upload-item-name">${this.escapeHtml(upload.name)}</div>
                <div class="dam-upload-item-status">
                  ${upload.status === 'uploading'
                    ? `${upload.progress}% - ${this.formatFileSize(upload.loaded)} of ${this.formatFileSize(upload.total)}`
                    : upload.status === 'complete'
                      ? 'Complete'
                      : upload.error || 'Failed'}
                </div>
                <div class="dam-upload-item-progress">
                  <div
                    class="dam-upload-item-progress-bar ${upload.status === 'complete' ? 'complete' : upload.status === 'error' ? 'error' : ''}"
                    style="width: ${upload.progress}%"
                  ></div>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Attach event handlers after render
   */
  attachEventHandlers() {
    // Upload button
    const uploadBtn = document.getElementById('dam-upload-btn');
    const fileInput = document.getElementById('dam-file-input');
    const uploadEmptyBtn = document.getElementById('dam-upload-empty');

    if (uploadBtn && fileInput) {
      uploadBtn.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
    }

    if (uploadEmptyBtn) {
      uploadEmptyBtn.addEventListener('click', () => fileInput?.click());
    }

    // Search
    const searchInput = document.getElementById('dam-search');
    const searchClear = document.getElementById('dam-search-clear');

    if (searchInput) {
      searchInput.addEventListener('input', this.debounce((e) => {
        this.state.searchQuery = e.target.value;
        this.render();
      }, 300));
    }

    if (searchClear) {
      searchClear.addEventListener('click', () => {
        this.state.searchQuery = '';
        this.render();
      });
    }

    // New folder button
    const newFolderBtn = document.getElementById('dam-new-folder');
    if (newFolderBtn) {
      newFolderBtn.addEventListener('click', () => this.showNewFolderModal());
    }

    // View toggle
    const viewToggle = this.container.querySelector('.dam-view-toggle');
    if (viewToggle) {
      viewToggle.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (btn && btn.dataset.view) {
          this.state.viewMode = btn.dataset.view;
          this.render();
        }
      });
    }

    // Breadcrumb navigation
    this.container.querySelectorAll('.dam-breadcrumb').forEach(crumb => {
      crumb.addEventListener('click', () => {
        if (!crumb.classList.contains('active')) {
          this.navigateTo(crumb.dataset.path);
        }
      });
    });

    // Content area - drag and drop
    const content = document.getElementById('dam-content');
    if (content) {
      content.addEventListener('dragover', (e) => {
        e.preventDefault();
        content.classList.add('drag-over');
      });

      content.addEventListener('dragleave', () => {
        content.classList.remove('drag-over');
      });

      content.addEventListener('drop', (e) => {
        e.preventDefault();
        content.classList.remove('drag-over');
        this.handleFileDrop(e);
      });
    }

    // Item click/double-click/context menu
    this.container.querySelectorAll('.dam-item').forEach(item => {
      item.addEventListener('click', (e) => this.handleItemClick(e, item));
      item.addEventListener('dblclick', () => this.handleItemDoubleClick(item));
      item.addEventListener('contextmenu', (e) => this.handleItemContextMenu(e, item));
    });

    // Selection bar actions
    const downloadSelected = document.getElementById('dam-download-selected');
    const moveSelected = document.getElementById('dam-move-selected');
    const deleteSelected = document.getElementById('dam-delete-selected');
    const clearSelection = document.getElementById('dam-clear-selection');

    if (downloadSelected) downloadSelected.addEventListener('click', () => this.downloadSelected());
    if (moveSelected) moveSelected.addEventListener('click', () => this.showMoveModal());
    if (deleteSelected) deleteSelected.addEventListener('click', () => this.deleteSelected());
    if (clearSelection) clearSelection.addEventListener('click', () => this.deselectAll());

    // Sort headers (list view)
    this.container.querySelectorAll('.dam-list-header span[data-sort]').forEach(header => {
      header.addEventListener('click', () => {
        const sortBy = header.dataset.sort;
        if (this.state.sortBy === sortBy) {
          this.state.sortOrder = this.state.sortOrder === 'asc' ? 'desc' : 'asc';
        } else {
          this.state.sortBy = sortBy;
          this.state.sortOrder = 'asc';
        }
        this.render();
      });
    });

    // Close upload progress
    const closeUploadProgress = document.getElementById('dam-close-upload-progress');
    if (closeUploadProgress) {
      closeUploadProgress.addEventListener('click', () => {
        // Only close if no uploads in progress
        const uploading = Object.values(this.state.uploadProgress).some(u => u.status === 'uploading');
        if (!uploading) {
          this.state.uploadProgress = {};
          this.render();
        }
      });
    }
  }

  /**
   * Handle item click
   */
  handleItemClick(e, item) {
    const id = item.dataset.id;
    const type = item.dataset.type;
    const isFolder = type === 'folder';

    // Check for checkbox click
    const checkbox = item.querySelector('.dam-item-checkbox');
    const clickedCheckbox = checkbox && checkbox.contains(e.target);

    if (e.ctrlKey || e.metaKey || clickedCheckbox) {
      // Toggle selection
      this.toggleSelection(id, isFolder);
    } else if (e.shiftKey) {
      // Range selection
      this.rangeSelect(id, isFolder);
    } else {
      // Single selection
      this.state.selectedItems = [{ id, isFolder }];
      this.render();
    }
  }

  /**
   * Handle item double-click
   */
  handleItemDoubleClick(item) {
    const id = item.dataset.id;
    const type = item.dataset.type;

    if (type === 'folder') {
      const folder = this.state.folders.find(f => f.id === id);
      if (folder) {
        this.navigateTo(folder.path);
      }
    } else {
      const file = this.state.files.find(f => f.id === id);
      if (file) {
        this.showPreview(file);
      }
    }
  }

  /**
   * Handle item context menu
   */
  handleItemContextMenu(e, item) {
    e.preventDefault();

    const id = item.dataset.id;
    const type = item.dataset.type;
    const isFolder = type === 'folder';

    // Ensure item is selected
    if (!this.state.selectedItems.some(s => s.id === id)) {
      this.state.selectedItems = [{ id, isFolder }];
      this.render();
    }

    this.showContextMenu(e.clientX, e.clientY, isFolder);
  }

  /**
   * Show context menu
   */
  showContextMenu(x, y, isFolder) {
    this.closeContextMenu();

    const menu = document.createElement('div');
    menu.className = 'dam-context-menu';
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    const items = isFolder ? [
      { label: 'Open', icon: this.icons.folderOpen, action: 'open' },
      { type: 'separator' },
      { label: 'Rename', icon: this.icons.edit, action: 'rename' },
      { label: 'Move', icon: this.icons.move, action: 'move' },
      { type: 'separator' },
      { label: 'Delete', icon: this.icons.trash, action: 'delete', danger: true }
    ] : [
      { label: 'Preview', icon: this.icons.eye, action: 'preview' },
      { label: 'Download', icon: this.icons.download, action: 'download' },
      { label: 'Copy Link', icon: this.icons.link, action: 'copy-link' },
      { type: 'separator' },
      { label: 'Rename', icon: this.icons.edit, action: 'rename' },
      { label: 'Move', icon: this.icons.move, action: 'move' },
      { type: 'separator' },
      { label: 'Delete', icon: this.icons.trash, action: 'delete', danger: true }
    ];

    menu.innerHTML = items.map(item => {
      if (item.type === 'separator') {
        return '<div class="dam-context-menu-sep"></div>';
      }
      return `
        <div class="dam-context-menu-item${item.danger ? ' danger' : ''}" data-action="${item.action}">
          <span class="dam-context-menu-icon">${item.icon}</span>
          ${item.label}
        </div>
      `;
    }).join('');

    document.body.appendChild(menu);
    this.state.contextMenu = menu;

    // Adjust position if menu goes off screen
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      menu.style.left = `${x - rect.width}px`;
    }
    if (rect.bottom > window.innerHeight) {
      menu.style.top = `${y - rect.height}px`;
    }

    // Add click handlers
    menu.querySelectorAll('.dam-context-menu-item').forEach(item => {
      item.addEventListener('click', () => {
        this.handleContextMenuAction(item.dataset.action);
        this.closeContextMenu();
      });
    });
  }

  /**
   * Close context menu
   */
  closeContextMenu() {
    if (this.state.contextMenu) {
      this.state.contextMenu.remove();
      this.state.contextMenu = null;
    }
  }

  /**
   * Handle context menu action
   */
  handleContextMenuAction(action) {
    const selected = this.state.selectedItems[0];
    if (!selected) return;

    const item = selected.isFolder
      ? this.state.folders.find(f => f.id === selected.id)
      : this.state.files.find(f => f.id === selected.id);

    if (!item) return;

    switch (action) {
      case 'open':
        if (selected.isFolder) {
          this.navigateTo(item.path);
        }
        break;
      case 'preview':
        this.showPreview(item);
        break;
      case 'download':
        this.downloadFile(item);
        break;
      case 'copy-link':
        this.copyFileLink(item);
        break;
      case 'rename':
        this.showRenameModal(item, selected.isFolder);
        break;
      case 'move':
        this.showMoveModal();
        break;
      case 'delete':
        this.deleteSelected();
        break;
    }
  }

  /**
   * Toggle item selection
   */
  toggleSelection(id, isFolder) {
    const index = this.state.selectedItems.findIndex(s => s.id === id && s.isFolder === isFolder);
    if (index >= 0) {
      this.state.selectedItems.splice(index, 1);
    } else {
      this.state.selectedItems.push({ id, isFolder });
    }
    this.render();
  }

  /**
   * Range selection
   */
  rangeSelect(id, isFolder) {
    // Simplified range selection - just add to selection
    if (!this.state.selectedItems.some(s => s.id === id && s.isFolder === isFolder)) {
      this.state.selectedItems.push({ id, isFolder });
      this.render();
    }
  }

  /**
   * Select all items
   */
  selectAll() {
    this.state.selectedItems = [
      ...this.state.folders.map(f => ({ id: f.id, isFolder: true })),
      ...this.state.files.map(f => ({ id: f.id, isFolder: false }))
    ];
    this.render();
  }

  /**
   * Deselect all items
   */
  deselectAll() {
    this.state.selectedItems = [];
    this.render();
  }

  /**
   * Get items to display (with search/sort)
   */
  getDisplayItems() {
    let folders = [...this.state.folders];
    let files = [...this.state.files];

    // Apply search filter
    if (this.state.searchQuery) {
      const query = this.state.searchQuery.toLowerCase();
      folders = folders.filter(f => f.name.toLowerCase().includes(query));
      files = files.filter(f => f.name.toLowerCase().includes(query));
    }

    // Apply sorting
    const sortFn = (a, b) => {
      let comparison = 0;
      switch (this.state.sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'size':
          comparison = (a.size || 0) - (b.size || 0);
          break;
        case 'type':
          comparison = (a.type || '').localeCompare(b.type || '');
          break;
        case 'date':
          comparison = new Date(a.updatedAt) - new Date(b.updatedAt);
          break;
      }
      return this.state.sortOrder === 'asc' ? comparison : -comparison;
    };

    folders.sort(sortFn);
    files.sort(sortFn);

    return { folders, files };
  }

  /**
   * Navigate to path
   */
  async navigateTo(path) {
    this.state.currentPath = path;
    this.state.selectedItems = [];
    this.state.searchQuery = '';
    await this.loadCurrentFolder();
    this.render();
  }

  /**
   * Load current folder contents
   */
  async loadCurrentFolder() {
    this.state.loading = true;

    try {
      const params = new URLSearchParams({
        action: 'list',
        path: this.state.currentPath
      });

      const response = await fetch(`${this.config.backendUrl}/api/dam?${params}`, {
        headers: {
          'X-User-Email': this.config.userEmail,
          'X-User-Tags': JSON.stringify(this.config.userTags)
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load folder contents');
      }

      const data = await response.json();
      this.state.folders = data.folders || [];
      this.state.files = data.files || [];
    } catch (error) {
      console.error('ShopifyDAM: Error loading folder:', error);
      this.showToast('error', 'Failed to load folder contents');
      this.state.folders = [];
      this.state.files = [];
    }

    this.state.loading = false;
  }

  /**
   * Handle file selection for upload
   */
  handleFileSelect(e) {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      this.uploadFiles(files);
    }
    e.target.value = '';
  }

  /**
   * Handle file drop
   */
  handleFileDrop(e) {
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      this.uploadFiles(files);
    }
  }

  /**
   * Upload files
   */
  async uploadFiles(files) {
    for (const file of files) {
      // Validate file
      if (file.size > this.config.maxFileSize) {
        this.showToast('error', `File "${file.name}" exceeds maximum size of ${this.formatFileSize(this.config.maxFileSize)}`);
        continue;
      }

      const allowedTypes = Object.values(this.config.allowedFileTypes).flat();
      if (!allowedTypes.includes(file.type) && !file.type.match(/^(image|video|application|text)\//)) {
        this.showToast('error', `File type "${file.type}" is not allowed`);
        continue;
      }

      // Add to upload progress
      const uploadId = this.generateId();
      this.state.uploadProgress[uploadId] = {
        id: uploadId,
        name: file.name,
        type: file.type,
        size: file.size,
        progress: 0,
        loaded: 0,
        total: file.size,
        status: 'uploading'
      };

      this.render();

      // Upload file
      try {
        await this.uploadFile(file, uploadId);
        this.state.uploadProgress[uploadId].status = 'complete';
        this.state.uploadProgress[uploadId].progress = 100;
      } catch (error) {
        console.error('Upload error:', error);
        this.state.uploadProgress[uploadId].status = 'error';
        this.state.uploadProgress[uploadId].error = error.message;
      }

      this.render();
    }

    // Reload folder after uploads
    await this.loadCurrentFolder();
    this.render();
  }

  /**
   * Upload a single file
   */
  async uploadFile(file, uploadId) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('path', this.state.currentPath);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100);
          this.state.uploadProgress[uploadId].progress = progress;
          this.state.uploadProgress[uploadId].loaded = e.loaded;
          this.render();
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText));
        } else {
          reject(new Error('Upload failed'));
        }
      });

      xhr.addEventListener('error', () => reject(new Error('Upload failed')));

      xhr.open('POST', `${this.config.backendUrl}/api/dam?action=upload`);
      xhr.setRequestHeader('X-User-Email', this.config.userEmail);
      xhr.setRequestHeader('X-User-Tags', JSON.stringify(this.config.userTags));
      xhr.send(formData);
    });
  }

  /**
   * Show new folder modal
   */
  showNewFolderModal() {
    this.showModal({
      title: 'Create New Folder',
      content: `
        <div class="dam-form-group">
          <label class="dam-label">Folder Name</label>
          <input type="text" class="dam-input" id="dam-folder-name" placeholder="Enter folder name" autofocus>
        </div>
      `,
      actions: [
        { label: 'Cancel', type: 'secondary', action: 'close' },
        { label: 'Create', type: 'primary', action: 'create-folder' }
      ],
      onAction: async (action) => {
        if (action === 'create-folder') {
          const name = document.getElementById('dam-folder-name').value.trim();
          if (!name) {
            this.showToast('error', 'Please enter a folder name');
            return false;
          }
          await this.createFolder(name);
          return true;
        }
        return true;
      }
    });

    // Focus input after render
    setTimeout(() => {
      const input = document.getElementById('dam-folder-name');
      if (input) input.focus();
    }, 100);
  }

  /**
   * Create folder
   */
  async createFolder(name) {
    try {
      const response = await fetch(`${this.config.backendUrl}/api/dam?action=create-folder`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Email': this.config.userEmail,
          'X-User-Tags': JSON.stringify(this.config.userTags)
        },
        body: JSON.stringify({
          name,
          path: this.state.currentPath
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create folder');
      }

      this.showToast('success', `Folder "${name}" created`);
      await this.loadCurrentFolder();
      this.render();
    } catch (error) {
      console.error('Create folder error:', error);
      this.showToast('error', 'Failed to create folder');
    }
  }

  /**
   * Show rename modal
   */
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
      onAction: async (action) => {
        if (action === 'rename') {
          const newName = document.getElementById('dam-rename-input').value.trim();
          if (!newName) {
            this.showToast('error', 'Please enter a name');
            return false;
          }
          if (newName === item.name) {
            return true;
          }
          await this.renameItem(item, newName, isFolder);
          return true;
        }
        return true;
      }
    });

    setTimeout(() => {
      const input = document.getElementById('dam-rename-input');
      if (input) {
        input.focus();
        // Select filename without extension
        const dotIndex = item.name.lastIndexOf('.');
        input.setSelectionRange(0, dotIndex > 0 ? dotIndex : item.name.length);
      }
    }, 100);
  }

  /**
   * Rename item
   */
  async renameItem(item, newName, isFolder) {
    try {
      const response = await fetch(`${this.config.backendUrl}/api/dam?action=rename`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Email': this.config.userEmail,
          'X-User-Tags': JSON.stringify(this.config.userTags)
        },
        body: JSON.stringify({
          id: item.id,
          newName,
          isFolder
        })
      });

      if (!response.ok) {
        throw new Error('Failed to rename');
      }

      this.showToast('success', `Renamed to "${newName}"`);
      await this.loadCurrentFolder();
      this.render();
    } catch (error) {
      console.error('Rename error:', error);
      this.showToast('error', 'Failed to rename item');
    }
  }

  /**
   * Show move modal
   */
  showMoveModal() {
    // For simplicity, show a path input for now
    // In a full implementation, this would be a folder tree picker
    this.showModal({
      title: 'Move Items',
      content: `
        <div class="dam-form-group">
          <label class="dam-label">Destination Path</label>
          <input type="text" class="dam-input" id="dam-move-path" value="/" placeholder="Enter destination path">
          <p style="font-size: 12px; color: ${this.config.theme.secondaryColor}; margin-top: 8px;">
            Enter the folder path where you want to move the selected items.
          </p>
        </div>
      `,
      actions: [
        { label: 'Cancel', type: 'secondary', action: 'close' },
        { label: 'Move', type: 'primary', action: 'move' }
      ],
      onAction: async (action) => {
        if (action === 'move') {
          const destination = document.getElementById('dam-move-path').value.trim();
          if (!destination) {
            this.showToast('error', 'Please enter a destination path');
            return false;
          }
          await this.moveItems(destination);
          return true;
        }
        return true;
      }
    });
  }

  /**
   * Move items
   */
  async moveItems(destination) {
    try {
      const response = await fetch(`${this.config.backendUrl}/api/dam?action=move`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Email': this.config.userEmail,
          'X-User-Tags': JSON.stringify(this.config.userTags)
        },
        body: JSON.stringify({
          items: this.state.selectedItems,
          destination
        })
      });

      if (!response.ok) {
        throw new Error('Failed to move items');
      }

      this.showToast('success', 'Items moved successfully');
      this.state.selectedItems = [];
      await this.loadCurrentFolder();
      this.render();
    } catch (error) {
      console.error('Move error:', error);
      this.showToast('error', 'Failed to move items');
    }
  }

  /**
   * Delete selected items
   */
  async deleteSelected() {
    const count = this.state.selectedItems.length;
    const message = count === 1
      ? 'Are you sure you want to delete this item?'
      : `Are you sure you want to delete ${count} items?`;

    this.showModal({
      title: 'Confirm Delete',
      content: `
        <p>${message}</p>
        <p style="color: ${this.config.theme.errorColor}; font-size: 13px; margin-top: 12px;">
          This action cannot be undone.
        </p>
      `,
      actions: [
        { label: 'Cancel', type: 'secondary', action: 'close' },
        { label: 'Delete', type: 'danger', action: 'delete' }
      ],
      onAction: async (action) => {
        if (action === 'delete') {
          await this.performDelete();
          return true;
        }
        return true;
      }
    });
  }

  /**
   * Perform delete operation
   */
  async performDelete() {
    try {
      const response = await fetch(`${this.config.backendUrl}/api/dam?action=delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Email': this.config.userEmail,
          'X-User-Tags': JSON.stringify(this.config.userTags)
        },
        body: JSON.stringify({
          items: this.state.selectedItems
        })
      });

      if (!response.ok) {
        throw new Error('Failed to delete items');
      }

      this.showToast('success', 'Items deleted successfully');
      this.state.selectedItems = [];
      await this.loadCurrentFolder();
      this.render();
    } catch (error) {
      console.error('Delete error:', error);
      this.showToast('error', 'Failed to delete items');
    }
  }

  /**
   * Download selected items
   */
  downloadSelected() {
    this.state.selectedItems.forEach(selected => {
      if (!selected.isFolder) {
        const file = this.state.files.find(f => f.id === selected.id);
        if (file) {
          this.downloadFile(file);
        }
      }
    });
  }

  /**
   * Download a single file
   */
  downloadFile(file) {
    const link = document.createElement('a');
    link.href = file.url;
    link.download = file.name;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Copy file link
   */
  async copyFileLink(file) {
    try {
      await navigator.clipboard.writeText(file.url);
      this.showToast('success', 'Link copied to clipboard');
    } catch (error) {
      console.error('Copy error:', error);
      this.showToast('error', 'Failed to copy link');
    }
  }

  /**
   * Copy selected items
   */
  copySelected() {
    if (this.state.selectedItems.length === 0) return;

    this.state.clipboard = {
      action: 'copy',
      items: [...this.state.selectedItems]
    };
    this.showToast('success', 'Items copied');
  }

  /**
   * Cut selected items
   */
  cutSelected() {
    if (this.state.selectedItems.length === 0) return;

    this.state.clipboard = {
      action: 'cut',
      items: [...this.state.selectedItems]
    };
    this.showToast('success', 'Items cut');
  }

  /**
   * Paste items
   */
  async paste() {
    if (!this.state.clipboard) return;

    try {
      const response = await fetch(`${this.config.backendUrl}/api/dam?action=paste`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Email': this.config.userEmail,
          'X-User-Tags': JSON.stringify(this.config.userTags)
        },
        body: JSON.stringify({
          items: this.state.clipboard.items,
          action: this.state.clipboard.action,
          destination: this.state.currentPath
        })
      });

      if (!response.ok) {
        throw new Error('Failed to paste items');
      }

      if (this.state.clipboard.action === 'cut') {
        this.state.clipboard = null;
      }

      this.showToast('success', 'Items pasted successfully');
      await this.loadCurrentFolder();
      this.render();
    } catch (error) {
      console.error('Paste error:', error);
      this.showToast('error', 'Failed to paste items');
    }
  }

  /**
   * Show file preview
   */
  showPreview(file) {
    this.state.previewFile = file;

    let previewContent = '';

    if (file.type.startsWith('image/')) {
      previewContent = `<img src="${file.url}" alt="${this.escapeHtml(file.name)}">`;
    } else if (file.type.startsWith('video/')) {
      previewContent = `<video src="${file.url}" controls autoplay></video>`;
    } else if (file.type === 'application/pdf') {
      previewContent = `<iframe src="${file.url}" style="width: 100%; height: 60vh; border: none;"></iframe>`;
    } else {
      previewContent = `
        <div style="text-align: center;">
          ${this.getFileIcon(file.type)}
          <p style="color: white; margin-top: 20px;">Preview not available for this file type</p>
        </div>
      `;
    }

    const modal = document.createElement('div');
    modal.className = 'dam-modal-overlay';
    modal.innerHTML = `
      <div class="dam-modal dam-preview-modal" style="width: auto; max-width: 90vw;">
        <div class="dam-modal-header">
          <h3 class="dam-modal-title">${this.escapeHtml(file.name)}</h3>
          <button class="dam-modal-close" id="dam-close-preview">
            ${this.icons.x}
          </button>
        </div>
        <div class="dam-preview-content">
          ${previewContent}
        </div>
        <div class="dam-preview-info">
          <div>
            ${this.formatFileSize(file.size)} &bull; ${this.getFileTypeLabel(file.type)} &bull; ${this.formatDate(file.updatedAt)}
          </div>
          <div class="dam-preview-actions">
            <button class="dam-btn dam-btn-secondary" id="dam-preview-download">
              ${this.icons.download}
              Download
            </button>
            <button class="dam-btn dam-btn-secondary" id="dam-preview-copy-link">
              ${this.icons.link}
              Copy Link
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Event handlers
    modal.querySelector('#dam-close-preview').addEventListener('click', () => {
      modal.remove();
      this.state.previewFile = null;
    });

    modal.querySelector('#dam-preview-download').addEventListener('click', () => {
      this.downloadFile(file);
    });

    modal.querySelector('#dam-preview-copy-link').addEventListener('click', () => {
      this.copyFileLink(file);
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
        this.state.previewFile = null;
      }
    });
  }

  /**
   * Show modal
   */
  showModal({ title, content, actions, onAction }) {
    this.closeModal();

    const modal = document.createElement('div');
    modal.className = 'dam-modal-overlay';
    modal.id = 'dam-modal';
    modal.innerHTML = `
      <div class="dam-modal">
        <div class="dam-modal-header">
          <h3 class="dam-modal-title">${title}</h3>
          <button class="dam-modal-close" data-action="close">
            ${this.icons.x}
          </button>
        </div>
        <div class="dam-modal-body">
          ${content}
        </div>
        <div class="dam-modal-footer">
          ${actions.map(action => `
            <button
              class="dam-btn dam-btn-${action.type}"
              data-action="${action.action}"
            >
              ${action.label}
            </button>
          `).join('')}
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Handle actions
    modal.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const action = btn.dataset.action;
        if (action === 'close') {
          this.closeModal();
        } else if (onAction) {
          const shouldClose = await onAction(action);
          if (shouldClose) {
            this.closeModal();
          }
        }
      });
    });

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        this.closeModal();
      }
    });

    // Handle Enter key in input
    modal.querySelector('input')?.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        const primaryAction = actions.find(a => a.type === 'primary' || a.type === 'danger');
        if (primaryAction && onAction) {
          const shouldClose = await onAction(primaryAction.action);
          if (shouldClose) {
            this.closeModal();
          }
        }
      }
    });
  }

  /**
   * Close modal
   */
  closeModal() {
    const modal = document.getElementById('dam-modal');
    if (modal) {
      modal.remove();
    }
  }

  /**
   * Show toast notification
   */
  showToast(type, message) {
    let container = document.querySelector('.dam-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'dam-toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `dam-toast dam-toast-${type}`;
    toast.innerHTML = `
      <span class="dam-toast-icon">
        ${type === 'success' ? this.icons.check : type === 'error' ? this.icons.x : this.icons.info}
      </span>
      <span class="dam-toast-message">${this.escapeHtml(message)}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.remove();
      if (container.children.length === 0) {
        container.remove();
      }
    }, 4000);
  }

  /**
   * Helper: Format file size
   */
  formatFileSize(bytes) {
    if (!bytes) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  }

  /**
   * Helper: Format date
   */
  formatDate(date) {
    if (!date) return '-';
    const d = new Date(date);
    const now = new Date();
    const diff = now - d;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;

    return d.toLocaleDateString();
  }

  /**
   * Helper: Get file icon
   */
  getFileIcon(type) {
    if (!type) return this.icons.file;

    if (type.startsWith('image/')) return this.icons.image;
    if (type.startsWith('video/')) return this.icons.video;
    if (type.startsWith('audio/')) return this.icons.audio;
    if (type === 'application/pdf') return this.icons.pdf;
    if (type.includes('word') || type.includes('document')) return this.icons.doc;
    if (type.includes('sheet') || type.includes('excel')) return this.icons.sheet;
    if (type.includes('zip') || type.includes('rar') || type.includes('archive')) return this.icons.archive;

    return this.icons.file;
  }

  /**
   * Helper: Get file type label
   */
  getFileTypeLabel(type) {
    if (!type) return 'File';

    if (type.startsWith('image/')) return 'Image';
    if (type.startsWith('video/')) return 'Video';
    if (type.startsWith('audio/')) return 'Audio';
    if (type === 'application/pdf') return 'PDF';
    if (type.includes('word') || type.includes('document')) return 'Document';
    if (type.includes('sheet') || type.includes('excel')) return 'Spreadsheet';
    if (type.includes('zip') || type.includes('rar')) return 'Archive';

    return type.split('/')[1]?.toUpperCase() || 'File';
  }

  /**
   * Helper: Escape HTML
   */
  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Helper: Generate unique ID
   */
  generateId() {
    return 'dam_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Helper: Debounce function
   */
  debounce(fn, delay) {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  /**
   * SVG Icons
   */
  get icons() {
    return {
      folder: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>',
      folderOpen: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path><path d="M2 10h20"></path></svg>',
      folderPlus: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path><line x1="12" y1="11" x2="12" y2="17"></line><line x1="9" y1="14" x2="15" y2="14"></line></svg>',
      file: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>',
      image: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>',
      video: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>',
      audio: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>',
      pdf: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M9 15v-2h6v2"></path><path d="M11 13v4"></path><path d="M13 13v4"></path></svg>',
      doc: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>',
      sheet: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="8" y1="13" x2="16" y2="13"></line><line x1="8" y1="17" x2="16" y2="17"></line><line x1="12" y1="9" x2="12" y2="21"></line></svg>',
      archive: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="22" height="5"></rect><line x1="10" y1="12" x2="14" y2="12"></line></svg>',
      upload: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>',
      download: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>',
      search: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>',
      grid: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>',
      list: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>',
      edit: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>',
      trash: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>',
      move: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="5 9 2 12 5 15"></polyline><polyline points="9 5 12 2 15 5"></polyline><polyline points="15 19 12 22 9 19"></polyline><polyline points="19 9 22 12 19 15"></polyline><line x1="2" y1="12" x2="22" y2="12"></line><line x1="12" y1="2" x2="12" y2="22"></line></svg>',
      link: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>',
      eye: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>',
      x: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',
      check: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>',
      home: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>',
      info: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>',
      lock: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>',
      play: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>'
    };
  }
}

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ShopifyDAM;
} else if (typeof window !== 'undefined') {
  window.ShopifyDAM = ShopifyDAM;
}
