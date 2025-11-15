/**
 * Storage Module - Chat History & Customer Data
 * Handles persistent storage of chat sessions with customer identification
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const STORAGE_PATH = process.env.STORAGE_PATH || '/tmp/chat-logs';
const HISTORY_PATH = process.env.HISTORY_PATH || '/tmp/chat-history';
const CUSTOMER_DATA_PATH = process.env.CUSTOMER_DATA_PATH || '/tmp/customer-data';

class Storage {
  /**
   * Initialize storage directories
   */
  static async init() {
    await fs.mkdir(STORAGE_PATH, { recursive: true });
    await fs.mkdir(HISTORY_PATH, { recursive: true });
    await fs.mkdir(CUSTOMER_DATA_PATH, { recursive: true });
  }

  /**
   * Create a hashed customer ID from email (for privacy)
   */
  static hashCustomerId(email) {
    return crypto
      .createHash('sha256')
      .update(email.toLowerCase().trim())
      .digest('hex');
  }

  /**
   * Store chat message with history tracking
   */
  static async storeMessage(message) {
    await this.init();

    // Store in daily logs (existing functionality)
    const today = new Date().toISOString().split('T')[0];
    const logFile = path.join(STORAGE_PATH, `chat-logs-${today}.jsonl`);
    const logEntry = JSON.stringify(message) + '\n';
    await fs.appendFile(logFile, logEntry);

    // Store in customer history if customer is identified
    if (message.customerId) {
      const customerHash = this.hashCustomerId(message.customerId);
      const historyFile = path.join(HISTORY_PATH, `${customerHash}.jsonl`);

      const historyEntry = JSON.stringify({
        ...message,
        customerId: customerHash, // Store only hashed version
        storedAt: new Date().toISOString()
      }) + '\n';

      await fs.appendFile(historyFile, historyEntry);
    }

    return { success: true };
  }

  /**
   * Get chat history for a customer
   */
  static async getCustomerHistory(customerId, limit = 100) {
    await this.init();

    const customerHash = this.hashCustomerId(customerId);
    const historyFile = path.join(HISTORY_PATH, `${customerHash}.jsonl`);

    try {
      const content = await fs.readFile(historyFile, 'utf8');
      const lines = content.trim().split('\n');

      // Get last N messages
      const recentLines = lines.slice(-limit);
      const messages = recentLines.map(line => JSON.parse(line));

      // Group by session
      const sessions = this._groupBySession(messages);

      return {
        customerId: customerHash,
        totalSessions: sessions.length,
        recentSessions: sessions.slice(-5), // Last 5 sessions
        lastInteraction: messages[messages.length - 1]?.timestamp
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        return {
          customerId: customerHash,
          totalSessions: 0,
          recentSessions: [],
          lastInteraction: null
        };
      }
      throw error;
    }
  }

  /**
   * Get last session for context-aware responses
   */
  static async getLastSession(customerId) {
    const history = await this.getCustomerHistory(customerId, 50);
    return history.recentSessions[history.recentSessions.length - 1] || null;
  }

  /**
   * Store customer preferences and metadata
   */
  static async storeCustomerData(customerId, data) {
    await this.init();

    const customerHash = this.hashCustomerId(customerId);
    const dataFile = path.join(CUSTOMER_DATA_PATH, `${customerHash}.json`);

    const existingData = await this.getCustomerData(customerId);
    const updatedData = {
      ...existingData,
      ...data,
      customerId: customerHash,
      updatedAt: new Date().toISOString()
    };

    await fs.writeFile(dataFile, JSON.stringify(updatedData, null, 2));
    return updatedData;
  }

  /**
   * Get customer data
   */
  static async getCustomerData(customerId) {
    await this.init();

    const customerHash = this.hashCustomerId(customerId);
    const dataFile = path.join(CUSTOMER_DATA_PATH, `${customerHash}.json`);

    try {
      const content = await fs.readFile(dataFile, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return {
          customerId: customerHash,
          createdAt: new Date().toISOString(),
          preferences: {},
          gdprConsent: false
        };
      }
      throw error;
    }
  }

  /**
   * Delete all customer data (GDPR right to deletion)
   */
  static async deleteCustomerData(customerId) {
    await this.init();

    const customerHash = this.hashCustomerId(customerId);

    // Delete history
    const historyFile = path.join(HISTORY_PATH, `${customerHash}.jsonl`);
    try {
      await fs.unlink(historyFile);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }

    // Delete customer data
    const dataFile = path.join(CUSTOMER_DATA_PATH, `${customerHash}.json`);
    try {
      await fs.unlink(dataFile);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }

    return { success: true, message: 'All customer data deleted' };
  }

  /**
   * Export all customer data (GDPR right to data portability)
   */
  static async exportCustomerData(customerId) {
    await this.init();

    const customerHash = this.hashCustomerId(customerId);
    const history = await this.getCustomerHistory(customerId, 10000);
    const data = await this.getCustomerData(customerId);

    return {
      exportDate: new Date().toISOString(),
      customerId: customerHash,
      customerData: data,
      chatHistory: history,
      format: 'JSON'
    };
  }

  /**
   * Update GDPR consent status
   */
  static async updateGdprConsent(customerId, consent) {
    return await this.storeCustomerData(customerId, {
      gdprConsent: consent,
      gdprConsentDate: new Date().toISOString()
    });
  }

  /**
   * Helper: Group messages by session
   */
  static _groupBySession(messages) {
    const sessions = {};

    messages.forEach(msg => {
      if (!sessions[msg.sessionId]) {
        sessions[msg.sessionId] = {
          sessionId: msg.sessionId,
          messages: [],
          startTime: msg.timestamp,
          topic: msg.topic
        };
      }
      sessions[msg.sessionId].messages.push(msg);
      sessions[msg.sessionId].endTime = msg.timestamp;
    });

    return Object.values(sessions);
  }

  /**
   * Get chat session by ID (for persistence)
   */
  static async getSession(sessionId) {
    await this.init();

    const sessionFile = path.join(STORAGE_PATH, 'sessions', `${sessionId}.json`);

    try {
      const content = await fs.readFile(sessionFile, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Save chat session state (for persistence across page loads)
   */
  static async saveSession(sessionId, sessionData) {
    await this.init();

    const sessionsDir = path.join(STORAGE_PATH, 'sessions');
    await fs.mkdir(sessionsDir, { recursive: true });

    const sessionFile = path.join(sessionsDir, `${sessionId}.json`);

    const data = {
      ...sessionData,
      sessionId,
      lastUpdated: new Date().toISOString()
    };

    await fs.writeFile(sessionFile, JSON.stringify(data, null, 2));
    return data;
  }
}

module.exports = Storage;
