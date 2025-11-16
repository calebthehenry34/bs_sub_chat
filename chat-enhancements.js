/**
 * Chat Enhancement Module
 * Adds advanced features to the subscription support chat:
 * - Chat Persistence
 * - Auto-complete Suggestions
 * - Smart Quick Replies
 * - Chat History for Returning Customers
 * - Shopify Integration (Orders, Subscriptions, Loyalty)
 * - GDPR Compliance Tools
 * - Toast Notification System
 * - Consent Management
 * - Analytics Events
 * - Sentiment Detection
 */

class ChatEnhancements {
  constructor(config = {}) {
    this.config = {
      backendUrl: config.backendUrl || 'https://your-backend.vercel.app',
      shopDomain: config.shopDomain || window.Shopify?.shop,
      enablePersistence: config.enablePersistence !== false,
      enableAutoComplete: config.enableAutoComplete !== false,
      enableQuickReplies: config.enableQuickReplies !== false,
      enableHistory: config.enableHistory !== false,
      enableShopify: config.enableShopify !== false,
      enableGDPR: config.enableGDPR !== false,
      enableToasts: config.enableToasts !== false,
      enableConsent: config.enableConsent !== false,
      enableAnalytics: config.enableAnalytics !== false,
      enableSentiment: config.enableSentiment !== false,
      ...config
    };

    this.sessionId = this.getOrCreateSessionId();
    this.customerEmail = null;
    this.conversationContext = {
      lastIntent: null,
      messages: [],
      metadata: {}
    };

    // Toast notification queue
    this.toastQueue = [];
    this.activeToasts = [];
    this.toastContainer = null;

    // Analytics data
    this.analyticsData = {
      events: [],
      sessionStart: Date.now(),
      pageViews: 0,
      interactions: 0,
      messagesSent: 0,
      sentimentHistory: []
    };

    // Consent state
    this.consentState = this.loadConsentState();

    this.init();
  }

  /**
   * Initialize all enhancements
   */
  async init() {
    if (this.config.enableToasts) {
      this.initToastSystem();
    }

    if (this.config.enableConsent) {
      this.initConsentManagement();
    }

    if (this.config.enableAnalytics) {
      this.initAnalytics();
    }

    if (this.config.enablePersistence) {
      await this.loadPersistedSession();
    }

    if (this.config.enableHistory) {
      await this.loadCustomerHistory();
    }

    if (this.config.enableAutoComplete) {
      this.initAutoComplete();
    }

    if (this.config.enableQuickReplies) {
      this.initQuickReplies();
    }

    if (this.config.enableGDPR) {
      this.initGDPRTools();
    }

    // Set up auto-save
    if (this.config.enablePersistence) {
      this.setupAutoSave();
    }

    console.log('Chat enhancements initialized');
  }

  /**
   * SESSION PERSISTENCE
   */

  getOrCreateSessionId() {
    let sessionId = localStorage.getItem('chat_session_id');

    if (!sessionId) {
      sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('chat_session_id', sessionId);
    }

    return sessionId;
  }

  async loadPersistedSession() {
    try {
      // Try to load from server first
      const response = await fetch(
        `${this.config.backendUrl}/api/session?sessionId=${this.sessionId}`
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.session) {
          this.restoreSession(data.session);
          return;
        }
      }
    } catch (error) {
      console.log('No server session found, checking localStorage');
    }

