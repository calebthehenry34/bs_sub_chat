/**
 * GDPR Compliance API Endpoint
 * Handles data export, deletion, and consent management
 */

const GDPRCompliance = require('../lib/gdpr');
const rateLimiter = require('../lib/rate-limiter');

module.exports = async (req, res) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.status(200)
      .setHeader('Access-Control-Allow-Origin', '*')
      .setHeader('Access-Control-Allow-Headers', 'Content-Type')
      .setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
      .end();
    return;
  }

  // Rate limiting (stricter for GDPR operations)
  const identifier = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
  const rateCheck = rateLimiter.checkRateLimit(identifier, { type: 'gdpr' });

  if (!rateCheck.allowed) {
    res.status(429).json({
      error: 'Rate limit exceeded',
      message: rateCheck.message
    });
    return;
  }

  try {
    const { action } = req.query;
    const email = req.body?.email || req.query.email;

    if (!email) {
      res.status(400).json({
        error: 'Email address required'
      });
      return;
    }

    switch (action) {
      case 'export':
        // Export all customer data
        const exportResult = await GDPRCompliance.requestDataExport(email, {
          shopName: req.body.shopName,
          contactEmail: req.body.contactEmail
        });

        res.status(200).json(exportResult);
        break;

      case 'delete':
        // Delete all customer data
        const deleteResult = await GDPRCompliance.requestDataDeletion(email, {
          requireVerification: true,
          verified: req.body.verified || false,
          ipAddress: identifier,
          reason: req.body.reason
        });

        res.status(200).json(deleteResult);
        break;

      case 'consent':
        // Update consent preferences
        if (req.method === 'GET') {
          const consentResult = await GDPRCompliance.getConsent(email);
          res.status(200).json(consentResult);
        } else {
          const updateResult = await GDPRCompliance.updateConsent(email, {
            ...req.body.consent,
            ipAddress: identifier,
            userAgent: req.headers['user-agent']
          });
          res.status(200).json(updateResult);
        }
        break;

      case 'check-compliance':
        // Check compliance status
        const complianceResult = await GDPRCompliance.checkCompliance(email);
        res.status(200).json(complianceResult);
        break;

      case 'privacy-policy':
        // Get privacy policy summary
        const policySummary = GDPRCompliance.getPrivacyPolicySummary({
          name: req.query.shopName,
          email: req.query.contactEmail
        });
        res.status(200).json(policySummary);
        break;

      default:
        res.status(400).json({
          error: 'Invalid action',
          validActions: ['export', 'delete', 'consent', 'check-compliance', 'privacy-policy']
        });
    }
  } catch (error) {
    console.error('GDPR operation error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};
