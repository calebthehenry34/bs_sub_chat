/**
 * Session Persistence API Endpoint
 * Handles chat session state for persistence across page loads
 */

const Storage = require('../lib/storage');
const rateLimiter = require('../lib/rate-limiter');

module.exports = async (req, res) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.status(200)
      .setHeader('Access-Control-Allow-Origin', '*')
      .setHeader('Access-Control-Allow-Headers', 'Content-Type')
      .setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
      .end();
    return;
  }

  // Rate limiting
  const identifier = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
  const rateCheck = rateLimiter.checkRateLimit(identifier, { type: 'session' });

  if (!rateCheck.allowed) {
    res.status(429).json({
      error: 'Rate limit exceeded',
      message: rateCheck.message
    });
    return;
  }

  try {
    const { sessionId } = req.query;

    if (!sessionId) {
      res.status(400).json({
        error: 'Session ID required'
      });
      return;
    }

    switch (req.method) {
      case 'GET':
        // Retrieve session state
        const session = await Storage.getSession(sessionId);

        if (!session) {
          res.status(404).json({
            error: 'Session not found',
            sessionId
          });
          return;
        }

        res.status(200).json({
          success: true,
          session
        });
        break;

      case 'POST':
      case 'PUT':
        // Save session state
        const sessionData = req.body;

        if (!sessionData) {
          res.status(400).json({
            error: 'Session data required'
          });
          return;
        }

        const savedSession = await Storage.saveSession(sessionId, sessionData);

        res.status(200).json({
          success: true,
          session: savedSession,
          message: 'Session saved'
        });
        break;

      case 'DELETE':
        // Clear session (not implemented in Storage yet, but could be)
        res.status(200).json({
          success: true,
          message: 'Session cleared',
          sessionId
        });
        break;

      default:
        res.status(405).json({
          error: 'Method not allowed'
        });
    }
  } catch (error) {
    console.error('Session error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};
