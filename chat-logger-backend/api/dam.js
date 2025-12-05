/**
 * Digital Asset Management (DAM) API Endpoint
 * Handles all DAM operations for file and folder management
 *
 * Access restricted to users with 'admin' or 'affiliate' tags
 */

const DAMManager = require('../lib/dam');
const RateLimiter = require('../lib/rate-limiter');
const multiparty = require('multiparty');

// Initialize DAM and rate limiter
const dam = new DAMManager();
const rateLimiter = new RateLimiter();

// Parse multipart form data
function parseFormData(req) {
  return new Promise((resolve, reject) => {
    const form = new multiparty.Form({
      maxFilesSize: 52428800, // 50MB
    });

    form.parse(req, (err, fields, files) => {
      if (err) {
        reject(err);
      } else {
        // Convert fields arrays to single values
        const parsedFields = {};
        for (const [key, value] of Object.entries(fields)) {
          parsedFields[key] = Array.isArray(value) && value.length === 1 ? value[0] : value;
        }
        resolve({ fields: parsedFields, files });
      }
    });
  });
}

// Helper to send JSON response
function sendResponse(res, statusCode, data) {
  res.status(statusCode);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  return res.json(data);
}

// Parse user tags from request
function parseUserTags(tagsInput) {
  if (!tagsInput) return [];
  if (Array.isArray(tagsInput)) return tagsInput;
  try {
    return JSON.parse(tagsInput);
  } catch {
    return tagsInput.split(',').map(t => t.trim()).filter(Boolean);
  }
}

// ==================== REQUEST HANDLERS ====================

/**
 * Handle folder contents request
 */
async function handleGetContents(req, res) {
  const { folderId = 'root', sortBy, sortOrder, search } = req.query;
  const userTags = parseUserTags(req.query.userTags);

  try {
    const contents = await dam.getFolderContents(folderId, {
      userTags,
      sortBy,
      sortOrder,
      search
    });

    return sendResponse(res, 200, { success: true, ...contents });
  } catch (error) {
    return sendResponse(res, error.message.includes('Access denied') ? 403 : 400, {
      success: false,
      error: error.message
    });
  }
}

/**
 * Handle create folder request
 */
async function handleCreateFolder(req, res) {
  const { name, parentId, userEmail } = req.body;
  const userTags = parseUserTags(req.body.userTags);

  if (!name) {
    return sendResponse(res, 400, { success: false, error: 'Folder name is required' });
  }

  try {
    const folder = await dam.createFolder({
      name,
      parentId,
      userEmail,
      userTags
    });

    return sendResponse(res, 201, { success: true, folder });
  } catch (error) {
    return sendResponse(res, error.message.includes('Access denied') ? 403 : 400, {
      success: false,
      error: error.message
    });
  }
}

/**
 * Handle rename folder request
 */
async function handleRenameFolder(req, res) {
  const { folderId, newName } = req.body;
  const userTags = parseUserTags(req.body.userTags);

  if (!folderId || !newName) {
    return sendResponse(res, 400, { success: false, error: 'Folder ID and new name are required' });
  }

  try {
    const folder = await dam.renameFolder(folderId, newName, userTags);
    return sendResponse(res, 200, { success: true, folder });
  } catch (error) {
    return sendResponse(res, error.message.includes('Access denied') ? 403 : 400, {
      success: false,
      error: error.message
    });
  }
}

/**
 * Handle move folder request
 */
async function handleMoveFolder(req, res) {
  const { folderId, newParentId } = req.body;
  const userTags = parseUserTags(req.body.userTags);

  if (!folderId || !newParentId) {
    return sendResponse(res, 400, { success: false, error: 'Folder ID and destination are required' });
  }

  try {
    const folder = await dam.moveFolder(folderId, newParentId, userTags);
    return sendResponse(res, 200, { success: true, folder });
  } catch (error) {
    return sendResponse(res, error.message.includes('Access denied') ? 403 : 400, {
      success: false,
      error: error.message
    });
  }
}

/**
 * Handle update folder request
 */
async function handleUpdateFolder(req, res) {
  const { folderId, color, description } = req.body;
  const userTags = parseUserTags(req.body.userTags);

  if (!folderId) {
    return sendResponse(res, 400, { success: false, error: 'Folder ID is required' });
  }

  try {
    const folder = await dam.updateFolder(folderId, { color, description }, userTags);
    return sendResponse(res, 200, { success: true, folder });
  } catch (error) {
    return sendResponse(res, error.message.includes('Access denied') ? 403 : 400, {
      success: false,
      error: error.message
    });
  }
}