    // Fallback to localStorage
    const localSession = localStorage.getItem('chat_session_data');
    if (localSession) {
      try {
        const sessionData = JSON.parse(localSession);
        this.restoreSession(sessionData);
      } catch (error) {
        console.error('Failed to parse local session:', error);
      }
    }
  }

  restoreSession(sessionData) {
    this.conversationContext = sessionData.conversationContext || this.conversationContext;
    this.customerEmail = sessionData.customerEmail || null;

    // Restore messages to chat UI
    if (sessionData.messages && window.restoreChatMessages) {
      window.restoreChatMessages(sessionData.messages);
    }

    console.log('Session restored', sessionData);
  }

  async saveSession() {
    const sessionData = {
      sessionId: this.sessionId,
      conversationContext: this.conversationContext,
      customerEmail: this.customerEmail,
      messages: this.getMessagesForSave(),
      savedAt: new Date().toISOString()
    };

    // Save to localStorage immediately
    localStorage.setItem('chat_session_data', JSON.stringify(sessionData));

    // Save to server (async, don't wait)
    fetch(`${this.config.backendUrl}/api/session?sessionId=${this.sessionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sessionData)
    }).catch(error => console.error('Failed to save session to server:', error));
  }

  setupAutoSave() {
    // Auto-save every 30 seconds
    setInterval(() => {
      if (this.conversationContext.messages.length > 0) {
        this.saveSession();
      }
    }, 30000);

    // Save on page unload
    window.addEventListener('beforeunload', () => {
      this.saveSession();
    });
  }

  getMessagesForSave() {
    // Get messages from chat UI
    if (window.getChatMessages) {
      return window.getChatMessages();
    }
    return this.conversationContext.messages;
  }

  /**
   * CHAT HISTORY FOR RETURNING CUSTOMERS
   */

  async loadCustomerHistory() {
    if (!this.customerEmail) {
      return;
    }

    try {
      const response = await fetch(
        `${this.config.backendUrl}/api/chat-history?customerId=${encodeURIComponent(this.customerEmail)}&limit=5`
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.recentSessions.length > 0) {
          this.showWelcomeBack(data);
        }
      }
    } catch (error) {
      console.error('Failed to load history:', error);
    }
  }

  showWelcomeBack(historyData) {
    const lastSession = historyData.recentSessions[historyData.recentSessions.length - 1];
    const lastTopic = lastSession?.topic || 'your previous question';

    const welcomeMessage = `Welcome back! Last time we discussed ${lastTopic}. How can I help you today?`;

    if (window.addBotMessage) {
      window.addBotMessage(welcomeMessage);
    }
  }

  /**
   * AUTO-COMPLETE SUGGESTIONS
   */

  initAutoComplete() {
    const chatInput = document.querySelector('#chat-input') ||
                     document.querySelector('[data-chat-input]') ||
                     document.querySelector('textarea, input[type="text"]');

    if (!chatInput) {
      console.warn('Chat input not found for auto-complete');
      return;
    }

    // Create suggestions dropdown
    const suggestionsContainer = document.createElement('div');
    suggestionsContainer.className = 'chat-suggestions';
    suggestionsContainer.style.cssText = `
      position: absolute;
      bottom: 100%;
      left: 0;
      right: 0;
      background: white;
      border: 1px solid #ddd;
      border-radius: 8px 8px 0 0;
      max-height: 200px;
      overflow-y: auto;
      display: none;
      box-shadow: 0 -4px 12px rgba(0,0,0,0.1);
      z-index: 1000;
    `;

    chatInput.parentElement.style.position = 'relative';
    chatInput.parentElement.appendChild(suggestionsContainer);

    let debounceTimer;

    chatInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      const input = e.target.value;

      if (input.length < 2) {
        suggestionsContainer.style.display = 'none';
        return;
      }

      debounceTimer = setTimeout(async () => {
        await this.showSuggestions(input, suggestionsContainer, chatInput);
      }, 300);
    });

    // Hide suggestions when clicking outside
    document.addEventListener('click', (e) => {
      if (!chatInput.contains(e.target) && !suggestionsContainer.contains(e.target)) {
        suggestionsContainer.style.display = 'none';
      }
    });
  }

  async showSuggestions(input, container, chatInput) {
    try {
      const response = await fetch(
        `${this.config.backendUrl}/api/suggestions?action=autocomplete&input=${encodeURIComponent(input)}&limit=5`
      );

      if (!response.ok) return;

      const data = await response.json();

      if (!data.suggestions || data.suggestions.length === 0) {
        container.style.display = 'none';
        return;
      }

      container.innerHTML = data.suggestions.map(suggestion => `
        <div class="suggestion-item" style="
          padding: 12px 16px;
          cursor: pointer;
          border-bottom: 1px solid #f0f0f0;
          display: flex;
          align-items: center;
          gap: 8px;
        " data-text="${this.escapeHtml(suggestion.text)}">
          <span style="font-size: 18px;">${suggestion.icon || '💬'}</span>
          <span style="flex: 1;">${this.escapeHtml(suggestion.text)}</span>
          <span style="font-size: 12px; color: #999;">${suggestion.category}</span>
        </div>
      `).join('');

      // Add click handlers
      container.querySelectorAll('.suggestion-item').forEach(item => {
        item.addEventListener('click', () => {
          chatInput.value = item.dataset.text;
          container.style.display = 'none';
          chatInput.focus();

          // Trigger send if configured
          if (this.config.autoSendOnSuggestion) {
            chatInput.dispatchEvent(new Event('submit', { bubbles: true }));
          }
        });

        item.addEventListener('mouseenter', () => {
          item.style.background = '#f5f5f5';
        });

        item.addEventListener('mouseleave', () => {
          item.style.background = 'white';
        });
      });

      container.style.display = 'block';
    } catch (error) {
      console.error('Failed to load suggestions:', error);
    }
  }

  /**
   * SMART QUICK REPLIES
   */

  initQuickReplies() {
    this.quickRepliesContainer = document.createElement('div');
    this.quickRepliesContainer.className = 'quick-replies-container';
    this.quickRepliesContainer.style.cssText = `
      padding: 12px;
      display: flex;
      gap: 8px;
      overflow-x: auto;
      background: #f8f8f8;
      border-top: 1px solid #e0e0e0;
    `;

    const chatContainer = document.querySelector('#chat-container') ||
                         document.querySelector('[data-chat-container]') ||
                         document.querySelector('.chat-widget');

    if (chatContainer) {
      chatContainer.appendChild(this.quickRepliesContainer);
    }

    this.updateQuickReplies();
  }

  async updateQuickReplies(context = {}) {
    if (!this.quickRepliesContainer) return;

    try {
      const response = await fetch(
        `${this.config.backendUrl}/api/suggestions?action=quick-replies`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lastIntent: this.conversationContext.lastIntent,
            email: this.customerEmail,
            sessionId: this.sessionId,
            ...context
          })
        }
      );

      if (!response.ok) return;

      const data = await response.json();

      if (!data.quickReplies || data.quickReplies.length === 0) {
        this.quickRepliesContainer.style.display = 'none';
        return;
      }

      this.quickRepliesContainer.innerHTML = data.quickReplies.map(reply => `
        <button class="quick-reply-btn" data-action="${reply.action}" style="
          padding: 8px 16px;
          background: white;
          border: 1px solid #ddd;
          border-radius: 20px;
          cursor: pointer;
          white-space: nowrap;
          font-size: 14px;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.2s;
        ">
          <span>${reply.icon || ''}</span>
          <span>${this.escapeHtml(reply.text)}</span>
        </button>
      `).join('');

      this.quickRepliesContainer.querySelectorAll('.quick-reply-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          this.handleQuickReply(btn.dataset.action, btn.textContent.trim());
        });

        btn.addEventListener('mouseenter', () => {
          btn.style.background = '#f0f0f0';
          btn.style.borderColor = '#999';
        });

        btn.addEventListener('mouseleave', () => {
          btn.style.background = 'white';
          btn.style.borderColor = '#ddd';
        });
      });

      this.quickRepliesContainer.style.display = 'flex';
    } catch (error) {
      console.error('Failed to load quick replies:', error);
    }
  }

  async handleQuickReply(action, text) {
    // Send the quick reply text as a message
    if (window.sendChatMessage) {
      window.sendChatMessage(text);
    }

    // Handle specific actions
    switch (action) {
      case 'order_tracking':
        this.promptForOrderNumber();
        break;
      case 'subscription_manage':
        this.showSubscriptionOptions();
        break;
      case 'loyalty_points':
        await this.checkLoyaltyPoints();
        break;
      case 'product_recommendations':
        await this.showRecommendations();
        break;
      default:
        console.log('Quick reply action:', action);
    }
  }

  /**
   * SHOPIFY INTEGRATION
   */

  async lookupOrder(orderNumber) {
    if (!this.config.enableShopify) return;

    try {
      const response = await fetch(
        `${this.config.backendUrl}/api/shopify?action=lookup-order&orderNumber=${encodeURIComponent(orderNumber)}&customerEmail=${encodeURIComponent(this.customerEmail || '')}`
      );

      const data = await response.json();

      if (data.found) {
        this.displayOrderInfo(data.order);
      } else {
        this.showMessage(data.message || 'Order not found');
      }
    } catch (error) {
      console.error('Order lookup failed:', error);
      this.showMessage('Failed to look up order. Please try again.');
    }
  }

  displayOrderInfo(order) {
    const message = `
      <div class="order-info" style="background: #f8f8f8; padding: 16px; border-radius: 8px; margin: 8px 0;">
        <h4 style="margin: 0 0 12px 0;">Order ${order.orderNumber}</h4>
        <p><strong>Status:</strong> ${order.fulfillmentStatus}</p>
        <p><strong>Payment:</strong> ${order.financialStatus}</p>
        <p><strong>Total:</strong> ${order.currency} ${order.total}</p>
        <p><strong>Items:</strong></p>
        <ul style="margin: 8px 0; padding-left: 20px;">
          ${order.items.map(item => `<li>${item.quantity}x ${item.name}</li>`).join('')}
        </ul>
      </div>
    `;

    this.showMessage(message, 'bot', true);
  }

  async checkLoyaltyPoints() {
    if (!this.customerEmail) {
      this.showMessage('Please sign in to check your loyalty points.');
      return;
    }

    try {
      const response = await fetch(
        `${this.config.backendUrl}/api/shopify?action=loyalty-points&email=${encodeURIComponent(this.customerEmail)}`
      );

      const data = await response.json();

      if (data.success) {
        const message = `
          <div class="loyalty-info" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 12px; margin: 8px 0;">
            <h3 style="margin: 0 0 16px 0;">🌟 Your Loyalty Status</h3>
            <p style="font-size: 32px; font-weight: bold; margin: 0;">${data.points} Points</p>
            <p style="margin: 8px 0 0 0; opacity: 0.9;">Tier: ${data.tier}</p>
          </div>
        `;
        this.showMessage(message, 'bot', true);

        // Update quick replies to show redeem option
        this.updateQuickReplies({ showRedeemPoints: true });
      } else {
        this.showMessage(data.message || 'Unable to retrieve loyalty points');
      }
    } catch (error) {
      console.error('Loyalty points check failed:', error);
    }
  }

  async showRecommendations() {
    if (!this.customerEmail) {
      this.showMessage('Sign in to get personalized recommendations!');
      return;
    }

    try {
      const response = await fetch(
        `${this.config.backendUrl}/api/shopify?action=recommendations&email=${encodeURIComponent(this.customerEmail)}`
      );

      const data = await response.json();

      if (data.success && data.recommendations.length > 0) {
        const message = `
          <div class="recommendations" style="margin: 8px 0;">
            <h4>Recommended for You</h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; margin-top: 12px;">
              ${data.recommendations.map(product => `
                <div style="border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; cursor: pointer;">
                  <img src="${product.image}" alt="${product.title}" style="width: 100%; height: 150px; object-fit: cover;">
                  <div style="padding: 8px;">
                    <p style="margin: 0; font-size: 14px; font-weight: 500;">${product.title}</p>
                    <p style="margin: 4px 0 0 0; font-size: 16px; font-weight: bold; color: #667eea;">$${product.price}</p>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
        this.showMessage(message, 'bot', true);
      }
    } catch (error) {
      console.error('Recommendations failed:', error);
    }
  }

  /**
   * GDPR COMPLIANCE TOOLS
   */

  initGDPRTools() {
    // Add GDPR options to settings/menu
    const gdprButton = document.createElement('button');
    gdprButton.textContent = 'Privacy & Data';
    gdprButton.style.cssText = `
      position: absolute;
      top: 16px;
      right: 16px;
      padding: 8px 12px;
      background: transparent;
      border: 1px solid #ddd;
      border-radius: 6px;
      cursor: pointer;
      font-size: 12px;
    `;

    gdprButton.addEventListener('click', () => this.showGDPROptions());

    const chatHeader = document.querySelector('.chat-header') ||
                      document.querySelector('[data-chat-header]');

    if (chatHeader) {
      chatHeader.style.position = 'relative';
      chatHeader.appendChild(gdprButton);
    }
  }

  showGDPROptions() {
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;

    modal.innerHTML = `
      <div style="background: white; padding: 24px; border-radius: 12px; max-width: 400px; width: 90%;">
        <h3 style="margin: 0 0 16px 0;">Privacy & Your Data</h3>
        <p style="font-size: 14px; color: #666; margin-bottom: 20px;">
          You have control over your data. Choose an option below:
        </p>
        <button id="gdpr-export" style="width: 100%; padding: 12px; margin-bottom: 8px; background: #4CAF50; color: white; border: none; border-radius: 6px; cursor: pointer;">
          📥 Export My Data
        </button>
        <button id="gdpr-delete" style="width: 100%; padding: 12px; margin-bottom: 8px; background: #f44336; color: white; border: none; border-radius: 6px; cursor: pointer;">
          🗑️ Delete My Data
        </button>
        <button id="gdpr-consent" style="width: 100%; padding: 12px; margin-bottom: 8px; background: #2196F3; color: white; border: none; border-radius: 6px; cursor: pointer;">
          ⚙️ Manage Consent
        </button>
        <button id="gdpr-close" style="width: 100%; padding: 12px; background: #999; color: white; border: none; border-radius: 6px; cursor: pointer;">
          Close
        </button>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#gdpr-export').addEventListener('click', () => {
      modal.remove();
      this.exportData();
    });

    modal.querySelector('#gdpr-delete').addEventListener('click', () => {
      modal.remove();
      this.deleteData();
    });

    modal.querySelector('#gdpr-consent').addEventListener('click', () => {
      modal.remove();
      this.manageConsent();
    });

    modal.querySelector('#gdpr-close').addEventListener('click', () => {
      modal.remove();
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }

  async exportData() {
    if (!this.customerEmail) {
      alert('Please provide your email address to export your data.');
      const email = prompt('Enter your email:');
      if (!email) return;
      this.customerEmail = email;
    }

    try {
      const response = await fetch(
        `${this.config.backendUrl}/api/gdpr?action=export`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: this.customerEmail,
            shopName: this.config.shopDomain
          })
        }
      );

      const data = await response.json();

      if (data.success) {
        // Download as JSON file
        const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `my-data-export-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);

        alert('Your data has been exported and downloaded.');
      } else {
        alert('Failed to export data: ' + data.error);
      }
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export data. Please try again.');
    }
  }

  async deleteData() {
    if (!this.customerEmail) {
      alert('Please provide your email address.');
      const email = prompt('Enter your email:');
      if (!email) return;
      this.customerEmail = email;
    }

    const confirmed = confirm(
      'Are you sure you want to delete all your data? This action cannot be undone.'
    );

    if (!confirmed) return;

    try {
      const response = await fetch(
        `${this.config.backendUrl}/api/gdpr?action=delete`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: this.customerEmail,
            verified: true,
            reason: 'User requested deletion'
          })
        }
      );

      const data = await response.json();

      if (data.success) {
        alert('Your data has been deleted successfully.');
        // Clear local storage
        localStorage.removeItem('chat_session_data');
        localStorage.removeItem('chat_session_id');
        window.location.reload();
      } else {
        alert('Failed to delete data: ' + data.error);
      }
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Failed to delete data. Please try again.');
    }
  }

  async manageConsent() {
    // Show consent management UI
    this.showConsentModal();
  }

  /**
   * TOAST NOTIFICATION SYSTEM
   */

  initToastSystem() {
    // Create toast container
    this.toastContainer = document.createElement('div');
    this.toastContainer.className = 'toast-container';
    this.toastContainer.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 100000;
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-width: 400px;
      pointer-events: none;
    `;
    document.body.appendChild(this.toastContainer);

    // Add CSS animations
    const style = document.createElement('style');
    style.textContent = `
      @keyframes toastSlideIn {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      @keyframes toastSlideOut {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(100%);
          opacity: 0;
        }
      }
      .toast-notification {
        animation: toastSlideIn 0.3s ease-out forwards;
      }
      .toast-notification.removing {
        animation: toastSlideOut 0.3s ease-in forwards;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Show a toast notification
   * @param {string} message - The message to display
   * @param {string} type - Type: 'success', 'error', 'warning', 'info'
   * @param {number} duration - Duration in milliseconds (default: 4000)
   * @param {object} options - Additional options
   */
  showToast(message, type = 'info', duration = 4000, options = {}) {
    if (!this.toastContainer) {
      this.initToastSystem();
    }

    const toast = document.createElement('div');
    toast.className = 'toast-notification';

    const icons = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ'
    };

    const colors = {
      success: { bg: '#10b981', text: '#fff', border: '#059669' },
      error: { bg: '#ef4444', text: '#fff', border: '#dc2626' },
      warning: { bg: '#f59e0b', text: '#fff', border: '#d97706' },
      info: { bg: '#3b82f6', text: '#fff', border: '#2563eb' }
    };

    const color = colors[type] || colors.info;

    toast.style.cssText = `
      background: ${color.bg};
      color: ${color.text};
      padding: 14px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 14px;
      line-height: 1.4;
      pointer-events: auto;
      border-left: 4px solid ${color.border};
      min-width: 280px;
    `;

    const iconSpan = document.createElement('span');
    iconSpan.style.cssText = `
      font-size: 18px;
      font-weight: bold;
      flex-shrink: 0;
    `;
    iconSpan.textContent = icons[type] || icons.info;

    const messageSpan = document.createElement('span');
    messageSpan.style.cssText = 'flex: 1;';
    messageSpan.textContent = message;

    const closeBtn = document.createElement('button');
    closeBtn.style.cssText = `
      background: transparent;
      border: none;
      color: ${color.text};
      cursor: pointer;
      font-size: 18px;
      padding: 0;
      opacity: 0.7;
      transition: opacity 0.2s;
    `;
    closeBtn.textContent = '×';
    closeBtn.addEventListener('mouseenter', () => closeBtn.style.opacity = '1');
    closeBtn.addEventListener('mouseleave', () => closeBtn.style.opacity = '0.7');
    closeBtn.addEventListener('click', () => this.removeToast(toast));

    toast.appendChild(iconSpan);
    toast.appendChild(messageSpan);
    toast.appendChild(closeBtn);

    this.toastContainer.appendChild(toast);
    this.activeToasts.push(toast);

    // Track analytics event
    if (this.config.enableAnalytics) {
      this.trackEvent('toast_shown', { type, message: message.substring(0, 50) });
    }

    // Auto-remove after duration
    if (duration > 0) {
      setTimeout(() => this.removeToast(toast), duration);
    }

    // Limit active toasts
    if (this.activeToasts.length > 5) {
      this.removeToast(this.activeToasts[0]);
    }

    return toast;
  }

  removeToast(toast) {
    if (!toast || !toast.parentNode) return;

    toast.classList.add('removing');
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
      this.activeToasts = this.activeToasts.filter(t => t !== toast);
    }, 300);
  }

  /**
   * CONSENT MANAGEMENT SYSTEM
   */

  loadConsentState() {
    const stored = localStorage.getItem('chat_consent_state');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error('Failed to parse consent state:', e);
      }
    }
    return {
      necessary: true, // Always required
      analytics: false,
      marketing: false,
      personalization: false,
      timestamp: null,
      version: '1.0'
    };
  }

  saveConsentState() {
    this.consentState.timestamp = new Date().toISOString();
    localStorage.setItem('chat_consent_state', JSON.stringify(this.consentState));
  }

  initConsentManagement() {
    // Check if consent has been given
    if (!this.consentState.timestamp) {
      // Show consent banner on first visit
      setTimeout(() => this.showConsentBanner(), 1000);
    }
  }

  showConsentBanner() {
    const banner = document.createElement('div');
    banner.id = 'consent-banner';
    banner.style.cssText = `
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: #1d1d1f;
      color: #f5f5f7;
      padding: 20px;
      z-index: 99999;
      box-shadow: 0 -4px 20px rgba(0,0,0,0.3);
      animation: slideUpBanner 0.4s ease-out;
    `;

    // Add animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideUpBanner {
        from { transform: translateY(100%); }
        to { transform: translateY(0); }
      }
    `;
    document.head.appendChild(style);

    banner.innerHTML = `
      <div style="max-width: 1200px; margin: 0 auto; display: flex; align-items: center; gap: 20px; flex-wrap: wrap;">
        <div style="flex: 1; min-width: 300px;">
          <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600;">We value your privacy</h3>
          <p style="margin: 0; font-size: 14px; opacity: 0.9; line-height: 1.5;">
            We use cookies and similar technologies to enhance your experience, analyze usage, and personalize content.
          </p>
        </div>
        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
          <button id="consent-accept-all" style="
            padding: 10px 24px;
            background: #007AFF;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 500;
            font-size: 14px;
            transition: background 0.2s;
          ">Accept All</button>
          <button id="consent-necessary-only" style="
            padding: 10px 24px;
            background: transparent;
            color: #f5f5f7;
            border: 1px solid #f5f5f7;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 500;
            font-size: 14px;
            transition: all 0.2s;
          ">Necessary Only</button>
          <button id="consent-customize" style="
            padding: 10px 24px;
            background: transparent;
            color: #007AFF;
            border: none;
            cursor: pointer;
            font-weight: 500;
            font-size: 14px;
            text-decoration: underline;
          ">Customize</button>
        </div>
      </div>
    `;

    document.body.appendChild(banner);

    // Event handlers
    banner.querySelector('#consent-accept-all').addEventListener('click', () => {
      this.setAllConsent(true);
      this.removeConsentBanner();
      this.showToast('Preferences saved. Thank you!', 'success');
    });

    banner.querySelector('#consent-necessary-only').addEventListener('click', () => {
      this.setAllConsent(false);
      this.consentState.necessary = true;
      this.saveConsentState();
      this.removeConsentBanner();
      this.showToast('Using necessary cookies only', 'info');
    });

    banner.querySelector('#consent-customize').addEventListener('click', () => {
      this.removeConsentBanner();
      this.showConsentModal();
    });

    // Hover effects
    const acceptBtn = banner.querySelector('#consent-accept-all');
    acceptBtn.addEventListener('mouseenter', () => acceptBtn.style.background = '#0056b3');
    acceptBtn.addEventListener('mouseleave', () => acceptBtn.style.background = '#007AFF');

    const necessaryBtn = banner.querySelector('#consent-necessary-only');
    necessaryBtn.addEventListener('mouseenter', () => {
      necessaryBtn.style.background = '#f5f5f7';
      necessaryBtn.style.color = '#1d1d1f';
    });
    necessaryBtn.addEventListener('mouseleave', () => {
      necessaryBtn.style.background = 'transparent';
      necessaryBtn.style.color = '#f5f5f7';
    });
  }

  removeConsentBanner() {
    const banner = document.getElementById('consent-banner');
    if (banner) {
      banner.style.transform = 'translateY(100%)';
      banner.style.transition = 'transform 0.3s ease-in';
      setTimeout(() => banner.remove(), 300);
    }
  }

  setAllConsent(value) {
    this.consentState.analytics = value;
    this.consentState.marketing = value;
    this.consentState.personalization = value;
    this.saveConsentState();

    if (this.config.enableAnalytics) {
      this.trackEvent('consent_updated', { all: value });
    }
  }

  showConsentModal() {
    const modal = document.createElement('div');
    modal.id = 'consent-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100001;
      padding: 20px;
    `;

    modal.innerHTML = `
      <div style="
        background: white;
        border-radius: 16px;
        max-width: 600px;
        width: 100%;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      ">
        <div style="padding: 24px; border-bottom: 1px solid #e5e5e5;">
          <h2 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 600; color: #1d1d1f;">Privacy Preferences</h2>
          <p style="margin: 0; color: #86868b; font-size: 14px; line-height: 1.5;">
            Manage your cookie and privacy preferences. You can change these settings at any time.
          </p>
        </div>

        <div style="padding: 24px;">
          <!-- Necessary Cookies -->
          <div style="margin-bottom: 20px; padding: 16px; background: #f5f5f7; border-radius: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: #1d1d1f;">Necessary Cookies</h3>
              <span style="
                padding: 4px 12px;
                background: #86868b;
                color: white;
                border-radius: 20px;
                font-size: 12px;
                font-weight: 500;
              ">Always Active</span>
            </div>
            <p style="margin: 0; color: #86868b; font-size: 13px; line-height: 1.5;">
              Essential for the website to function. These cannot be disabled as they are required for core functionality like session management and security.
            </p>
          </div>

          <!-- Analytics -->
          <div style="margin-bottom: 20px; padding: 16px; border: 1px solid #e5e5e5; border-radius: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: #1d1d1f;">Analytics Cookies</h3>
              <label style="position: relative; display: inline-block; width: 50px; height: 28px;">
                <input type="checkbox" id="consent-analytics" ${this.consentState.analytics ? 'checked' : ''} style="opacity: 0; width: 0; height: 0;">
                <span style="
                  position: absolute;
                  cursor: pointer;
                  top: 0;
                  left: 0;
                  right: 0;
                  bottom: 0;
                  background: ${this.consentState.analytics ? '#10b981' : '#ccc'};
                  border-radius: 28px;
                  transition: background 0.3s;
                "></span>
                <span style="
                  position: absolute;
                  height: 22px;
                  width: 22px;
                  left: ${this.consentState.analytics ? '25px' : '3px'};
                  bottom: 3px;
                  background: white;
                  border-radius: 50%;
                  transition: left 0.3s;
                "></span>
              </label>
            </div>
            <p style="margin: 0; color: #86868b; font-size: 13px; line-height: 1.5;">
              Help us understand how visitors interact with our website. Data is anonymized and used to improve user experience.
            </p>
          </div>

          <!-- Marketing -->
          <div style="margin-bottom: 20px; padding: 16px; border: 1px solid #e5e5e5; border-radius: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: #1d1d1f;">Marketing Cookies</h3>
              <label style="position: relative; display: inline-block; width: 50px; height: 28px;">
                <input type="checkbox" id="consent-marketing" ${this.consentState.marketing ? 'checked' : ''} style="opacity: 0; width: 0; height: 0;">
                <span style="
                  position: absolute;
                  cursor: pointer;
                  top: 0;
                  left: 0;
                  right: 0;
                  bottom: 0;
                  background: ${this.consentState.marketing ? '#10b981' : '#ccc'};
                  border-radius: 28px;
                  transition: background 0.3s;
                "></span>
                <span style="
                  position: absolute;
                  height: 22px;
                  width: 22px;
                  left: ${this.consentState.marketing ? '25px' : '3px'};
                  bottom: 3px;
                  background: white;
                  border-radius: 50%;
                  transition: left 0.3s;
                "></span>
              </label>
            </div>
            <p style="margin: 0; color: #86868b; font-size: 13px; line-height: 1.5;">
              Used to deliver relevant advertisements and track campaign effectiveness across websites.
            </p>
          </div>

          <!-- Personalization -->
          <div style="margin-bottom: 20px; padding: 16px; border: 1px solid #e5e5e5; border-radius: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: #1d1d1f;">Personalization</h3>
              <label style="position: relative; display: inline-block; width: 50px; height: 28px;">
                <input type="checkbox" id="consent-personalization" ${this.consentState.personalization ? 'checked' : ''} style="opacity: 0; width: 0; height: 0;">
                <span style="
                  position: absolute;
                  cursor: pointer;
                  top: 0;
                  left: 0;
                  right: 0;
                  bottom: 0;
                  background: ${this.consentState.personalization ? '#10b981' : '#ccc'};
                  border-radius: 28px;
                  transition: background 0.3s;
                "></span>
                <span style="
                  position: absolute;
                  height: 22px;
                  width: 22px;
                  left: ${this.consentState.personalization ? '25px' : '3px'};
                  bottom: 3px;
                  background: white;
                  border-radius: 50%;
                  transition: left 0.3s;
                "></span>
              </label>
            </div>
            <p style="margin: 0; color: #86868b; font-size: 13px; line-height: 1.5;">
              Enable personalized recommendations and remember your preferences for a customized experience.
            </p>
          </div>
        </div>

        <div style="padding: 20px 24px; border-top: 1px solid #e5e5e5; display: flex; gap: 12px; justify-content: flex-end;">
          <button id="consent-cancel" style="
            padding: 10px 24px;
            background: transparent;
            color: #86868b;
            border: 1px solid #e5e5e5;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 500;
            font-size: 14px;
          ">Cancel</button>
          <button id="consent-save" style="
            padding: 10px 24px;
            background: #007AFF;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 500;
            font-size: 14px;
          ">Save Preferences</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Toggle switch functionality
    const setupToggle = (id, key) => {
      const checkbox = modal.querySelector(`#consent-${id}`);
      const parent = checkbox.parentElement;
      const track = parent.querySelector('span:first-of-type');
      const thumb = parent.querySelector('span:last-of-type');

      parent.addEventListener('click', (e) => {
        e.preventDefault();
        checkbox.checked = !checkbox.checked;
        track.style.background = checkbox.checked ? '#10b981' : '#ccc';
        thumb.style.left = checkbox.checked ? '25px' : '3px';
      });
    };

    setupToggle('analytics', 'analytics');
    setupToggle('marketing', 'marketing');
    setupToggle('personalization', 'personalization');

    // Save button
    modal.querySelector('#consent-save').addEventListener('click', () => {
      this.consentState.analytics = modal.querySelector('#consent-analytics').checked;
      this.consentState.marketing = modal.querySelector('#consent-marketing').checked;
      this.consentState.personalization = modal.querySelector('#consent-personalization').checked;
      this.saveConsentState();
      modal.remove();
      this.showToast('Privacy preferences saved successfully', 'success');

      if (this.config.enableAnalytics) {
        this.trackEvent('consent_preferences_saved', {
          analytics: this.consentState.analytics,
          marketing: this.consentState.marketing,
          personalization: this.consentState.personalization
        });
      }
    });

    // Cancel button
    modal.querySelector('#consent-cancel').addEventListener('click', () => {
      modal.remove();
    });

    // Click outside to close
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }

  /**
   * BASIC ANALYTICS EVENTS
   */

  initAnalytics() {
    // Track page view
    this.analyticsData.pageViews++;
    this.trackEvent('page_view', {
      url: window.location.href,
      referrer: document.referrer,
      timestamp: Date.now()
    });

    // Track time on page
    this.startTimeTracking();

    // Track scroll depth
    this.trackScrollDepth();

    // Track user interactions
    this.trackInteractions();

    // Save analytics periodically
    setInterval(() => this.saveAnalyticsData(), 60000);

    // Save on page unload
    window.addEventListener('beforeunload', () => this.saveAnalyticsData());
  }

  trackEvent(eventName, data = {}) {
    if (!this.consentState.analytics && eventName !== 'consent_updated') {
      return; // Don't track if analytics consent not given
    }

    const event = {
      name: eventName,
      data: data,
      timestamp: Date.now(),
      sessionId: this.sessionId
    };

    this.analyticsData.events.push(event);

    // Keep only last 1000 events
    if (this.analyticsData.events.length > 1000) {
      this.analyticsData.events = this.analyticsData.events.slice(-1000);
    }

    console.log('Analytics event:', eventName, data);
  }

  startTimeTracking() {
    let startTime = Date.now();
    let totalTime = 0;

    // Track active time
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        totalTime += Date.now() - startTime;
      } else {
        startTime = Date.now();
      }
    });

    // Report every minute
    setInterval(() => {
      const currentSessionTime = totalTime + (document.hidden ? 0 : Date.now() - startTime);
      this.trackEvent('time_on_page', { seconds: Math.floor(currentSessionTime / 1000) });
    }, 60000);
  }

  trackScrollDepth() {
    let maxScroll = 0;
    const checkpoints = [25, 50, 75, 90, 100];
    const trackedCheckpoints = new Set();

    window.addEventListener('scroll', () => {
      const scrollPercent = Math.round(
        ((window.scrollY + window.innerHeight) / document.documentElement.scrollHeight) * 100
      );

      if (scrollPercent > maxScroll) {
        maxScroll = scrollPercent;

        checkpoints.forEach(checkpoint => {
          if (scrollPercent >= checkpoint && !trackedCheckpoints.has(checkpoint)) {
            trackedCheckpoints.add(checkpoint);
            this.trackEvent('scroll_depth', { percent: checkpoint });
          }
        });
      }
    }, { passive: true });
  }

  trackInteractions() {
    // Track clicks
    document.addEventListener('click', (e) => {
      this.analyticsData.interactions++;
      const target = e.target;

      if (target.tagName === 'BUTTON' || target.tagName === 'A') {
        this.trackEvent('click', {
          element: target.tagName,
          text: target.textContent?.substring(0, 50),
          class: target.className
        });
      }
    });

    // Track form submissions
    document.addEventListener('submit', (e) => {
      this.trackEvent('form_submit', {
        formId: e.target.id || 'unknown',
        formClass: e.target.className
      });
    });
  }

  trackChatMessage(message, sender) {
    this.analyticsData.messagesSent++;

    const sentiment = this.config.enableSentiment ? this.analyzeSentiment(message) : null;

    this.trackEvent('chat_message', {
      sender: sender,
      length: message.length,
      sentiment: sentiment?.score,
      sentimentLabel: sentiment?.label
    });

    if (sentiment) {
      this.analyticsData.sentimentHistory.push({
        timestamp: Date.now(),
        score: sentiment.score,
        label: sentiment.label
      });

      // Keep only last 50 sentiment readings
      if (this.analyticsData.sentimentHistory.length > 50) {
        this.analyticsData.sentimentHistory = this.analyticsData.sentimentHistory.slice(-50);
      }
    }
  }

  saveAnalyticsData() {
    if (!this.consentState.analytics) return;

    const analyticsSnapshot = {
      ...this.analyticsData,
      savedAt: new Date().toISOString()
    };

    localStorage.setItem('chat_analytics_data', JSON.stringify(analyticsSnapshot));

    // Optionally send to backend (respecting consent)
    if (this.config.backendUrl && this.consentState.analytics) {
      fetch(`${this.config.backendUrl}/api/analytics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(analyticsSnapshot)
      }).catch(err => console.log('Analytics save failed:', err));
    }
  }

  getAnalyticsSummary() {
    const sessionDuration = Math.floor((Date.now() - this.analyticsData.sessionStart) / 1000);
    const avgSentiment = this.analyticsData.sentimentHistory.length > 0
      ? this.analyticsData.sentimentHistory.reduce((sum, s) => sum + s.score, 0) / this.analyticsData.sentimentHistory.length
      : 0;

    return {
      sessionDuration: sessionDuration,
      pageViews: this.analyticsData.pageViews,
      totalInteractions: this.analyticsData.interactions,
      messagesSent: this.analyticsData.messagesSent,
      eventsTracked: this.analyticsData.events.length,
      averageSentiment: avgSentiment.toFixed(2),
      sentimentTrend: this.getSentimentTrend()
    };
  }

  getSentimentTrend() {
    const history = this.analyticsData.sentimentHistory;
    if (history.length < 2) return 'neutral';

    const recent = history.slice(-5);
    const older = history.slice(-10, -5);

    if (older.length === 0) return 'neutral';

    const recentAvg = recent.reduce((sum, s) => sum + s.score, 0) / recent.length;
    const olderAvg = older.reduce((sum, s) => sum + s.score, 0) / older.length;

    const diff = recentAvg - olderAvg;
    if (diff > 0.2) return 'improving';
    if (diff < -0.2) return 'declining';
    return 'stable';
  }

  /**
   * SENTIMENT DETECTION
   */

  analyzeSentiment(text) {
    if (!text || typeof text !== 'string') {
      return { score: 0, label: 'neutral', confidence: 0 };
    }

    const normalizedText = text.toLowerCase().trim();

    // Positive indicators
    const positiveWords = [
      'thank', 'thanks', 'great', 'awesome', 'excellent', 'perfect', 'love', 'wonderful',
      'amazing', 'fantastic', 'helpful', 'appreciate', 'good', 'nice', 'happy', 'pleased',
      'satisfied', 'brilliant', 'superb', 'outstanding', 'delighted', 'glad'
    ];

    // Negative indicators
    const negativeWords = [
      'bad', 'terrible', 'awful', 'horrible', 'worst', 'hate', 'angry', 'frustrated',
      'disappointed', 'useless', 'broken', 'failed', 'issue', 'problem', 'wrong', 'error',
      'never', 'cant', "can't", 'cannot', 'wont', "won't", 'doesnt', "doesn't", 'didnt',
      'not working', 'annoyed', 'upset', 'poor', 'waste'
    ];

    // Intensifiers
    const intensifiers = ['very', 'really', 'extremely', 'absolutely', 'totally', 'completely', 'so'];

    // Negators
    const negators = ['not', 'no', "don't", 'dont', "isn't", 'isnt', "wasn't", 'wasnt', 'never'];

    let score = 0;
    let positiveCount = 0;
    let negativeCount = 0;

    // Check for positive words
    positiveWords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      const matches = normalizedText.match(regex);
      if (matches) {
        positiveCount += matches.length;
        score += matches.length * 0.3;
      }
    });

    // Check for negative words
    negativeWords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      const matches = normalizedText.match(regex);
      if (matches) {
        negativeCount += matches.length;
        score -= matches.length * 0.3;
      }
    });

    // Check for intensifiers (boost the score)
    intensifiers.forEach(word => {
      if (normalizedText.includes(word)) {
        score *= 1.2;
      }
    });

    // Check for negators (flip sentiment)
    let hasNegator = false;
    negators.forEach(word => {
      if (normalizedText.includes(word)) {
        hasNegator = true;
      }
    });

    // Handle negation context
    if (hasNegator && positiveCount > negativeCount) {
      score = -Math.abs(score) * 0.5; // Negated positive becomes negative
    }

    // Emoji sentiment
    const positiveEmojis = ['😊', '😃', '😄', '🙂', '👍', '❤️', '💯', '🎉', '✨', '👏'];
    const negativeEmojis = ['😞', '😢', '😡', '😤', '👎', '💔', '😠', '🤬', '😭', '😔'];

    positiveEmojis.forEach(emoji => {
      if (text.includes(emoji)) score += 0.4;
    });

    negativeEmojis.forEach(emoji => {
      if (text.includes(emoji)) score -= 0.4;
    });

    // Exclamation marks intensity
    const exclamations = (text.match(/!/g) || []).length;
    if (exclamations > 0) {
      score *= (1 + exclamations * 0.1);
    }

    // Question marks (uncertainty)
    const questions = (text.match(/\?/g) || []).length;
    if (questions > 1) {
      score *= 0.9; // Multiple questions suggest concern
    }

    // ALL CAPS (frustration)
    const capsRatio = (text.match(/[A-Z]/g) || []).length / text.length;
    if (capsRatio > 0.5 && text.length > 10) {
      score -= 0.3; // Lots of caps suggests frustration
    }

    // Normalize score to -1 to 1 range
    score = Math.max(-1, Math.min(1, score));

    // Determine label
    let label = 'neutral';
    if (score > 0.3) label = 'positive';
    else if (score > 0.1) label = 'slightly_positive';
    else if (score < -0.3) label = 'negative';
    else if (score < -0.1) label = 'slightly_negative';

    // Calculate confidence based on evidence
    const totalIndicators = positiveCount + negativeCount;
    const confidence = Math.min(1, totalIndicators * 0.2 + 0.3);

    return {
      score: Math.round(score * 100) / 100,
      label: label,
      confidence: Math.round(confidence * 100) / 100,
      indicators: {
        positive: positiveCount,
        negative: negativeCount,
        hasNegator: hasNegator
      }
    };
  }

  getSentimentEmoji(sentiment) {
    if (!sentiment) return '';

    switch (sentiment.label) {
      case 'positive':
        return '😊';
      case 'slightly_positive':
        return '🙂';
      case 'negative':
        return '😞';
      case 'slightly_negative':
        return '😐';
      default:
        return '😶';
    }
  }

  getSentimentColor(sentiment) {
    if (!sentiment) return '#86868b';

    const score = sentiment.score;
    if (score > 0.3) return '#10b981'; // Green
    if (score > 0.1) return '#84cc16'; // Light green
    if (score < -0.3) return '#ef4444'; // Red
    if (score < -0.1) return '#f59e0b'; // Orange
    return '#86868b'; // Gray (neutral)
  }

  /**
   * UTILITY FUNCTIONS
   */

  showMessage(message, sender = 'bot', isHtml = false) {
    if (window.addChatMessage) {
      window.addChatMessage(message, sender, isHtml);
    } else if (window.addBotMessage) {
      window.addBotMessage(message);
    } else {
      console.log('[Bot]:', message);
    }
  }

  promptForOrderNumber() {
    const orderNumber = prompt('Enter your order number (e.g., #1234):');
    if (orderNumber) {
      this.lookupOrder(orderNumber.replace('#', ''));
    }
  }

  showSubscriptionOptions() {
    this.showMessage('What would you like to do with your subscription?');
    this.updateQuickReplies({
      customReplies: [
        { text: 'Pause', action: 'subscription_pause', icon: '⏸️' },
        { text: 'Update Address', action: 'subscription_update_address', icon: '📍' },
        { text: 'Cancel', action: 'subscription_cancel', icon: '❌' }
      ]
    });
  }

  setCustomerEmail(email) {
    this.customerEmail = email;
    if (this.config.enableHistory) {
      this.loadCustomerHistory();
    }
    this.saveSession();
  }

  updateContext(intent, metadata = {}) {
    this.conversationContext.lastIntent = intent;
    this.conversationContext.metadata = {
      ...this.conversationContext.metadata,
      ...metadata
    };

    if (this.config.enableQuickReplies) {
      this.updateQuickReplies();
    }

    this.saveSession();
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Export for use in Shopify theme
if (typeof window !== 'undefined') {
  window.ChatEnhancements = ChatEnhancements;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ChatEnhancements;
}
