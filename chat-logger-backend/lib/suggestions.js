/**
 * Auto-Complete Suggestions & Smart Quick Replies
 * Provides intelligent suggestions and context-aware quick actions
 */

const Storage = require('./storage');

class SuggestionsEngine {
  constructor() {
    // Common question templates
    this.templates = {
      subscription: [
        'I want to cancel my subscription',
        'I need to update my subscription address',
        'How do I change my subscription frequency?',
        'Can I pause my subscription?',
        'When is my next subscription delivery?',
        'I want to update my payment method',
        'How do I manage my subscription?'
      ],
      order: [
        'Where is my order?',
        'Track my order #',
        'When will my order arrive?',
        'I haven\'t received my order',
        'I want to return an order',
        'Cancel my recent order',
        'Change shipping address for order'
      ],
      account: [
        'Update my email address',
        'Change my password',
        'Update my shipping address',
        'View my order history',
        'I forgot my password',
        'Delete my account'
      ],
      products: [
        'Help me find the right product',
        'Tell me about this product',
        'Is this product in stock?',
        'What are your best sellers?',
        'Do you have any deals or discounts?',
        'Product recommendations for me'
      ],
      support: [
        'I need help',
        'Talk to a human',
        'Contact customer support',
        'File a complaint',
        'Request a refund'
      ],
      loyalty: [
        'Check my loyalty points',
        'How do I earn points?',
        'Redeem my points',
        'What rewards are available?',
        'What is my loyalty tier?'
      ]
    };

    // Build search index
    this.searchIndex = this._buildSearchIndex();
  }

  /**
   * Get auto-complete suggestions based on partial input
   */
  getSuggestions(input, limit = 5, context = {}) {
    if (!input || input.length < 2) {
      return this._getDefaultSuggestions(context);
    }

    const query = input.toLowerCase().trim();
    const matches = [];

    // Search through all templates
    for (const [category, templates] of Object.entries(this.templates)) {
      templates.forEach(template => {
        const score = this._calculateMatchScore(query, template);
        if (score > 0) {
          matches.push({
            text: template,
            category: category,
            score: score,
            icon: this._getCategoryIcon(category)
          });
        }
      });
    }

    // Sort by score and return top matches
    matches.sort((a, b) => b.score - a.score);

    return {
      suggestions: matches.slice(0, limit),
      query: input,
      hasMore: matches.length > limit
    };
  }

  /**
   * Get smart quick replies based on conversation context
   */
  async getQuickReplies(context = {}) {
    const { lastIntent, customerEmail, sessionId, conversationState } = context;

    let quickReplies = [];

    // Context-aware replies based on last intent
    if (lastIntent === 'subscription_info') {
      quickReplies = [
        { text: 'Pause subscription', action: 'subscription_pause', icon: '⏸️' },
        { text: 'Update address', action: 'subscription_update_address', icon: '📍' },
        { text: 'Change frequency', action: 'subscription_frequency', icon: '📅' },
        { text: 'Cancel subscription', action: 'subscription_cancel', icon: '❌' }
      ];
    } else if (lastIntent === 'order_tracking') {
      quickReplies = [
        { text: 'View order details', action: 'order_details', icon: '📦' },
        { text: 'Contact about order', action: 'order_support', icon: '💬' },
        { text: 'Track another order', action: 'order_track_another', icon: '🔍' },
        { text: 'Return this order', action: 'order_return', icon: '↩️' }
      ];
    } else if (lastIntent === 'account_update') {
      quickReplies = [
        { text: 'Update email', action: 'account_email', icon: '✉️' },
        { text: 'Update password', action: 'account_password', icon: '🔒' },
        { text: 'Update address', action: 'account_address', icon: '📍' },
        { text: 'View account info', action: 'account_view', icon: '👤' }
      ];
    } else if (lastIntent === 'product_question') {
      quickReplies = [
        { text: 'Find my perfect product', action: 'product_recommendations', icon: '🎯' },
        { text: 'Check availability', action: 'product_stock', icon: '📊' },
        { text: 'View similar products', action: 'product_similar', icon: '🔄' },
        { text: 'Add to cart', action: 'product_add_cart', icon: '🛒' }
      ];
    } else {
      // Default quick replies
      quickReplies = await this._getDefaultQuickReplies(context);
    }

    // Add personalized quick replies if customer is known
    if (customerEmail) {
      const personalizedReplies = await this._getPersonalizedQuickReplies(customerEmail);
      quickReplies = [...personalizedReplies, ...quickReplies].slice(0, 6);
    }

    return {
      quickReplies,
      context: lastIntent || 'default'
    };
  }

  /**
   * Get context-specific follow-up questions
   */
  getFollowUpQuestions(intent, data = {}) {
    const followUps = {
      subscription_cancel: [
        'Is there anything we can do to keep your subscription?',
        'Would you like to pause instead of canceling?',
        'May I ask why you\'re canceling?'
      ],
      order_tracking: [
        'Would you like to track another order?',
        'Is there anything else I can help you with regarding this order?'
      ],
      subscription_pause: [
        'How long would you like to pause for?',
        'Would you like to change your delivery frequency instead?'
      ],
      product_question: [
        'Would you like to see similar products?',
        'Can I show you our current deals?',
        'Would you like to know about our loyalty program?'
      ]
    };

    return followUps[intent] || [];
  }

