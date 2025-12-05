/**
 * Digital Asset Management (DAM) Service
 *
 * Handles file storage, folder management, and Shopify Files API integration
 * for the DAM component.
 *
 * Features:
 * - Virtual folder structure (stored in JSON)
 * - File upload to Shopify CDN via Files API
 * - File metadata management
 * - Search functionality
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class DAMService {
  constructor() {
    this.initialized = false;
    this.dataPath = process.env.DAM_DATA_PATH || '/tmp/dam-data';
    this.foldersFile = 'folders.json';
    this.filesFile = 'files.json';

    // Shopify configuration
    this.shopDomain = process.env.SHOPIFY_STORE_DOMAIN;
    this.accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
    this.apiVersion = process.env.SHOPIFY_API_VERSION || '2024-01';

    // In-memory cache
    this.folders = [];
    this.files = [];
  }

  /**
   * Initialize the DAM service
   */
  async init() {
    if (this.initialized) return;

    try {
      // Ensure data directory exists
      await fs.mkdir(this.dataPath, { recursive: true });

      // Load existing data
      await this.loadData();

      // Create root folder if it doesn't exist
      if (!this.folders.find(f => f.path === '/')) {
        this.folders.push({
          id: this.generateId(),
          name: 'Root',
          path: '/',
          parentPath: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: 'system'
        });
        await this.saveData();
      }

      this.initialized = true;
    } catch (error) {
      console.error('DAM Service initialization error:', error);
      // Continue with empty data on error
      this.folders = [{
        id: this.generateId(),
        name: 'Root',
        path: '/',
        parentPath: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'system'
      }];
      this.files = [];
      this.initialized = true;
    }
  }

  /**
   * Load data from storage
   */
  async loadData() {
    try {
      const foldersPath = path.join(this.dataPath, this.foldersFile);
      const filesPath = path.join(this.dataPath, this.filesFile);

      try {
        const foldersData = await fs.readFile(foldersPath, 'utf8');
        this.folders = JSON.parse(foldersData);
      } catch (e) {
        this.folders = [];
      }

      try {
        const filesData = await fs.readFile(filesPath, 'utf8');
        this.files = JSON.parse(filesData);
      } catch (e) {
        this.files = [];
      }
    } catch (error) {
      console.error('Load data error:', error);
      this.folders = [];
      this.files = [];
    }
  }

  /**
   * Save data to storage
   */
  async saveData() {
    try {
      const foldersPath = path.join(this.dataPath, this.foldersFile);
      const filesPath = path.join(this.dataPath, this.filesFile);

      await fs.writeFile(foldersPath, JSON.stringify(this.folders, null, 2));
      await fs.writeFile(filesPath, JSON.stringify(this.files, null, 2));
    } catch (error) {
      console.error('Save data error:', error);
    }
  }

  /**
   * Generate unique ID
   */
  generateId() {
    return 'dam_' + crypto.randomBytes(8).toString('hex');
  }

  /**
   * Normalize path
   */
  normalizePath(inputPath) {
    let normalized = inputPath || '/';

    // Ensure starts with /
    if (!normalized.startsWith('/')) {
      normalized = '/' + normalized;
    }

    // Ensure ends with / (except for root)
    if (normalized !== '/' && !normalized.endsWith('/')) {
      normalized = normalized + '/';
    }

    // Remove double slashes
    normalized = normalized.replace(/\/+/g, '/');

    return normalized;
  }

  /**
   * List folder contents
   */
  async listFolder(folderPath) {
    const normalizedPath = this.normalizePath(folderPath);

    // Get subfolders
    const subfolders = this.folders.filter(f =>
      f.parentPath === normalizedPath
    ).map(f => ({
      ...f,
      itemCount: this.countFolderItems(f.path)
    }));

    // Get files in this folder
    const folderFiles = this.files.filter(f =>
      f.folderPath === normalizedPath
    );

    return {
      path: normalizedPath,
      folders: subfolders,
      files: folderFiles
    };
  }

  /**
   * Count items in a folder
   */
  countFolderItems(folderPath) {
    const subfolders = this.folders.filter(f => f.parentPath === folderPath).length;
    const files = this.files.filter(f => f.folderPath === folderPath).length;
    return subfolders + files;
  }

  /**
   * Create a new folder
   */
  async createFolder(name, parentPath, createdBy) {
    const normalizedParent = this.normalizePath(parentPath);
    const folderPath = normalizedParent + name + '/';

    // Check if folder already exists
    if (this.folders.find(f => f.path === folderPath)) {
      throw new Error('Folder already exists');
    }

    // Verify parent folder exists
    if (normalizedParent !== '/' && !this.folders.find(f => f.path === normalizedParent)) {
      throw new Error('Parent folder not found');
    }

    const folder = {
      id: this.generateId(),
      name: name,
      path: folderPath,
      parentPath: normalizedParent,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: createdBy
    };

    this.folders.push(folder);
    await this.saveData();

    return folder;
  }

  /**
   * Upload a file
   */
  async uploadFile(file, folderPath, uploadedBy) {
    const normalizedPath = this.normalizePath(folderPath);

    // Verify folder exists
    if (normalizedPath !== '/' && !this.folders.find(f => f.path === normalizedPath)) {
      throw new Error('Folder not found');
    }

    // Generate unique filename if needed
    let filename = file.name;
    let counter = 1;
    while (this.files.find(f => f.folderPath === normalizedPath && f.name === filename)) {
      const ext = path.extname(file.name);
      const base = path.basename(file.name, ext);
      filename = `${base} (${counter})${ext}`;
      counter++;
    }

    // Upload to Shopify Files API if configured
    let shopifyFile = null;
    if (this.shopDomain && this.accessToken) {
      shopifyFile = await this.uploadToShopify(file);
    }

    // Create file record
    const fileRecord = {
      id: this.generateId(),
      name: filename,
      originalName: file.name,
      type: file.type,
      size: file.size,
      folderPath: normalizedPath,
      url: shopifyFile?.url || this.createDataUrl(file),
      thumbnailUrl: shopifyFile?.thumbnailUrl || (file.type.startsWith('image/') ? (shopifyFile?.url || this.createDataUrl(file)) : null),
      shopifyFileId: shopifyFile?.id || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      uploadedBy: uploadedBy
    };

    this.files.push(fileRecord);
    await this.saveData();

    return fileRecord;
  }

  /**
   * Upload file to Shopify Files API
   */
  async uploadToShopify(file) {
    if (!this.shopDomain || !this.accessToken) {
      return null;
    }

    try {
      // Step 1: Create staged upload
      const stageResponse = await this.graphqlRequest(`
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
      `, {
        input: [{
          filename: file.name,
          mimeType: file.type,
          httpMethod: 'POST',
          resource: this.getShopifyFileType(file.type)
        }]
      });

      const stagedTarget = stageResponse?.data?.stagedUploadsCreate?.stagedTargets?.[0];
      if (!stagedTarget) {
        console.error('Failed to create staged upload');
        return null;
      }

      // Step 2: Upload to staged URL
      const formData = new URLSearchParams();
      for (const param of stagedTarget.parameters) {
        formData.append(param.name, param.value);
      }

      // Create form boundary manually for binary upload
      const boundary = '----FormBoundary' + crypto.randomBytes(16).toString('hex');
      let body = '';

      // Add parameters
      for (const param of stagedTarget.parameters) {
        body += `--${boundary}\r\n`;
        body += `Content-Disposition: form-data; name="${param.name}"\r\n\r\n`;
        body += `${param.value}\r\n`;
      }

      // Add file
      body += `--${boundary}\r\n`;
      body += `Content-Disposition: form-data; name="file"; filename="${file.name}"\r\n`;
      body += `Content-Type: ${file.type}\r\n\r\n`;

      const bodyBuffer = Buffer.concat([
        Buffer.from(body, 'utf8'),
        file.data,
        Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8')
      ]);

      const uploadResponse = await fetch(stagedTarget.url, {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': bodyBuffer.length.toString()
        },
        body: bodyBuffer
      });

      if (!uploadResponse.ok) {
        console.error('Upload to staged URL failed:', await uploadResponse.text());
        return null;
      }

      // Step 3: Create file in Shopify
      const createResponse = await this.graphqlRequest(`
        mutation fileCreate($files: [FileCreateInput!]!) {
          fileCreate(files: $files) {
            files {
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
      `, {
        files: [{
          originalSource: stagedTarget.resourceUrl,
          contentType: this.getShopifyFileType(file.type)
        }]
      });

      const createdFile = createResponse?.data?.fileCreate?.files?.[0];
      if (!createdFile) {
        console.error('Failed to create file in Shopify');
        return null;
      }

      // Extract URL based on file type
      let url = null;
      if (createdFile.image?.url) {
        url = createdFile.image.url;
      } else if (createdFile.sources?.[0]?.url) {
        url = createdFile.sources[0].url;
      } else if (createdFile.url) {
        url = createdFile.url;
      }

      return {
        id: createdFile.id,
        url: url,
        thumbnailUrl: url
      };
    } catch (error) {
      console.error('Shopify upload error:', error);
      return null;
    }
  }

  /**
   * Make GraphQL request to Shopify
   */
  async graphqlRequest(query, variables = {}) {
    try {
      const response = await fetch(`https://${this.shopDomain}/admin/api/${this.apiVersion}/graphql.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': this.accessToken
        },
        body: JSON.stringify({ query, variables })
      });

      if (!response.ok) {
        throw new Error(`Shopify API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('GraphQL request error:', error);
      throw error;
    }
  }

  /**
   * Get Shopify file type from MIME type
   */
  getShopifyFileType(mimeType) {
    if (mimeType.startsWith('image/')) return 'IMAGE';
    if (mimeType.startsWith('video/')) return 'VIDEO';
    return 'FILE';
  }

  /**
   * Create data URL for local storage fallback
   */
  createDataUrl(file) {
    // For serverless environments, we can't persist file data
    // This creates a temporary data URL
    if (file.data) {
      return `data:${file.type};base64,${file.data.toString('base64')}`;
    }
    return null;
  }

  /**
   * Rename an item (file or folder)
   */
  async renameItem(id, newName, isFolder, renamedBy) {
    if (isFolder) {
      const folderIndex = this.folders.findIndex(f => f.id === id);
      if (folderIndex === -1) {
        throw new Error('Folder not found');
      }

      const folder = this.folders[folderIndex];
      const oldPath = folder.path;
      const newPath = folder.parentPath + newName + '/';

      // Check if new path already exists
      if (this.folders.find(f => f.path === newPath && f.id !== id)) {
        throw new Error('A folder with this name already exists');
      }

      // Update folder
      folder.name = newName;
      folder.path = newPath;
      folder.updatedAt = new Date().toISOString();

      // Update all nested folders
      for (const nested of this.folders) {
        if (nested.path.startsWith(oldPath) && nested.id !== id) {
          nested.path = nested.path.replace(oldPath, newPath);
          if (nested.parentPath.startsWith(oldPath)) {
            nested.parentPath = nested.parentPath.replace(oldPath, newPath);
          }
        }
      }

      // Update files in nested folders
      for (const file of this.files) {
        if (file.folderPath.startsWith(oldPath)) {
          file.folderPath = file.folderPath.replace(oldPath, newPath);
        }
      }

      await this.saveData();
      return folder;
    } else {
      const fileIndex = this.files.findIndex(f => f.id === id);
      if (fileIndex === -1) {
        throw new Error('File not found');
      }

      const file = this.files[fileIndex];

      // Check if name already exists in folder
      if (this.files.find(f => f.folderPath === file.folderPath && f.name === newName && f.id !== id)) {
        throw new Error('A file with this name already exists');
      }

      file.name = newName;
      file.updatedAt = new Date().toISOString();

      await this.saveData();
      return file;
    }
  }

  /**
   * Move items to a new location
   */
  async moveItems(items, destination, movedBy) {
    const normalizedDest = this.normalizePath(destination);

    // Verify destination exists
    if (normalizedDest !== '/' && !this.folders.find(f => f.path === normalizedDest)) {
      throw new Error('Destination folder not found');
    }

    const results = [];

    for (const item of items) {
      if (item.isFolder) {
        const folder = this.folders.find(f => f.id === item.id);
        if (!folder) continue;

        // Prevent moving folder into itself
        if (normalizedDest.startsWith(folder.path)) {
          throw new Error('Cannot move folder into itself');
        }

        const oldPath = folder.path;
        const newPath = normalizedDest + folder.name + '/';

        // Check for conflicts
        if (this.folders.find(f => f.path === newPath && f.id !== folder.id)) {
          throw new Error(`Folder "${folder.name}" already exists at destination`);
        }

        // Update folder
        folder.parentPath = normalizedDest;
        folder.path = newPath;
        folder.updatedAt = new Date().toISOString();

        // Update nested items
        for (const nested of this.folders) {
          if (nested.path.startsWith(oldPath) && nested.id !== folder.id) {
            nested.path = nested.path.replace(oldPath, newPath);
            nested.parentPath = nested.parentPath.replace(oldPath, newPath);
          }
        }

        for (const file of this.files) {
          if (file.folderPath.startsWith(oldPath)) {
            file.folderPath = file.folderPath.replace(oldPath, newPath);
          }
        }

        results.push(folder);
      } else {
        const file = this.files.find(f => f.id === item.id);
        if (!file) continue;

        // Check for conflicts
        if (this.files.find(f => f.folderPath === normalizedDest && f.name === file.name && f.id !== file.id)) {
          throw new Error(`File "${file.name}" already exists at destination`);
        }

        file.folderPath = normalizedDest;
        file.updatedAt = new Date().toISOString();

        results.push(file);
      }
    }

    await this.saveData();
    return { moved: results.length, items: results };
  }

  /**
   * Delete items
   */
  async deleteItems(items, deletedBy) {
    const deleted = [];

    for (const item of items) {
      if (item.isFolder) {
        const folder = this.folders.find(f => f.id === item.id);
        if (!folder || folder.path === '/') continue;

        // Delete all nested folders
        this.folders = this.folders.filter(f =>
          !f.path.startsWith(folder.path)
        );

        // Delete all files in nested folders
        const deletedFiles = this.files.filter(f =>
          f.folderPath.startsWith(folder.path)
        );

        // Delete files from Shopify
        for (const file of deletedFiles) {
          if (file.shopifyFileId) {
            await this.deleteFromShopify(file.shopifyFileId);
          }
        }

        this.files = this.files.filter(f =>
          !f.folderPath.startsWith(folder.path)
        );

        deleted.push({ type: 'folder', ...folder });
      } else {
        const fileIndex = this.files.findIndex(f => f.id === item.id);
        if (fileIndex === -1) continue;

        const file = this.files[fileIndex];

        // Delete from Shopify
        if (file.shopifyFileId) {
          await this.deleteFromShopify(file.shopifyFileId);
        }

        this.files.splice(fileIndex, 1);
        deleted.push({ type: 'file', ...file });
      }
    }

    await this.saveData();
    return { deleted: deleted.length, items: deleted };
  }

  /**
   * Delete file from Shopify
   */
  async deleteFromShopify(fileId) {
    if (!this.shopDomain || !this.accessToken) {
      return;
    }

    try {
      await this.graphqlRequest(`
        mutation fileDelete($fileIds: [ID!]!) {
          fileDelete(fileIds: $fileIds) {
            deletedFileIds
            userErrors {
              field
              message
            }
          }
        }
      `, {
        fileIds: [fileId]
      });
    } catch (error) {
      console.error('Shopify delete error:', error);
    }
  }

  /**
   * Paste items (copy or cut)
   */
  async pasteItems(items, action, destination, pastedBy) {
    const normalizedDest = this.normalizePath(destination);

    // Verify destination exists
    if (normalizedDest !== '/' && !this.folders.find(f => f.path === normalizedDest)) {
      throw new Error('Destination folder not found');
    }

    const results = [];

    for (const item of items) {
      if (item.isFolder) {
        const sourceFolder = this.folders.find(f => f.id === item.id);
        if (!sourceFolder) continue;

        if (action === 'copy') {
          // Deep copy folder and contents
          const copied = await this.deepCopyFolder(sourceFolder, normalizedDest, pastedBy);
          results.push(...copied);
        } else {
          // Move
          const moved = await this.moveItems([item], destination, pastedBy);
          results.push(...(moved.items || []));
        }
      } else {
        const sourceFile = this.files.find(f => f.id === item.id);
        if (!sourceFile) continue;

        if (action === 'copy') {
          // Copy file
          const newFile = {
            ...sourceFile,
            id: this.generateId(),
            name: this.getUniqueName(sourceFile.name, normalizedDest, false),
            folderPath: normalizedDest,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            uploadedBy: pastedBy
          };
          this.files.push(newFile);
          results.push(newFile);
        } else {
          // Move
          const moved = await this.moveItems([item], destination, pastedBy);
          results.push(...(moved.items || []));
        }
      }
    }

    await this.saveData();
    return { pasted: results.length, items: results };
  }

  /**
   * Deep copy a folder and its contents
   */
  async deepCopyFolder(sourceFolder, destinationPath, copiedBy) {
    const results = [];
    const pathMapping = {};

    // Create new folder at destination
    const newFolderName = this.getUniqueName(sourceFolder.name, destinationPath, true);
    const newFolder = {
      ...sourceFolder,
      id: this.generateId(),
      name: newFolderName,
      path: destinationPath + newFolderName + '/',
      parentPath: destinationPath,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: copiedBy
    };

    this.folders.push(newFolder);
    results.push(newFolder);
    pathMapping[sourceFolder.path] = newFolder.path;

    // Copy nested folders
    const nestedFolders = this.folders.filter(f =>
      f.path.startsWith(sourceFolder.path) && f.id !== sourceFolder.id
    ).sort((a, b) => a.path.length - b.path.length);

    for (const nested of nestedFolders) {
      const parentMapping = Object.entries(pathMapping)
        .find(([old]) => nested.parentPath === old);

      const newParentPath = parentMapping ? parentMapping[1] : newFolder.path;
      const newNestedFolder = {
        ...nested,
        id: this.generateId(),
        path: newParentPath + nested.name + '/',
        parentPath: newParentPath,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: copiedBy
      };

      this.folders.push(newNestedFolder);
      results.push(newNestedFolder);
      pathMapping[nested.path] = newNestedFolder.path;
    }

    // Copy files
    const nestedFiles = this.files.filter(f =>
      f.folderPath.startsWith(sourceFolder.path)
    );

    for (const file of nestedFiles) {
      const newFolderPath = pathMapping[file.folderPath] || newFolder.path;
      const newFile = {
        ...file,
        id: this.generateId(),
        folderPath: newFolderPath,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        uploadedBy: copiedBy
      };

      this.files.push(newFile);
      results.push(newFile);
    }

    return results;
  }

  /**
   * Get unique name for copy
   */
  getUniqueName(name, folderPath, isFolder) {
    const collection = isFolder ? this.folders : this.files;
    const existing = collection.filter(item =>
      isFolder ? item.parentPath === folderPath : item.folderPath === folderPath
    );

    let newName = name;
    let counter = 1;

    while (existing.find(item => item.name === newName)) {
      if (isFolder) {
        newName = `${name} (${counter})`;
      } else {
        const ext = path.extname(name);
        const base = path.basename(name, ext);
        newName = `${base} (${counter})${ext}`;
      }
      counter++;
    }

    return newName;
  }

  /**
   * Search files and folders
   */
  async search(query) {
    const lowerQuery = query.toLowerCase();

    const matchingFolders = this.folders.filter(f =>
      f.path !== '/' && f.name.toLowerCase().includes(lowerQuery)
    ).map(f => ({
      ...f,
      itemCount: this.countFolderItems(f.path)
    }));

    const matchingFiles = this.files.filter(f =>
      f.name.toLowerCase().includes(lowerQuery)
    );

    return {
      query,
      folders: matchingFolders,
      files: matchingFiles,
      totalResults: matchingFolders.length + matchingFiles.length
    };
  }

  /**
   * Get single file by ID
   */
  async getFile(id) {
    return this.files.find(f => f.id === id) || null;
  }

  /**
   * Get single folder by ID
   */
  async getFolder(id) {
    return this.folders.find(f => f.id === id) || null;
  }

  /**
   * Get all files (for admin purposes)
   */
  async getAllFiles() {
    return this.files;
  }

  /**
   * Get all folders (for admin purposes)
   */
  async getAllFolders() {
    return this.folders;
  }

  /**
   * Get storage statistics
   */
  async getStats() {
    const totalFiles = this.files.length;
    const totalFolders = this.folders.length - 1; // Exclude root
    const totalSize = this.files.reduce((acc, f) => acc + (f.size || 0), 0);

    const filesByType = {};
    for (const file of this.files) {
      const category = this.getFileCategory(file.type);
      filesByType[category] = (filesByType[category] || 0) + 1;
    }

    return {
      totalFiles,
      totalFolders,
      totalSize,
      filesByType
    };
  }

  /**
   * Get file category from MIME type
   */
  getFileCategory(mimeType) {
    if (!mimeType) return 'other';
    if (mimeType.startsWith('image/')) return 'images';
    if (mimeType.startsWith('video/')) return 'videos';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType === 'application/pdf') return 'documents';
    if (mimeType.includes('word') || mimeType.includes('document')) return 'documents';
    if (mimeType.includes('sheet') || mimeType.includes('excel')) return 'spreadsheets';
    if (mimeType.includes('zip') || mimeType.includes('rar')) return 'archives';
    return 'other';
  }
}

// Export singleton instance
module.exports = new DAMService();
