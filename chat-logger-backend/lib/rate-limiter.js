/**
 * Rate Limiter & Abuse Prevention
 * Prevents spam and bot attacks on the chat system
 */

class RateLimiter {
  constructor() {
    // In-memory store (use Redis in production)
    this.requests = new Map();
    this.blacklist = new Set();

    // Configuration
    this.config = {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 30, // 30 requests per minute
      maxMessagesPerSession: 100, // 100 messages per session
      blacklistThreshold: 5, // Blacklist after 5 violations
      cleanupInterval: 5 * 60 * 1000 // Cleanup every 5 minutes
    };

    // Start cleanup task
    this.startCleanup();
  }

  /**
   * Check if request should be allowed
   */
  checkRateLimit(identifier, options = {}) {
    // Check if blacklisted
    if (this.blacklist.has(identifier)) {
      return {
        allowed: false,
        reason: 'blacklisted',
        message: 'Too many violations. Please contact support.'
      };
    }

    const now = Date.now();
    const key = `${identifier}:${options.type || 'default'}`;

    if (!this.requests.has(key)) {
      this.requests.set(key, {
        count: 1,
        violations: 0,
        firstRequest: now,
        windowStart: now
      });
      return { allowed: true };
    }

    const record = this.requests.get(key);

    // Reset window if expired
    if (now - record.windowStart > this.config.windowMs) {
      record.count = 1;
      record.windowStart = now;
      this.requests.set(key, record);
      return { allowed: true };
    }

    // Increment counter
    record.count++;

    // Check if over limit
    if (record.count > this.config.maxRequests) {
      record.violations++;

      // Blacklist if too many violations
      if (record.violations >= this.config.blacklistThreshold) {
        this.blacklist.add(identifier);
        console.warn(`Blacklisted: ${identifier} (${record.violations} violations)`);
      }

      return {
        allowed: false,
        reason: 'rate_limit_exceeded',
        message: 'Too many requests. Please slow down.',
        retryAfter: this.config.windowMs - (now - record.windowStart)
      };
    }

    this.requests.set(key, record);
    return { allowed: true, remaining: this.config.maxRequests - record.count };
  }

  /**
   * Check session message count
   */
  checkSessionLimit(sessionId, messageCount) {
    if (messageCount > this.config.maxMessagesPerSession) {
      return {
        allowed: false,
        reason: 'session_limit_exceeded',
        message: 'This session has reached its message limit. Please start a new session.'
      };
    }

    return { allowed: true };
  }

  /**
   * Detect suspicious patterns
   */
  detectAbuse(message, metadata = {}) {
    const suspiciousPatterns = [
      // Spam indicators
      /http[s]?:\/\//gi, // URLs
      /\b(buy|cheap|discount|click here|viagra|casino)\b/gi, // Spam keywords
      /(.)\1{10,}/gi, // Repeated characters
      /[A-Z]{20,}/g // All caps spam
    ];

    const violations = [];

    // Check message content
    suspiciousPatterns.forEach((pattern, index) => {
      if (pattern.test(message)) {
        violations.push(`pattern_${index}`);
      }
    });

    // Check message length
    if (message.length > 2000) {
      violations.push('message_too_long');
    }

    // Check for very rapid messages
    if (metadata.timeSinceLastMessage && metadata.timeSinceLastMessage < 500) {
      violations.push('rapid_fire');
    }

    // Check for identical messages
    if (metadata.isDuplicate) {
      violations.push('duplicate_message');
    }

    if (violations.length > 0) {
      return {
        suspicious: true,
        violations,
        riskScore: violations.length * 20 // 0-100 scale
      };
    }

    return { suspicious: false, riskScore: 0 };
  }

  /**
   * Verify session authenticity
   */
  verifySession(sessionId, metadata = {}) {
    // Check for valid session ID format
    if (!sessionId || typeof sessionId !== 'string' || sessionId.length < 10) {
      return {
        valid: false,
        reason: 'invalid_session_id'
      };
    }

    // Check for bot indicators in user agent
    if (metadata.userAgent) {
      const botPatterns = /bot|crawler|spider|scraper|curl|wget|python/i;
      if (botPatterns.test(metadata.userAgent)) {
        return {
          valid: false,
          reason: 'bot_detected',
          userAgent: metadata.userAgent
        };
      }
    }

    return { valid: true };
  }

  /**
   * Remove from blacklist (admin function)
   */
  unblacklist(identifier) {
    this.blacklist.delete(identifier);
    return { success: true };
  }

  /**
   * Get rate limit stats
   */
  getStats(identifier) {
    const stats = {
      blacklisted: this.blacklist.has(identifier),
      requests: [],
      totalViolations: 0
    };

    // Get all records for this identifier
    for (const [key, record] of this.requests.entries()) {
      if (key.startsWith(identifier)) {
        stats.requests.push({
          type: key.split(':')[1],
          count: record.count,
          violations: record.violations,
          windowStart: record.windowStart
        });
        stats.totalViolations += record.violations;
      }
    }

    return stats;
  }

  /**
   * Periodic cleanup of old records
   */
  startCleanup() {
    setInterval(() => {
      const now = Date.now();
      const maxAge = this.config.windowMs * 10; // Keep records for 10 windows

      for (const [key, record] of this.requests.entries()) {
        if (now - record.firstRequest > maxAge) {
          this.requests.delete(key);
        }
      }

      console.log(`Rate limiter cleanup: ${this.requests.size} active records, ${this.blacklist.size} blacklisted`);
    }, this.config.cleanupInterval);
  }

  /**
   * Create rate limit middleware for serverless functions
   */
  middleware() {
    return async (event) => {
      // Extract identifier (IP or session)
      const identifier =
        event.headers['x-forwarded-for'] ||
        event.headers['x-real-ip'] ||
        event.requestContext?.identity?.sourceIp ||
        'unknown';

      // Check rate limit
      const result = this.checkRateLimit(identifier);

      if (!result.allowed) {
        return {
          statusCode: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': Math.ceil((result.retryAfter || 60000) / 1000)
          },
          body: JSON.stringify({
            error: 'Rate limit exceeded',
            message: result.message,
            retryAfter: result.retryAfter
          })
        };
      }

      return null; // Allow request to proceed
    };
  }
}

// Singleton instance
const rateLimiter = new RateLimiter();

module.exports = rateLimiter;
