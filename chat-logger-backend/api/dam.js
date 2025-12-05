/**
 * Digital Asset Management (DAM) API
 * Handles file management operations for Shopify stores
 *
 * Access restricted to users with 'admin' or 'affiliate' tags
 */

const damService = require('../lib/dam');
const rateLimiter = require('../lib/rate-limiter');

// Allowed user tags for DAM access
const ALLOWED_TAGS = ['admin', 'affiliate'];

module.exports = async (req, res) => {
  // CORS handling
  if (req.method === 'OPTIONS') {
    return res.status(200)
      .setHeader('Access-Control-Allow-Origin', '*')
      .setHeader('Access-Control-Allow-Headers', 'Content-Type, X-User-Email, X-User-Tags')
      .setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
      .end();
  }

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  try {
    // Initialize DAM service
    await damService.init();

    // Rate limiting
    const identifier = req.headers['x-forwarded-for'] || req.connection?.remoteAddress || 'unknown';
    const rateCheck = rateLimiter.checkRateLimit(identifier);

    if (!rateCheck.allowed) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        retryAfter: Math.ceil(rateCheck.retryAfter / 1000)
      });
    }

    // Access control - verify user has required tags
    const userEmail = req.headers['x-user-email'] || '';
    let userTags = [];

    try {
      userTags = JSON.parse(req.headers['x-user-tags'] || '[]');
    } catch (e) {
      userTags = [];
    }

    const hasAccess = userTags.some(tag =>
      ALLOWED_TAGS.includes(tag.toLowerCase())
    );

    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'This feature is only available to administrators and affiliates'
      });
    }

    // Get action from query
    const action = req.query.action;

    // Route based on action
    switch (action) {
      case 'list':
        return await handleList(req, res, userEmail);

      case 'upload':
        return await handleUpload(req, res, userEmail);

      case 'create-folder':
        return await handleCreateFolder(req, res, userEmail);

      case 'rename':
        return await handleRename(req, res, userEmail);

      case 'move':
        return await handleMove(req, res, userEmail);

      case 'delete':
        return await handleDelete(req, res, userEmail);

      case 'paste':
        return await handlePaste(req, res, userEmail);

      case 'search':
        return await handleSearch(req, res, userEmail);

      case 'get-file':
        return await handleGetFile(req, res, userEmail);

      case 'get-folder':
        return await handleGetFolder(req, res, userEmail);

      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('DAM API error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

/**
 * List folder contents
 */
async function handleList(req, res, userEmail) {
  try {
    const path = req.query.path || '/';
    const result = await damService.listFolder(path);

    return res.status(200).json(result);
  } catch (error) {
    console.error('List folder error:', error);
    return res.status(500).json({ error: 'Failed to list folder contents' });
  }
}

/**
 * Handle file upload
 */
async function handleUpload(req, res, userEmail) {
  try {
    // Parse multipart form data
    const { file, path } = await parseMultipartForm(req);

    if (!file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const result = await damService.uploadFile(file, path || '/', userEmail);

    return res.status(200).json(result);
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ error: 'Failed to upload file', message: error.message });
  }
}

/**
 * Create new folder
 */
async function handleCreateFolder(req, res, userEmail) {
  try {
    let body = req.body;

    // Parse body if needed
    if (typeof body === 'string') {
      body = JSON.parse(body);
    }

    // Handle raw body from Vercel
    if (!body && req.rawBody) {
      body = JSON.parse(req.rawBody);
    }

    const { name, path } = body || {};

    if (!name) {
      return res.status(400).json({ error: 'Folder name is required' });
    }

    // Validate folder name
    if (!/^[a-zA-Z0-9-_ ]+$/.test(name)) {
      return res.status(400).json({ error: 'Invalid folder name. Use only letters, numbers, spaces, hyphens and underscores.' });
    }

    const result = await damService.createFolder(name, path || '/', userEmail);

    return res.status(200).json(result);
  } catch (error) {
    console.error('Create folder error:', error);
    return res.status(500).json({ error: 'Failed to create folder' });
  }
}

/**
 * Rename file or folder
 */
async function handleRename(req, res, userEmail) {
  try {
    let body = req.body;

    if (typeof body === 'string') {
      body = JSON.parse(body);
    }

    if (!body && req.rawBody) {
      body = JSON.parse(req.rawBody);
    }

    const { id, newName, isFolder } = body || {};

    if (!id || !newName) {
      return res.status(400).json({ error: 'Item ID and new name are required' });
    }

    const result = await damService.renameItem(id, newName, isFolder, userEmail);

    return res.status(200).json(result);
  } catch (error) {
    console.error('Rename error:', error);
    return res.status(500).json({ error: 'Failed to rename item' });
  }
}

/**
 * Move items
 */
async function handleMove(req, res, userEmail) {
  try {
    let body = req.body;

    if (typeof body === 'string') {
      body = JSON.parse(body);
    }

    if (!body && req.rawBody) {
      body = JSON.parse(req.rawBody);
    }

    const { items, destination } = body || {};

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Items to move are required' });
    }

    if (!destination) {
      return res.status(400).json({ error: 'Destination path is required' });
    }

    const result = await damService.moveItems(items, destination, userEmail);

    return res.status(200).json(result);
  } catch (error) {
    console.error('Move error:', error);
    return res.status(500).json({ error: 'Failed to move items' });
  }
}