  /**
   * Get conversational prompts to guide user
   */
  getConversationalPrompts(state = 'initial') {
    const prompts = {
      initial: [
        'What can I help you with today?',
        'How may I assist you?',
        'What brings you here today?'
      ],
      clarification: [
        'Could you provide more details?',
        'Which one did you mean?',
        'Can you be more specific?'
      ],
      confirmation: [
        'Is this what you\'re looking for?',
        'Does this answer your question?',
        'Was this helpful?'
      ],
      completion: [
        'Is there anything else I can help with?',
        'Anything else you need?',
        'Was there something else?'
      ]
    };

    const statePrompts = prompts[state] || prompts.initial;
    return statePrompts[Math.floor(Math.random() * statePrompts.length)];
  }

  /**
   * Private: Calculate match score for auto-complete
   */
  _calculateMatchScore(query, template) {
    const templateLower = template.toLowerCase();

    // Exact match gets highest score
    if (templateLower.includes(query)) {
      const position = templateLower.indexOf(query);
      const score = 100 - position; // Earlier matches score higher
      return score;
    }

    // Word-by-word matching
    const queryWords = query.split(/\s+/);
    const templateWords = templateLower.split(/\s+/);

    let matchedWords = 0;
    queryWords.forEach(qWord => {
      if (templateWords.some(tWord => tWord.startsWith(qWord))) {
        matchedWords++;
      }
    });

    const wordMatchScore = (matchedWords / queryWords.length) * 50;

    // Fuzzy matching for typos
    const levenshteinScore = this._fuzzyMatch(query, templateLower);

    return Math.max(wordMatchScore, levenshteinScore);
  }

  /**
   * Private: Fuzzy string matching
   */
  _fuzzyMatch(str1, str2) {
    // Simple fuzzy matching - can be improved with Levenshtein distance
    const longer = str2;
    const shorter = str1;

    if (longer.length === 0) return 0;

    let matches = 0;
    for (let i = 0; i < shorter.length; i++) {
      if (longer.includes(shorter[i])) {
        matches++;
      }
    }

    return (matches / longer.length) * 30;
  }

  /**
   * Private: Build search index
   */
  _buildSearchIndex() {
    const index = new Map();

    Object.entries(this.templates).forEach(([category, templates]) => {
      templates.forEach(template => {
        const words = template.toLowerCase().split(/\s+/);
        words.forEach(word => {
          if (!index.has(word)) {
            index.set(word, []);
          }
          index.get(word).push({ template, category });
        });
      });
    });

    return index;
  }

  /**
   * Private: Get default suggestions
   */
  _getDefaultSuggestions(context) {
    // Show most common questions
    const common = [
      { text: 'Track my order', category: 'order', icon: '📦' },
      { text: 'Manage my subscription', category: 'subscription', icon: '🔄' },
      { text: 'Check loyalty points', category: 'loyalty', icon: '⭐' },
      { text: 'Contact support', category: 'support', icon: '💬' },
      { text: 'Update my account', category: 'account', icon: '👤' }
    ];

    return {
      suggestions: common,
      query: '',
      type: 'default'
    };
  }

  /**
   * Private: Get default quick replies
   */
  async _getDefaultQuickReplies(context) {
    return [
      { text: 'Find my product', action: 'product_recommendations', icon: '🎯' },
      { text: 'Track order', action: 'order_tracking', icon: '📦' },
      { text: 'Manage subscription', action: 'subscription_manage', icon: '🔄' },
      { text: 'Contact support', action: 'customer_support', icon: '💬' }
    ];
  }

  /**
   * Private: Get personalized quick replies based on history
   */
  async _getPersonalizedQuickReplies(customerEmail) {
    try {
      const lastSession = await Storage.getLastSession(customerEmail);

      if (!lastSession) {
        return [];
      }

      // Analyze last session to provide relevant quick replies
      const lastMessages = lastSession.messages || [];
      const lastIntent = lastMessages[lastMessages.length - 1]?.intent;

      if (lastIntent === 'subscription_info') {
        return [
          { text: 'Continue subscription topic', action: 'resume_subscription', icon: '▶️', personalized: true }
        ];
      }

      return [
        { text: 'Resume last conversation', action: 'resume_last', icon: '↩️', personalized: true }
      ];
    } catch (error) {
      return [];
    }
  }

  /**
   * Private: Get category icon
   */
  _getCategoryIcon(category) {
    const icons = {
      subscription: '🔄',
      order: '📦',
      account: '👤',
      products: '🛍️',
      support: '💬',
      loyalty: '⭐'
    };
    return icons[category] || '💬';
  }
}

// Singleton instance
const suggestionsEngine = new SuggestionsEngine();

module.exports = suggestionsEngine;
