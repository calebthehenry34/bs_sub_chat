/**
 * Chat History API Endpoint
 * Retrieves chat history for returning customers
 */

const Storage = require('../lib/storage');
const rateLimiter = require('../lib/rate-limiter');

function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };
}

module.exports = async (req, res) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.status(200).setHeader('Access-Control-Allow-Origin', '*')
      .setHeader('Access-Control-Allow-Headers', 'Content-Type')
      .setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      .end();
    return;
  }

  // Rate limiting
  const identifier = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
  const rateCheck = rateLimiter.checkRateLimit(identifier, { type: 'chat_history' });

  if (!rateCheck.allowed) {
    res.status(429).json({
      error: 'Rate limit exceeded',
      message: rateCheck.message,
      retryAfter: rateCheck.retryAfter
    });
    return;
  }

  try {
    if (req.method === 'GET') {
      // Get chat history
      const { customerId, limit } = req.query;

      if (!customerId) {
        res.status(400).json({
          error: 'Missing customerId parameter'
        });
        return;
      }

      const history = await Storage.getCustomerHistory(
        customerId,
        parseInt(limit) || 100
      );

      res.status(200).json({
        success: true,
        ...history
      });
    } else if (req.method === 'POST') {
      // Store message with history tracking
      const message = req.body;

      if (!message.sessionId || !message.sender || !message.message) {
        res.status(400).json({
          error: 'Missing required fields'
        });
        return;
      }

      await Storage.storeMessage(message);

      res.status(200).json({
        success: true,
        message: 'Message stored'
      });
    } else {
      res.status(405).json({
        error: 'Method not allowed'
      });
    }
  } catch (error) {
    console.error('Chat history error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};
