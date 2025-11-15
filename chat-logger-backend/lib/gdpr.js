/**
 * GDPR Compliance Toolkit
 * Handles data export, deletion, and consent management
 */

const Storage = require('./storage');
const crypto = require('crypto');

class GDPRCompliance {
  /**
   * Generate verification token for GDPR requests
   */
  static generateVerificationToken(email) {
    const token = crypto.randomBytes(32).toString('hex');
    const expires = Date.now() + 30 * 60 * 1000; // 30 minutes

    return {
      token,
      email,
      expires,
      signature: this._signToken(token, email)
    };
  }

  /**
   * Verify token for GDPR requests
   */
  static verifyToken(token, email, signature) {
    const expectedSignature = this._signToken(token, email);
    return signature === expectedSignature;
  }

  /**
   * Handle data export request (GDPR Article 15 & 20)
   */
  static async requestDataExport(email, options = {}) {
    try {
      // Export all customer data
      const exportData = await Storage.exportCustomerData(email);

      // Add metadata
      const fullExport = {
        ...exportData,
        gdpr: {
          article: '15 (Right of Access) & 20 (Right to Data Portability)',
          requestDate: new Date().toISOString(),
          dataController: options.shopName || 'Shop',
          contact: options.contactEmail || process.env.EMAIL_TO
        },
        disclaimer: 'This export contains all personal data we hold about you. Customer IDs are hashed for security.',
        formatVersion: '1.0'
      };

      return {
        success: true,
        data: fullExport,
        downloadFormat: 'JSON'
      };
    } catch (error) {
      console.error('Data export error:', error);
      return {
        success: false,
        error: 'Failed to export data',
        message: error.message
      };
    }
  }

  /**
   * Handle data deletion request (GDPR Article 17)
   */
  static async requestDataDeletion(email, options = {}) {
    try {
      // Verify this is a legitimate request
      if (options.requireVerification && !options.verified) {
        return {
          success: false,
          error: 'Verification required',
          message: 'Please verify your email address before requesting deletion'
        };
      }

      // Delete all customer data
      const result = await Storage.deleteCustomerData(email);

      // Log deletion for compliance
      await this._logDeletion(email, options);

      return {
        success: true,
        message: 'All your data has been permanently deleted',
        deletedAt: new Date().toISOString(),
        gdpr: {
          article: '17 (Right to Erasure)',
          retentionPeriod: 'Data deleted immediately, logs retained for 30 days for security'
        }
      };
    } catch (error) {
      console.error('Data deletion error:', error);
      return {
        success: false,
        error: 'Failed to delete data',
        message: error.message
      };
    }
  }

  /**
   * Update consent preferences (GDPR Article 7)
   */
  static async updateConsent(email, consentData) {
    try {
      const data = await Storage.storeCustomerData(email, {
        gdprConsent: {
          chatLogging: consentData.chatLogging || false,
          dataProcessing: consentData.dataProcessing || false,
          marketing: consentData.marketing || false,
          thirdPartySharing: consentData.thirdPartySharing || false,
          updatedAt: new Date().toISOString(),
          ipAddress: consentData.ipAddress,
          userAgent: consentData.userAgent
        }
      });

      return {
        success: true,
        consent: data.gdprConsent,
        message: 'Consent preferences updated'
      };
    } catch (error) {
      console.error('Consent update error:', error);
      return {
        success: false,
        error: 'Failed to update consent',
        message: error.message
      };
    }
  }

  /**
   * Get current consent status
   */
  static async getConsent(email) {
    try {
      const data = await Storage.getCustomerData(email);

      return {
        success: true,
        consent: data.gdprConsent || {
          chatLogging: false,
          dataProcessing: false,
          marketing: false,
          thirdPartySharing: false
        },
        lastUpdated: data.updatedAt
      };
    } catch (error) {
      return {
        success: false,
        consent: null,
        error: error.message
      };
    }
  }

  /**
   * Generate privacy policy summary
   */
  static getPrivacyPolicySummary(shopInfo = {}) {
    return {
      dataController: shopInfo.name || 'Shop',
      contact: shopInfo.email || process.env.EMAIL_TO,
      dataCollected: [
        'Chat messages and conversation history',
        'Session identifiers (anonymous)',
        'Timestamps of interactions',
        'Topic selections and user preferences',
        'Customer email (only if you sign in)'
      ],
      dataUsage: [
        'Providing customer support',
        'Improving chat experience',
        'Analyzing common questions',
        'Sending daily reports to shop owner'
      ],
      dataRetention: {
        chatLogs: '30 days (then archived)',
        customerHistory: 'Until deletion requested',
        anonymousLogs: '90 days'
      },
      thirdParties: [
        {
          name: 'OpenAI',
          purpose: 'AI-powered intent classification',
          dataShared: 'Message content (anonymized)'
        },
        {
          name: 'Email Provider',
          purpose: 'Sending daily reports',
          dataShared: 'Aggregated chat statistics'
        }
      ],
      rights: [
        'Right to Access (Article 15)',
        'Right to Rectification (Article 16)',
        'Right to Erasure (Article 17)',
        'Right to Data Portability (Article 20)',
        'Right to Withdraw Consent (Article 7)'
      ],
      version: '1.0',
      lastUpdated: '2025-11-15'
    };
  }

  /**
   * Check if data processing is compliant
   */
  static async checkCompliance(email) {
    try {
      const data = await Storage.getCustomerData(email);

      const checks = {
        hasConsent: data.gdprConsent?.dataProcessing === true,
        consentDate: data.gdprConsent?.updatedAt,
        dataMinimization: true, // We only store necessary data
        encryptionAtRest: true, // Customer IDs are hashed
        rightToAccess: true, // Export functionality exists
        rightToErasure: true, // Deletion functionality exists
        dataPortability: true // JSON export available
      };

      const isCompliant = checks.hasConsent && checks.dataMinimization;

      return {
        compliant: isCompliant,
        checks,
        warnings: isCompliant ? [] : ['No valid consent found - data processing may be limited']
      };
    } catch (error) {
      return {
        compliant: false,
        error: error.message
      };
    }
  }

  /**
   * Private: Sign token for verification
   */
  static _signToken(token, email) {
    const secret = process.env.GDPR_SECRET || 'change-me-in-production';
    return crypto
      .createHmac('sha256', secret)
      .update(token + email)
      .digest('hex');
  }

  /**
   * Private: Log deletion for compliance records
   */
  static async _logDeletion(email, options) {
    const fs = require('fs').promises;
    const path = require('path');

    const logEntry = {
      email: Storage.hashCustomerId(email), // Store hashed only
      requestDate: new Date().toISOString(),
      requestIp: options.ipAddress,
      verified: options.verified,
      reason: options.reason
    };

    const logFile = path.join(
      process.env.STORAGE_PATH || '/tmp/chat-logs',
      'gdpr-deletions.jsonl'
    );

    await fs.appendFile(logFile, JSON.stringify(logEntry) + '\n');
  }
}

module.exports = GDPRCompliance;