/**
 * Handle delete folder request
 */
async function handleDeleteFolder(req, res) {
  const { folderId } = req.body;
  const userTags = parseUserTags(req.body.userTags);

  if (!folderId) {
    return sendResponse(res, 400, { success: false, error: 'Folder ID is required' });
  }

  try {
    const result = await dam.deleteFolder(folderId, userTags);
    return sendResponse(res, 200, { success: true, ...result });
  } catch (error) {
    return sendResponse(res, error.message.includes('Access denied') ? 403 : 400, {
      success: false,
      error: error.message
    });
  }
}

/**
 * Handle file upload request
 */
async function handleUpload(req, res) {
  try {
    const { fields, files } = await parseFormData(req);
    const userTags = parseUserTags(fields.userTags);

    if (!files.file || files.file.length === 0) {
      return sendResponse(res, 400, { success: false, error: 'No file provided' });
    }

    const uploadedFile = files.file[0];
    const fs = require('fs').promises;
    const fileData = await fs.readFile(uploadedFile.path);

    const result = await dam.uploadFile({
      fileData,
      fileName: uploadedFile.originalFilename,
      mimeType: uploadedFile.headers['content-type'],
      folderId: fields.folderId || 'root',
      userEmail: fields.userEmail,
      userTags,
      description: fields.description || '',
      fileTags: fields.tags ? parseUserTags(fields.tags) : []
    });

    // Clean up temp file
    try {
      await fs.unlink(uploadedFile.path);
    } catch (e) {
      console.warn('Failed to clean up temp file:', e);
    }

    return sendResponse(res, 201, { success: true, file: result });
  } catch (error) {
    console.error('Upload error:', error);
    return sendResponse(res, error.message.includes('Access denied') ? 403 : 400, {
      success: false,
      error: error.message
    });
  }
}

/**
 * Handle get file request
 */
async function handleGetFile(req, res) {
  const { fileId } = req.query;
  const userTags = parseUserTags(req.query.userTags);

  if (!fileId) {
    return sendResponse(res, 400, { success: false, error: 'File ID is required' });
  }

  try {
    const file = await dam.getFile(fileId, userTags);
    return sendResponse(res, 200, { success: true, file });
  } catch (error) {
    return sendResponse(res, error.message.includes('Access denied') ? 403 : 400, {
      success: false,
      error: error.message
    });
  }
}

/**
 * Handle rename file request
 */
async function handleRenameFile(req, res) {
  const { fileId, newName } = req.body;
  const userTags = parseUserTags(req.body.userTags);

  if (!fileId || !newName) {
    return sendResponse(res, 400, { success: false, error: 'File ID and new name are required' });
  }

  try {
    const file = await dam.renameFile(fileId, newName, userTags);
    return sendResponse(res, 200, { success: true, file });
  } catch (error) {
    return sendResponse(res, error.message.includes('Access denied') ? 403 : 400, {
      success: false,
      error: error.message
    });
  }
}

/**
 * Handle move file request
 */
async function handleMoveFile(req, res) {
  const { fileId, newFolderId } = req.body;
  const userTags = parseUserTags(req.body.userTags);

  if (!fileId || !newFolderId) {
    return sendResponse(res, 400, { success: false, error: 'File ID and destination folder are required' });
  }

  try {
    const file = await dam.moveFile(fileId, newFolderId, userTags);
    return sendResponse(res, 200, { success: true, file });
  } catch (error) {
    return sendResponse(res, error.message.includes('Access denied') ? 403 : 400, {
      success: false,
      error: error.message
    });
  }
}

/**
 * Handle update file request
 */
async function handleUpdateFile(req, res) {
  const { fileId, description, tags } = req.body;
  const userTags = parseUserTags(req.body.userTags);

  if (!fileId) {
    return sendResponse(res, 400, { success: false, error: 'File ID is required' });
  }

  try {
    const file = await dam.updateFile(fileId, { description, tags }, userTags);
    return sendResponse(res, 200, { success: true, file });
  } catch (error) {
    return sendResponse(res, error.message.includes('Access denied') ? 403 : 400, {
      success: false,
      error: error.message
    });
  }
}

/**
 * Handle delete file request
 */
async function handleDeleteFile(req, res) {
  const { fileId } = req.body;
  const userTags = parseUserTags(req.body.userTags);

  if (!fileId) {
    return sendResponse(res, 400, { success: false, error: 'File ID is required' });
  }

  try {
    const result = await dam.deleteFile(fileId, userTags);
    return sendResponse(res, 200, { success: true, ...result });
  } catch (error) {
    return sendResponse(res, error.message.includes('Access denied') ? 403 : 400, {
      success: false,
      error: error.message
    });
  }
}

