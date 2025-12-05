/**
 * Digital Asset Management (DAM) Library
 * Handles file/folder operations with Shopify Files API integration
 * Access restricted to users with 'admin' or 'affiliate' tags
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class DAMManager {
  constructor(config = {}) {
    this.storagePath = config.storagePath || process.env.DAM_STORAGE_PATH || '/tmp/dam-data';
    this.metadataFile = path.join(this.storagePath, 'metadata.json');
    this.shopifyConfig = {
      shopDomain: config.shopDomain || process.env.SHOPIFY_SHOP_DOMAIN,
      accessToken: config.accessToken || process.env.SHOPIFY_ACCESS_TOKEN,
      apiVersion: '2024-01'
    };
    this.maxFileSize = config.maxFileSize || parseInt(process.env.MAX_FILE_SIZE) || 52428800; // 50MB
    this.allowedMimeTypes = config.allowedMimeTypes || [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
      'video/mp4', 'video/webm', 'video/quicktime',
      'application/pdf',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/zip', 'application/x-zip-compressed',
      'text/plain', 'text/csv'
    ];
    this.initialized = false;
  }

  /**
   * Initialize storage directory and metadata
   */
  async init() {
    if (this.initialized) return;

    try {
      await fs.mkdir(this.storagePath, { recursive: true });

      // Initialize metadata file if doesn't exist
      try {
        await fs.access(this.metadataFile);
      } catch {
        await this.saveMetadata({
          folders: {
            root: {
              id: 'root',
              name: 'My Files',
              parentId: null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              createdBy: 'system'
            }
          },
          files: {},
          tags: [],
          version: 1
        });
      }

      this.initialized = true;
    } catch (error) {
      console.error('DAM initialization error:', error);
      throw error;
    }
  }

  /**
   * Load metadata from file
   */
  async loadMetadata() {
    await this.init();
    try {
      const data = await fs.readFile(this.metadataFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error loading DAM metadata:', error);
      return { folders: {}, files: {}, tags: [], version: 1 };
    }
  }

  /**
   * Save metadata to file
   */
  async saveMetadata(metadata) {
    await fs.writeFile(this.metadataFile, JSON.stringify(metadata, null, 2), 'utf8');
  }

  /**
   * Generate unique ID
   */
  generateId(prefix = 'dam') {
    return `${prefix}_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Check if user has access to DAM
   * @param {Array} userTags - User's tags
   * @returns {boolean}
   */
  hasAccess(userTags = []) {
    const allowedTags = ['admin', 'affiliate', 'affiliates'];
    return userTags.some(tag => allowedTags.includes(tag.toLowerCase()));
  }

  /**
   * Check if user is admin
   * @param {Array} userTags - User's tags
   * @returns {boolean}
   */
  isAdmin(userTags = []) {
    return userTags.some(tag => tag.toLowerCase() === 'admin');
  }

  /**
   * Get file type category
   * @param {string} mimeType - MIME type
   * @returns {string}
   */
  getFileCategory(mimeType) {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType === 'application/pdf') return 'pdf';
    if (mimeType.includes('word') || mimeType.includes('document')) return 'document';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'spreadsheet';
    if (mimeType.includes('zip') || mimeType.includes('compressed')) return 'archive';
    return 'file';
  }

  /**
   * Get human readable file size
   * @param {number} bytes - File size in bytes
   * @returns {string}
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // ==================== FOLDER OPERATIONS ====================

  /**
   * Create a new folder
   * @param {Object} params - Folder parameters
   * @returns {Object} Created folder
   */
  async createFolder({ name, parentId = 'root', userEmail, userTags = [] }) {
    if (!this.hasAccess(userTags)) {
      throw new Error('Access denied: Requires admin or affiliate access');
    }

    const metadata = await this.loadMetadata();

    // Verify parent exists
    if (!metadata.folders[parentId]) {
      throw new Error('Parent folder not found');
    }

    // Check for duplicate name in parent
    const existingFolder = Object.values(metadata.folders).find(
      f => f.parentId === parentId && f.name.toLowerCase() === name.toLowerCase()
    );
    if (existingFolder) {
      throw new Error('A folder with this name already exists');
    }

    const folderId = this.generateId('folder');
    const folder = {
      id: folderId,
      name: name.trim(),
      parentId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: userEmail || 'unknown',
      color: null, // Optional folder color
      description: null
    };

    metadata.folders[folderId] = folder;
    await this.saveMetadata(metadata);

    return folder;
  }

  /**
   * Get folder by ID
   * @param {string} folderId - Folder ID
   * @returns {Object} Folder data
   */
  async getFolder(folderId) {
    const metadata = await this.loadMetadata();
    return metadata.folders[folderId] || null;
  }

  /**
   * Get folder contents (subfolders and files)
   * @param {string} folderId - Folder ID
   * @param {Object} options - Query options
   * @returns {Object} Folder contents
   */
  async getFolderContents(folderId = 'root', { userTags = [], sortBy = 'name', sortOrder = 'asc', search = '' } = {}) {
    if (!this.hasAccess(userTags)) {
      throw new Error('Access denied: Requires admin or affiliate access');
    }

    const metadata = await this.loadMetadata();
    const folder = metadata.folders[folderId];

    if (!folder) {
      throw new Error('Folder not found');
    }

    // Get subfolders
    let subfolders = Object.values(metadata.folders).filter(f => f.parentId === folderId);

    // Get files in folder
    let files = Object.values(metadata.files).filter(f => f.folderId === folderId);

    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      subfolders = subfolders.filter(f => f.name.toLowerCase().includes(searchLower));
      files = files.filter(f =>
        f.name.toLowerCase().includes(searchLower) ||
        (f.tags && f.tags.some(t => t.toLowerCase().includes(searchLower)))
      );
    }

    // Sort folders
    subfolders.sort((a, b) => {
      const aVal = a[sortBy] || a.name;
      const bVal = b[sortBy] || b.name;
      const comparison = String(aVal).localeCompare(String(bVal));
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    // Sort files
    files.sort((a, b) => {
      let aVal, bVal;
      if (sortBy === 'size') {
        aVal = a.size || 0;
        bVal = b.size || 0;
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }
      aVal = a[sortBy] || a.name;
      bVal = b[sortBy] || b.name;
      const comparison = String(aVal).localeCompare(String(bVal));
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    // Build breadcrumb path
    const breadcrumbs = await this.getBreadcrumbs(folderId);

    return {
      folder,
      subfolders,
      files,
      breadcrumbs,
      totalFolders: subfolders.length,
      totalFiles: files.length
    };
  }

  /**
   * Get breadcrumb path for a folder
   * @param {string} folderId - Folder ID
   * @returns {Array} Breadcrumb path
   */
  async getBreadcrumbs(folderId) {
    const metadata = await this.loadMetadata();
    const breadcrumbs = [];
    let currentId = folderId;

    while (currentId) {
      const folder = metadata.folders[currentId];
      if (!folder) break;
      breadcrumbs.unshift({ id: folder.id, name: folder.name });
      currentId = folder.parentId;
    }

    return breadcrumbs;
  }

  /**
   * Rename a folder
   * @param {string} folderId - Folder ID
   * @param {string} newName - New folder name
   * @param {Array} userTags - User tags
   * @returns {Object} Updated folder
   */
  async renameFolder(folderId, newName, userTags = []) {
    if (!this.hasAccess(userTags)) {
      throw new Error('Access denied: Requires admin or affiliate access');
    }

    if (folderId === 'root') {
      throw new Error('Cannot rename root folder');
    }

    const metadata = await this.loadMetadata();
    const folder = metadata.folders[folderId];

    if (!folder) {
      throw new Error('Folder not found');
    }

    // Check for duplicate name in parent
    const existingFolder = Object.values(metadata.folders).find(
      f => f.id !== folderId && f.parentId === folder.parentId && f.name.toLowerCase() === newName.toLowerCase()
    );
    if (existingFolder) {
      throw new Error('A folder with this name already exists');
    }

    folder.name = newName.trim();
    folder.updatedAt = new Date().toISOString();

    await this.saveMetadata(metadata);
    return folder;
  }

  /**
   * Move a folder to new parent
   * @param {string} folderId - Folder ID
   * @param {string} newParentId - New parent folder ID
   * @param {Array} userTags - User tags
   * @returns {Object} Updated folder
   */
  async moveFolder(folderId, newParentId, userTags = []) {
    if (!this.hasAccess(userTags)) {
      throw new Error('Access denied: Requires admin or affiliate access');
    }

    if (folderId === 'root') {
      throw new Error('Cannot move root folder');
    }

    const metadata = await this.loadMetadata();
    const folder = metadata.folders[folderId];
    const newParent = metadata.folders[newParentId];

    if (!folder) {
      throw new Error('Folder not found');
    }

    if (!newParent) {
      throw new Error('Destination folder not found');
    }

    // Prevent moving folder into itself or its descendants
    const descendants = await this.getFolderDescendants(folderId);
    if (descendants.includes(newParentId)) {
      throw new Error('Cannot move folder into its own subfolder');
    }

    folder.parentId = newParentId;
    folder.updatedAt = new Date().toISOString();

    await this.saveMetadata(metadata);
    return folder;
  }

  /**
   * Get all descendant folder IDs
   * @param {string} folderId - Folder ID
   * @returns {Array} Descendant folder IDs
   */
  async getFolderDescendants(folderId) {
    const metadata = await this.loadMetadata();
    const descendants = [];

    const findDescendants = (parentId) => {
      const children = Object.values(metadata.folders).filter(f => f.parentId === parentId);
      for (const child of children) {
        descendants.push(child.id);
        findDescendants(child.id);
      }
    };

    findDescendants(folderId);
    return descendants;
  }

  /**
   * Delete a folder and all its contents
   * @param {string} folderId - Folder ID
   * @param {Array} userTags - User tags
   * @returns {Object} Deletion result
   */
  async deleteFolder(folderId, userTags = []) {
    if (!this.hasAccess(userTags)) {
      throw new Error('Access denied: Requires admin or affiliate access');
    }

    if (folderId === 'root') {
      throw new Error('Cannot delete root folder');
    }

    const metadata = await this.loadMetadata();
    const folder = metadata.folders[folderId];

    if (!folder) {
      throw new Error('Folder not found');
    }

    // Get all descendants
    const descendants = await this.getFolderDescendants(folderId);
    const folderIds = [folderId, ...descendants];

    // Collect all files in these folders
    const filesToDelete = Object.values(metadata.files).filter(f => folderIds.includes(f.folderId));

    // Delete files from Shopify
    for (const file of filesToDelete) {
      try {
        await this.deleteFromShopify(file.shopifyFileId);
      } catch (error) {
        console.error(`Failed to delete Shopify file ${file.shopifyFileId}:`, error);
      }
      delete metadata.files[file.id];
    }

    // Delete folders
    for (const id of folderIds) {
      delete metadata.folders[id];
    }

    await this.saveMetadata(metadata);

    return {
      deletedFolders: folderIds.length,
      deletedFiles: filesToDelete.length
    };
  }

  /**
   * Update folder metadata (color, description)
   * @param {string} folderId - Folder ID
   * @param {Object} updates - Updates to apply
   * @param {Array} userTags - User tags
   * @returns {Object} Updated folder
   */
  async updateFolder(folderId, updates, userTags = []) {
    if (!this.hasAccess(userTags)) {
      throw new Error('Access denied: Requires admin or affiliate access');
    }

    const metadata = await this.loadMetadata();
    const folder = metadata.folders[folderId];

    if (!folder) {
      throw new Error('Folder not found');
    }

    const allowedUpdates = ['color', 'description'];
    for (const key of allowedUpdates) {
      if (updates[key] !== undefined) {
        folder[key] = updates[key];
      }
    }
    folder.updatedAt = new Date().toISOString();

    await this.saveMetadata(metadata);
    return folder;
  }

  // ==================== FILE OPERATIONS ====================

  /**
   * Upload file to Shopify and track in DAM
   * @param {Object} params - Upload parameters
   * @returns {Object} Uploaded file metadata
   */
  async uploadFile({ fileData, fileName, mimeType, folderId = 'root', userEmail, userTags = [], description = '', fileTags = [] }) {
    if (!this.hasAccess(userTags)) {
      throw new Error('Access denied: Requires admin or affiliate access');
    }

    // Validate MIME type
    if (!this.allowedMimeTypes.includes(mimeType)) {
      throw new Error(`File type not allowed: ${mimeType}`);
    }

    // Get file size
    const fileSize = Buffer.isBuffer(fileData) ? fileData.length : fileData.byteLength;

    // Validate file size
    if (fileSize > this.maxFileSize) {
      throw new Error(`File too large. Maximum size: ${this.formatFileSize(this.maxFileSize)}`);
    }

    const metadata = await this.loadMetadata();

    // Verify folder exists
    if (!metadata.folders[folderId]) {
      throw new Error('Destination folder not found');
    }

    // Upload to Shopify
    const shopifyResult = await this.uploadToShopify(fileData, fileName, mimeType);

    const fileId = this.generateId('file');
    const file = {
      id: fileId,
      name: fileName,
      originalName: fileName,
      mimeType,
      size: fileSize,
      sizeFormatted: this.formatFileSize(fileSize),
      category: this.getFileCategory(mimeType),
      folderId,
      shopifyFileId: shopifyResult.id,
      shopifyUrl: shopifyResult.url,
      previewUrl: shopifyResult.preview || shopifyResult.url,
      description,
      tags: fileTags,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: userEmail || 'unknown',
      downloads: 0,
      lastDownloaded: null
    };

    metadata.files[fileId] = file;
    await this.saveMetadata(metadata);

    return file;
  }

  /**
   * Upload file to Shopify Files API
   * @param {Buffer} fileData - File buffer
   * @param {string} fileName - File name
   * @param {string} mimeType - MIME type
   * @returns {Object} Shopify file data
   */
  async uploadToShopify(fileData, fileName, mimeType) {
    if (!this.shopifyConfig.shopDomain || !this.shopifyConfig.accessToken) {
      // Return mock data if Shopify not configured
      console.warn('Shopify not configured, using local storage fallback');
      const fileId = this.generateId('shopify');
      const localPath = path.join(this.storagePath, 'files', fileId);

      await fs.mkdir(path.join(this.storagePath, 'files'), { recursive: true });
      await fs.writeFile(localPath, fileData);

      return {
        id: fileId,
        url: `/api/dam?action=serve&fileId=${fileId}`,
        preview: `/api/dam?action=serve&fileId=${fileId}`
      };
    }

    try {
      // Step 1: Create staged upload target
      const stagedUploadQuery = `
        mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
          stagedUploadsCreate(input: $input) {
            stagedTargets {
              url
              resourceUrl
              parameters {
                name
                value
              }
            }
            userErrors {
              field
              message
            }
          }
        }
      `;

      const stagedResponse = await this.shopifyGraphQL(stagedUploadQuery, {
        input: [{
          filename: fileName,
          mimeType: mimeType,
          resource: this.getShopifyResourceType(mimeType),
          fileSize: fileData.length.toString()
        }]
      });

      if (stagedResponse.data?.stagedUploadsCreate?.userErrors?.length > 0) {
        throw new Error(stagedResponse.data.stagedUploadsCreate.userErrors[0].message);
      }

      const target = stagedResponse.data?.stagedUploadsCreate?.stagedTargets?.[0];
      if (!target) {
        throw new Error('Failed to create staged upload');
      }

      // Step 2: Upload to staged URL
      const FormData = require('form-data');
      const form = new FormData();

      // Add all parameters first
      for (const param of target.parameters) {
        form.append(param.name, param.value);
      }

      // Add file last
      form.append('file', fileData, { filename: fileName, contentType: mimeType });

      const https = require('https');
      const http = require('http');
      const urlModule = require('url');

      await new Promise((resolve, reject) => {
        const parsedUrl = urlModule.parse(target.url);
        const protocol = parsedUrl.protocol === 'https:' ? https : http;

        const req = protocol.request({
          hostname: parsedUrl.hostname,
          port: parsedUrl.port,
          path: parsedUrl.path,
          method: 'POST',
          headers: form.getHeaders()
        }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(data);
            } else {
              reject(new Error(`Upload failed: ${res.statusCode} ${data}`));
            }
          });
        });

        req.on('error', reject);
        form.pipe(req);
      });

      // Step 3: Create file in Shopify
      const createFileQuery = `
        mutation fileCreate($files: [FileCreateInput!]!) {
          fileCreate(files: $files) {
            files {
              id
              alt
              createdAt
              ... on MediaImage {
                id
                image {
                  url
                }
              }
              ... on Video {
                id
                sources {
                  url
                }
              }
              ... on GenericFile {
                id
                url
              }
            }
            userErrors {
              field
              message
            }
          }
        }
      `;

      const createResponse = await this.shopifyGraphQL(createFileQuery, {
        files: [{
          originalSource: target.resourceUrl,
          alt: fileName,
          contentType: this.getShopifyContentType(mimeType)
        }]
      });

      if (createResponse.data?.fileCreate?.userErrors?.length > 0) {
        throw new Error(createResponse.data.fileCreate.userErrors[0].message);
      }

      const file = createResponse.data?.fileCreate?.files?.[0];
      if (!file) {
        throw new Error('Failed to create file in Shopify');
      }

      // Extract URL based on file type
      let fileUrl = '';
      if (file.image?.url) {
        fileUrl = file.image.url;
      } else if (file.sources?.[0]?.url) {
        fileUrl = file.sources[0].url;
      } else if (file.url) {
        fileUrl = file.url;
      }

      return {
        id: file.id,
        url: fileUrl,
        preview: fileUrl
      };
    } catch (error) {
      console.error('Shopify upload error:', error);
      throw new Error(`Failed to upload to Shopify: ${error.message}`);
    }
  }

  /**
   * Get Shopify resource type from MIME type
   */
  getShopifyResourceType(mimeType) {
    if (mimeType.startsWith('image/')) return 'IMAGE';
    if (mimeType.startsWith('video/')) return 'VIDEO';
    return 'FILE';
  }

  /**
   * Get Shopify content type from MIME type
   */
  getShopifyContentType(mimeType) {
    if (mimeType.startsWith('image/')) return 'IMAGE';
    if (mimeType.startsWith('video/')) return 'VIDEO';
    return 'FILE';
  }

  /**
   * Execute Shopify GraphQL query
   */
  async shopifyGraphQL(query, variables = {}) {
    const https = require('https');
    const url = `https://${this.shopifyConfig.shopDomain}/admin/api/${this.shopifyConfig.apiVersion}/graphql.json`;

    return new Promise((resolve, reject) => {
      const postData = JSON.stringify({ query, variables });

      const req = https.request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': this.shopifyConfig.accessToken,
          'Content-Length': Buffer.byteLength(postData)
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error('Invalid JSON response from Shopify'));
          }
        });
      });

      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  }

  /**
   * Delete file from Shopify
   */
  async deleteFromShopify(shopifyFileId) {
    if (!this.shopifyConfig.shopDomain || !this.shopifyConfig.accessToken) {
      // Local storage fallback - delete local file
      try {
        const localPath = path.join(this.storagePath, 'files', shopifyFileId);
        await fs.unlink(localPath);
      } catch (error) {
        console.warn('Local file deletion failed:', error);
      }
      return;
    }

    const deleteQuery = `
      mutation fileDelete($input: FileDeleteInput!) {
        fileDelete(input: $input) {
          deletedFileIds
          userErrors {
            field
            message
          }
        }
      }
    `;

    try {
      await this.shopifyGraphQL(deleteQuery, {
        input: { fileIds: [shopifyFileId] }
      });
    } catch (error) {
      console.error('Shopify delete error:', error);
    }
  }

  /**
   * Get file by ID
   * @param {string} fileId - File ID
   * @param {Array} userTags - User tags
   * @returns {Object} File metadata
   */
  async getFile(fileId, userTags = []) {
    if (!this.hasAccess(userTags)) {
      throw new Error('Access denied: Requires admin or affiliate access');
    }

    const metadata = await this.loadMetadata();
    const file = metadata.files[fileId];

    if (!file) {
      throw new Error('File not found');
    }

    return file;
  }

  /**
   * Rename a file
   * @param {string} fileId - File ID
   * @param {string} newName - New file name
   * @param {Array} userTags - User tags
   * @returns {Object} Updated file
   */
  async renameFile(fileId, newName, userTags = []) {
    if (!this.hasAccess(userTags)) {
      throw new Error('Access denied: Requires admin or affiliate access');
    }

    const metadata = await this.loadMetadata();
    const file = metadata.files[fileId];

    if (!file) {
      throw new Error('File not found');
    }

    file.name = newName.trim();
    file.updatedAt = new Date().toISOString();

    await this.saveMetadata(metadata);
    return file;
  }

  /**
   * Move file to different folder
   * @param {string} fileId - File ID
   * @param {string} newFolderId - Destination folder ID
   * @param {Array} userTags - User tags
   * @returns {Object} Updated file
   */
  async moveFile(fileId, newFolderId, userTags = []) {
    if (!this.hasAccess(userTags)) {
      throw new Error('Access denied: Requires admin or affiliate access');
    }

    const metadata = await this.loadMetadata();
    const file = metadata.files[fileId];

    if (!file) {
      throw new Error('File not found');
    }

    if (!metadata.folders[newFolderId]) {
      throw new Error('Destination folder not found');
    }

    file.folderId = newFolderId;
    file.updatedAt = new Date().toISOString();

    await this.saveMetadata(metadata);
    return file;
  }

  /**
   * Update file metadata
   * @param {string} fileId - File ID
   * @param {Object} updates - Updates to apply
   * @param {Array} userTags - User tags
   * @returns {Object} Updated file
   */
  async updateFile(fileId, updates, userTags = []) {
    if (!this.hasAccess(userTags)) {
      throw new Error('Access denied: Requires admin or affiliate access');
    }

    const metadata = await this.loadMetadata();
    const file = metadata.files[fileId];

    if (!file) {
      throw new Error('File not found');
    }

    const allowedUpdates = ['description', 'tags'];
    for (const key of allowedUpdates) {
      if (updates[key] !== undefined) {
        file[key] = updates[key];
      }
    }
    file.updatedAt = new Date().toISOString();

    await this.saveMetadata(metadata);
    return file;
  }

  /**
   * Delete a file
   * @param {string} fileId - File ID
   * @param {Array} userTags - User tags
   * @returns {Object} Deletion result
   */
  async deleteFile(fileId, userTags = []) {
    if (!this.hasAccess(userTags)) {
      throw new Error('Access denied: Requires admin or affiliate access');
    }

    const metadata = await this.loadMetadata();
    const file = metadata.files[fileId];

    if (!file) {
      throw new Error('File not found');
    }

    // Delete from Shopify
    await this.deleteFromShopify(file.shopifyFileId);

    delete metadata.files[fileId];
    await this.saveMetadata(metadata);

    return { success: true, deletedFile: file };
  }

  /**
   * Record file download
   * @param {string} fileId - File ID
   * @returns {Object} Updated file
   */
  async recordDownload(fileId) {
    const metadata = await this.loadMetadata();
    const file = metadata.files[fileId];

    if (file) {
      file.downloads = (file.downloads || 0) + 1;
      file.lastDownloaded = new Date().toISOString();
      await this.saveMetadata(metadata);
    }

    return file;
  }

  // ==================== SEARCH & FILTERING ====================

  /**
   * Search files and folders
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Object} Search results
   */
  async search(query, { userTags = [], fileTypes = [], folderId = null, limit = 50 } = {}) {
    if (!this.hasAccess(userTags)) {
      throw new Error('Access denied: Requires admin or affiliate access');
    }

    const metadata = await this.loadMetadata();
    const queryLower = query.toLowerCase();

    // Search folders
    let folders = Object.values(metadata.folders).filter(f =>
      f.id !== 'root' && f.name.toLowerCase().includes(queryLower)
    );

    // Search files
    let files = Object.values(metadata.files).filter(f => {
      const matchesQuery =
        f.name.toLowerCase().includes(queryLower) ||
        (f.description && f.description.toLowerCase().includes(queryLower)) ||
        (f.tags && f.tags.some(t => t.toLowerCase().includes(queryLower)));

      const matchesType = fileTypes.length === 0 || fileTypes.includes(f.category);
      const matchesFolder = !folderId || f.folderId === folderId;

      return matchesQuery && matchesType && matchesFolder;
    });

    // Sort by relevance (exact matches first)
    const sortByRelevance = (items, nameField = 'name') => {
      return items.sort((a, b) => {
        const aExact = a[nameField].toLowerCase() === queryLower;
        const bExact = b[nameField].toLowerCase() === queryLower;
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        const aStarts = a[nameField].toLowerCase().startsWith(queryLower);
        const bStarts = b[nameField].toLowerCase().startsWith(queryLower);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return a[nameField].localeCompare(b[nameField]);
      });
    };

    folders = sortByRelevance(folders).slice(0, limit);
    files = sortByRelevance(files).slice(0, limit);

    return {
      query,
      folders,
      files,
      totalFolders: folders.length,
      totalFiles: files.length
    };
  }

  /**
   * Get all files of specific type(s)
   * @param {Array} categories - File categories to filter
   * @param {Array} userTags - User tags
   * @returns {Array} Matching files
   */
  async getFilesByCategory(categories, userTags = []) {
    if (!this.hasAccess(userTags)) {
      throw new Error('Access denied: Requires admin or affiliate access');
    }

    const metadata = await this.loadMetadata();
    return Object.values(metadata.files).filter(f => categories.includes(f.category));
  }

  /**
   * Get recently modified files
   * @param {number} limit - Number of files to return
   * @param {Array} userTags - User tags
   * @returns {Array} Recent files
   */
  async getRecentFiles(limit = 20, userTags = []) {
    if (!this.hasAccess(userTags)) {
      throw new Error('Access denied: Requires admin or affiliate access');
    }

    const metadata = await this.loadMetadata();
    return Object.values(metadata.files)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .slice(0, limit);
  }

  // ==================== STATISTICS ====================

  /**
   * Get DAM statistics
   * @param {Array} userTags - User tags
   * @returns {Object} Statistics
   */
  async getStatistics(userTags = []) {
    if (!this.hasAccess(userTags)) {
      throw new Error('Access denied: Requires admin or affiliate access');
    }

    const metadata = await this.loadMetadata();
    const files = Object.values(metadata.files);
    const folders = Object.values(metadata.folders);

    const totalSize = files.reduce((sum, f) => sum + (f.size || 0), 0);
    const categoryCounts = {};

    for (const file of files) {
      const cat = file.category || 'file';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    }

    return {
      totalFiles: files.length,
      totalFolders: folders.length - 1, // Exclude root
      totalSize,
      totalSizeFormatted: this.formatFileSize(totalSize),
      categoryCounts,
      totalDownloads: files.reduce((sum, f) => sum + (f.downloads || 0), 0),
      recentActivity: files
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
        .slice(0, 5)
        .map(f => ({ id: f.id, name: f.name, action: 'modified', date: f.updatedAt }))
    };
  }

  /**
   * Get folder tree structure
   * @param {Array} userTags - User tags
   * @returns {Object} Folder tree
   */
  async getFolderTree(userTags = []) {
    if (!this.hasAccess(userTags)) {
      throw new Error('Access denied: Requires admin or affiliate access');
    }

    const metadata = await this.loadMetadata();

    const buildTree = (parentId) => {
      const children = Object.values(metadata.folders)
        .filter(f => f.parentId === parentId)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(folder => ({
          ...folder,
          fileCount: Object.values(metadata.files).filter(f => f.folderId === folder.id).length,
          children: buildTree(folder.id)
        }));
      return children;
    };

    const root = metadata.folders['root'];
    return {
      ...root,
      fileCount: Object.values(metadata.files).filter(f => f.folderId === 'root').length,
      children: buildTree('root')
    };
  }

  /**
   * Serve local file (fallback when Shopify not configured)
   * @param {string} shopifyFileId - Local file ID
   * @returns {Object} File data and content type
   */
  async serveLocalFile(shopifyFileId) {
    const localPath = path.join(this.storagePath, 'files', shopifyFileId);
    const fileData = await fs.readFile(localPath);
    return { data: fileData };
  }
}

module.exports = DAMManager;