/**
 * Delete items
 */
async function handleDelete(req, res, userEmail) {
  try {
    let body = req.body;

    if (typeof body === 'string') {
      body = JSON.parse(body);
    }

    if (!body && req.rawBody) {
      body = JSON.parse(req.rawBody);
    }

    const { items } = body || {};

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Items to delete are required' });
    }

    const result = await damService.deleteItems(items, userEmail);

    return res.status(200).json(result);
  } catch (error) {
    console.error('Delete error:', error);
    return res.status(500).json({ error: 'Failed to delete items' });
  }
}

/**
 * Handle paste (copy/cut)
 */
async function handlePaste(req, res, userEmail) {
  try {
    let body = req.body;

    if (typeof body === 'string') {
      body = JSON.parse(body);
    }

    if (!body && req.rawBody) {
      body = JSON.parse(req.rawBody);
    }

    const { items, action, destination } = body || {};

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Items are required' });
    }

    if (!destination) {
      return res.status(400).json({ error: 'Destination path is required' });
    }

    const result = await damService.pasteItems(items, action, destination, userEmail);

    return res.status(200).json(result);
  } catch (error) {
    console.error('Paste error:', error);
    return res.status(500).json({ error: 'Failed to paste items' });
  }
}

/**
 * Search files and folders
 */
async function handleSearch(req, res, userEmail) {
  try {
    const query = req.query.q || req.query.query;

    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const result = await damService.search(query);

    return res.status(200).json(result);
  } catch (error) {
    console.error('Search error:', error);
    return res.status(500).json({ error: 'Failed to search' });
  }
}

/**
 * Get single file details
 */
async function handleGetFile(req, res, userEmail) {
  try {
    const id = req.query.id;

    if (!id) {
      return res.status(400).json({ error: 'File ID is required' });
    }

    const result = await damService.getFile(id);

    if (!result) {
      return res.status(404).json({ error: 'File not found' });
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('Get file error:', error);
    return res.status(500).json({ error: 'Failed to get file' });
  }
}

/**
 * Get single folder details
 */
async function handleGetFolder(req, res, userEmail) {
  try {
    const id = req.query.id;

    if (!id) {
      return res.status(400).json({ error: 'Folder ID is required' });
    }

    const result = await damService.getFolder(id);

    if (!result) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('Get folder error:', error);
    return res.status(500).json({ error: 'Failed to get folder' });
  }
}

/**
 * Parse multipart form data
 */
async function parseMultipartForm(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let file = null;
    let path = '/';

    // Check content type
    const contentType = req.headers['content-type'] || '';

    if (!contentType.includes('multipart/form-data')) {
      // Try to parse as JSON if not multipart
      try {
        let body = req.body;
        if (typeof body === 'string') {
          body = JSON.parse(body);
        }
        resolve({ file: null, path: body?.path || '/' });
        return;
      } catch (e) {
        reject(new Error('Invalid request format'));
        return;
      }
    }

    // Get boundary from content type
    const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
    if (!boundaryMatch) {
      reject(new Error('No boundary found in multipart form'));
      return;
    }
    const boundary = boundaryMatch[1] || boundaryMatch[2];

    req.on('data', (chunk) => chunks.push(chunk));

    req.on('end', () => {
      try {
        const buffer = Buffer.concat(chunks);
        const parts = buffer.toString('binary').split(`--${boundary}`);

        for (const part of parts) {
          if (part.includes('filename=')) {
            // This is a file
            const headerEnd = part.indexOf('\r\n\r\n');
            const headers = part.substring(0, headerEnd);
            const content = part.substring(headerEnd + 4);

            // Parse filename
            const filenameMatch = headers.match(/filename="([^"]+)"/);
            const filename = filenameMatch ? filenameMatch[1] : 'unknown';

            // Parse content type
            const ctMatch = headers.match(/Content-Type:\s*([^\r\n]+)/i);
            const type = ctMatch ? ctMatch[1].trim() : 'application/octet-stream';

            // Remove trailing boundary markers
            let fileContent = content;
            if (fileContent.endsWith('--\r\n')) {
              fileContent = fileContent.slice(0, -4);
            }
            if (fileContent.endsWith('\r\n')) {
              fileContent = fileContent.slice(0, -2);
            }

            file = {
              name: filename,
              type: type,
              data: Buffer.from(fileContent, 'binary'),
              size: Buffer.from(fileContent, 'binary').length
            };
          } else if (part.includes('name="path"')) {
            // This is the path field
            const valueStart = part.indexOf('\r\n\r\n') + 4;
            let value = part.substring(valueStart);
            if (value.endsWith('\r\n')) {
              value = value.slice(0, -2);
            }
            path = value.trim();
          }
        }

        resolve({ file, path });
      } catch (error) {
        reject(error);
      }
    });

    req.on('error', reject);
  });
}
