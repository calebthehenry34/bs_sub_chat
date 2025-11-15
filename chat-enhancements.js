/**
 * Chat Enhancement Module
 * Adds advanced features to the subscription support chat:
 * - Chat Persistence
 * - Auto-complete Suggestions
 * - Smart Quick Replies
 * - Chat History for Returning Customers
 * - Shopify Integration (Orders, Subscriptions, Loyalty)
 * - GDPR Compliance Tools
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
      ...config
    };

    this.sessionId = this.getOrCreateSessionId();
    this.customerEmail = null;
    this.conversationContext = {
      lastIntent: null,
      messages: [],
      metadata: {}
    };

    this.init();
  }

  /**
   * Initialize all enhancements
   */
  async init() {
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
    alert('Consent management UI would be shown here');
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