/**
 * Handle search request
 */
async function handleSearch(req, res) {
  const { query, fileTypes, folderId, limit } = req.query;
  const userTags = parseUserTags(req.query.userTags);

  if (!query) {
    return sendResponse(res, 400, { success: false, error: 'Search query is required' });
  }

  try {
    const results = await dam.search(query, {
      userTags,
      fileTypes: fileTypes ? parseUserTags(fileTypes) : [],
      folderId,
      limit: parseInt(limit) || 50
    });

    return sendResponse(res, 200, { success: true, ...results });
  } catch (error) {
    return sendResponse(res, error.message.includes('Access denied') ? 403 : 400, {
      success: false,
      error: error.message
    });
  }
}

/**
 * Handle get recent files request
 */
async function handleGetRecent(req, res) {
  const { limit } = req.query;
  const userTags = parseUserTags(req.query.userTags);

  try {
    const files = await dam.getRecentFiles(parseInt(limit) || 20, userTags);
    return sendResponse(res, 200, { success: true, files });
  } catch (error) {
    return sendResponse(res, error.message.includes('Access denied') ? 403 : 400, {
      success: false,
      error: error.message
    });
  }
}

/**
 * Handle get statistics request
 */
async function handleGetStats(req, res) {
  const userTags = parseUserTags(req.query.userTags);

  try {
    const stats = await dam.getStatistics(userTags);
    return sendResponse(res, 200, { success: true, ...stats });
  } catch (error) {
    return sendResponse(res, error.message.includes('Access denied') ? 403 : 400, {
      success: false,
      error: error.message
    });
  }
}

/**
 * Handle get folder tree request
 */
async function handleGetTree(req, res) {
  const userTags = parseUserTags(req.query.userTags);

  try {
    const tree = await dam.getFolderTree(userTags);
    return sendResponse(res, 200, { success: true, tree });
  } catch (error) {
    return sendResponse(res, error.message.includes('Access denied') ? 403 : 400, {
      success: false,
      error: error.message
    });
  }
}

/**
 * Handle download tracking
 */
async function handleDownload(req, res) {
  const { fileId } = req.query;
  const userTags = parseUserTags(req.query.userTags);

  if (!fileId) {
    return sendResponse(res, 400, { success: false, error: 'File ID is required' });
  }

  try {
    const file = await dam.getFile(fileId, userTags);
    await dam.recordDownload(fileId);

    return sendResponse(res, 200, {
      success: true,
      file,
      downloadUrl: file.shopifyUrl
    });
  } catch (error) {
    return sendResponse(res, error.message.includes('Access denied') ? 403 : 400, {
      success: false,
      error: error.message
    });
  }
}

/**
 * Handle serve local file (fallback)
 */
async function handleServe(req, res) {
  const { fileId } = req.query;
  const userTags = parseUserTags(req.query.userTags);

  if (!fileId) {
    return sendResponse(res, 400, { success: false, error: 'File ID is required' });
  }

  try {
    // Get file metadata first
    const metadata = await dam.loadMetadata();
    const file = Object.values(metadata.files).find(f => f.shopifyFileId === fileId);

    if (!file) {
      return sendResponse(res, 404, { success: false, error: 'File not found' });
    }

    // Check access
    if (!dam.hasAccess(userTags)) {
      return sendResponse(res, 403, { success: false, error: 'Access denied' });
    }

    // Serve file
    const { data } = await dam.serveLocalFile(fileId);

    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${file.name}"`);
    res.setHeader('Content-Length', data.length);
    res.setHeader('Access-Control-Allow-Origin', '*');

    return res.send(data);
  } catch (error) {
    return sendResponse(res, 500, { success: false, error: error.message });
  }
}

/**
 * Handle bulk move request
 */
async function handleBulkMove(req, res) {
  const { items, destinationFolderId } = req.body;
  const userTags = parseUserTags(req.body.userTags);

  if (!items || !Array.isArray(items) || items.length === 0) {
    return sendResponse(res, 400, { success: false, error: 'Items array is required' });
  }

  if (!destinationFolderId) {
    return sendResponse(res, 400, { success: false, error: 'Destination folder is required' });
  }

  try {
    const results = { moved: [], errors: [] };

    for (const item of items) {
      try {
        if (item.type === 'folder') {
          await dam.moveFolder(item.id, destinationFolderId, userTags);
        } else {
          await dam.moveFile(item.id, destinationFolderId, userTags);
        }
        results.moved.push(item);
      } catch (error) {
        results.errors.push({ item, error: error.message });
      }
    }

    return sendResponse(res, 200, { success: true, ...results });
  } catch (error) {
    return sendResponse(res, error.message.includes('Access denied') ? 403 : 400, {
      success: false,
      error: error.message
    });
  }
}

/**
 * Handle bulk delete request
 */
async function handleBulkDelete(req, res) {
  const { items } = req.body;
  const userTags = parseUserTags(req.body.userTags);

  if (!items || !Array.isArray(items) || items.length === 0) {
    return sendResponse(res, 400, { success: false, error: 'Items array is required' });
  }

  try {
    const results = { deleted: [], errors: [] };

    for (const item of items) {
      try {
        if (item.type === 'folder') {
          await dam.deleteFolder(item.id, userTags);
        } else {
          await dam.deleteFile(item.id, userTags);
        }
        results.deleted.push(item);
      } catch (error) {
        results.errors.push({ item, error: error.message });
      }
    }

    return sendResponse(res, 200, { success: true, ...results });
  } catch (error) {
    return sendResponse(res, error.message.includes('Access denied') ? 403 : 400, {
      success: false,
      error: error.message
    });
  }
}

/**
 * Handle get files by category request
 */
async function handleGetByCategory(req, res) {
  const { categories } = req.query;
  const userTags = parseUserTags(req.query.userTags);

  if (!categories) {
    return sendResponse(res, 400, { success: false, error: 'Categories are required' });
  }

  try {
    const files = await dam.getFilesByCategory(parseUserTags(categories), userTags);
    return sendResponse(res, 200, { success: true, files });
  } catch (error) {
    return sendResponse(res, error.message.includes('Access denied') ? 403 : 400, {
      success: false,
      error: error.message
    });
  }
}

// ==================== MAIN HANDLER ====================

module.exports = async (req, res) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.status(200);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    return res.end();
  }

  // Rate limiting
  const identifier = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
  const rateCheck = rateLimiter.checkRateLimit(identifier, { type: 'dam' });

  if (!rateCheck.allowed) {
    return sendResponse(res, 429, {
      success: false,
      error: 'Rate limit exceeded. Please try again later.',
      retryAfter: rateCheck.retryAfter
    });
  }

  try {
    // Initialize DAM
    await dam.init();

    const { action } = req.query;

    // Route based on action
    switch (action) {
      // Folder operations
      case 'get-contents':
        return await handleGetContents(req, res);
      case 'create-folder':
        return await handleCreateFolder(req, res);
      case 'rename-folder':
        return await handleRenameFolder(req, res);
      case 'move-folder':
        return await handleMoveFolder(req, res);
      case 'update-folder':
        return await handleUpdateFolder(req, res);
      case 'delete-folder':
        return await handleDeleteFolder(req, res);

      // File operations
      case 'upload':
        return await handleUpload(req, res);
      case 'get-file':
        return await handleGetFile(req, res);
      case 'rename-file':
        return await handleRenameFile(req, res);
      case 'move-file':
        return await handleMoveFile(req, res);
      case 'update-file':
        return await handleUpdateFile(req, res);
      case 'delete-file':
        return await handleDeleteFile(req, res);
      case 'download':
        return await handleDownload(req, res);
      case 'serve':
        return await handleServe(req, res);

      // Bulk operations
      case 'bulk-move':
        return await handleBulkMove(req, res);
      case 'bulk-delete':
        return await handleBulkDelete(req, res);

      // Search and filter
      case 'search':
        return await handleSearch(req, res);
      case 'get-recent':
        return await handleGetRecent(req, res);
      case 'get-by-category':
        return await handleGetByCategory(req, res);

      // Tree and stats
      case 'get-tree':
        return await handleGetTree(req, res);
      case 'get-stats':
        return await handleGetStats(req, res);

      default:
        return sendResponse(res, 400, {
          success: false,
          error: 'Invalid action. Valid actions: get-contents, create-folder, rename-folder, move-folder, update-folder, delete-folder, upload, get-file, rename-file, move-file, update-file, delete-file, download, serve, bulk-move, bulk-delete, search, get-recent, get-by-category, get-tree, get-stats'
        });
    }
  } catch (error) {
    console.error('DAM API error:', error);
    return sendResponse(res, 500, {
      success: false,
      error: 'Internal server error'
    });
  }
};
