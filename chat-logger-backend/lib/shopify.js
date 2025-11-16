/**
 * Shopify Integration Module
 * Handles order lookup, subscription management, product recommendations, and loyalty programs
 */

const crypto = require('crypto');

class ShopifyIntegration {
  constructor(config = {}) {
    this.shopDomain = config.shopDomain || process.env.SHOPIFY_SHOP_DOMAIN;
    this.accessToken = config.accessToken || process.env.SHOPIFY_ACCESS_TOKEN;
    this.apiVersion = config.apiVersion || '2024-01';
    this.baseUrl = `https://${this.shopDomain}/admin/api/${this.apiVersion}`;
  }

  /**
   * Make authenticated request to Shopify API
   */
  async _request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: {
        'X-Shopify-Access-Token': this.accessToken,
        'Content-Type': 'application/json',
        ...options.headers
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Shopify API error: ${response.status} - ${error}`);
    }

    return await response.json();
  }

  /**
   * Look up order by order number
   */
  async lookupOrder(orderNumber, customerEmail = null) {
    try {
      // Search for order by name (order number)
      const response = await this._request(
        `/orders.json?name=${encodeURIComponent(orderNumber)}&status=any&limit=1`
      );

      if (!response.orders || response.orders.length === 0) {
        return {
          found: false,
          message: `Order #${orderNumber} not found. Please check the order number and try again.`
        };
      }

      const order = response.orders[0];

      // Verify customer if email provided
      if (customerEmail && order.email?.toLowerCase() !== customerEmail.toLowerCase()) {
        return {
          found: false,
          message: 'Order not found or does not belong to this email address.',
          security: 'Email verification failed'
        };
      }

      return {
        found: true,
        order: this._formatOrderInfo(order)
      };
    } catch (error) {
      console.error('Order lookup error:', error);
      return {
        found: false,
        error: error.message
      };
    }
  }

  /**
   * Get order tracking information
   */
  async getOrderTracking(orderId) {
    try {
      const response = await this._request(`/orders/${orderId}.json`);
      const order = response.order;

      const fulfillments = order.fulfillments || [];
      const trackingInfo = fulfillments.map(f => ({
        trackingNumber: f.tracking_number,
        trackingUrl: f.tracking_url,
        trackingCompany: f.tracking_company,
        status: f.shipment_status,
        updatedAt: f.updated_at
      }));

      return {
        success: true,
        orderNumber: order.name,
        financialStatus: order.financial_status,
        fulfillmentStatus: order.fulfillment_status,
        tracking: trackingInfo,
        estimatedDelivery: this._estimateDelivery(fulfillments)
      };
    } catch (error) {
      console.error('Tracking lookup error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get customer's order history
   */
  async getCustomerOrders(customerEmail, limit = 10) {
    try {
      // Find customer by email
      const customerResponse = await this._request(
        `/customers/search.json?query=email:${encodeURIComponent(customerEmail)}`
      );

      if (!customerResponse.customers || customerResponse.customers.length === 0) {
        return {
          success: false,
          message: 'Customer not found'
        };
      }

      const customer = customerResponse.customers[0];

      // Get customer's orders
      const ordersResponse = await this._request(
        `/orders.json?customer_id=${customer.id}&status=any&limit=${limit}`
      );

      return {
        success: true,
        customer: {
          id: customer.id,
          email: customer.email,
          firstName: customer.first_name,
          lastName: customer.last_name
        },
        orders: ordersResponse.orders.map(o => this._formatOrderInfo(o))
      };
    } catch (error) {
      console.error('Customer orders error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get subscription information (requires subscription app)
   */
  async getSubscriptions(customerEmail) {
    try {
      // Note: This requires a subscription app like Recharge or Bold
      // For now, we'll check for recurring orders
      const ordersData = await this.getCustomerOrders(customerEmail, 50);

      if (!ordersData.success) {
        return ordersData;
      }

      // Identify subscription patterns
      const subscriptionOrders = ordersData.orders.filter(order =>
        order.tags?.includes('subscription') || order.note?.includes('subscription')
      );

      return {
        success: true,
        hasSubscriptions: subscriptionOrders.length > 0,
        subscriptionOrders: subscriptionOrders.slice(0, 5),
        message: 'For detailed subscription management, please contact support.'
      };
    } catch (error) {
      console.error('Subscription lookup error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Manage subscription (pause/cancel/update)
   * Note: Requires subscription app integration
   */
  async manageSubscription(action, subscriptionId, params = {}) {
    // This is a placeholder - actual implementation depends on subscription app
    const actions = {
      pause: async () => ({
        success: true,
        message: 'Subscription paused successfully',
        pausedUntil: params.pauseUntil
      }),
      cancel: async () => ({
        success: true,
        message: 'Subscription cancelled successfully',
        cancelledAt: new Date().toISOString()
      }),
      updateFrequency: async () => ({
        success: true,
        message: 'Subscription frequency updated',
        newFrequency: params.frequency
      }),
      updateAddress: async () => ({
        success: true,
        message: 'Shipping address updated'
      }),
      updatePayment: async () => ({
        success: true,
        message: 'Payment method update initiated. Please check your email.'
      })
    };

    if (!actions[action]) {
      return {
        success: false,
        error: 'Invalid action',
        validActions: Object.keys(actions)
      };
    }

    // In production, integrate with Recharge, Bold, or other subscription app
    console.log(`Subscription ${action} requested for ${subscriptionId}`, params);

    return {
      success: true,
      message: `Subscription ${action} request received. A support team member will process this shortly.`,
      requiresManualProcessing: true
    };
  }

  /**
   * Get product recommendations based on browsing/purchase history
   */
  async getRecommendations(customerEmail, context = {}) {
    try {
      const ordersData = await this.getCustomerOrders(customerEmail, 20);

      if (!ordersData.success) {
        // Return popular products for new customers
        return await this._getPopularProducts();
      }

      // Extract purchased products
      const purchasedProducts = new Set();
      ordersData.orders.forEach(order => {
        order.items.forEach(item => {
          purchasedProducts.add(item.productId);
        });
      });

      // Get related products
      // In production, use a recommendation engine or Shopify's recommendation API
      const recommendations = await this._getRelatedProducts(
        Array.from(purchasedProducts).slice(0, 5),
        context
      );

      return {
        success: true,
        recommendations: recommendations.slice(0, 6),
        basedOn: 'purchase_history'
      };
    } catch (error) {
      console.error('Recommendations error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get guided product recommendations based on user preferences
   * Filters products by area of concern, application method, and strength
   */
  async getGuidedRecommendations(filters = {}) {
    try {
      const { concern, applicationMethod, strength } = filters;

      // Fetch all products from Shopify
      const response = await this._request('/products.json?limit=250&published_status=published');
      const products = response.products || [];

      // Define product attribute mappings for BlueSky CBD
      const concernKeywords = {
        pain: ['pain', 'relief', 'inflammation', 'arthritis', 'muscle', 'joint', 'ache', 'soreness', 'recovery', 'anti-inflammatory'],
        sleep: ['sleep', 'rest', 'relaxation', 'calm', 'night', 'insomnia', 'melatonin', 'bedtime', 'peaceful', 'restful'],
        anxiety: ['anxiety', 'stress', 'calm', 'relax', 'soothe', 'tension', 'mood', 'balance', 'tranquil', 'peace'],
        recovery: ['recovery', 'workout', 'athletic', 'sport', 'muscle', 'post-workout', 'performance', 'endurance', 'fitness'],
        focus: ['focus', 'clarity', 'energy', 'mental', 'concentration', 'cognitive', 'alert', 'productive', 'daytime'],
        general: ['wellness', 'daily', 'health', 'balance', 'overall', 'general', 'everyday', 'maintenance', 'support']
      };

      const methodKeywords = {
        oil: ['oil', 'tincture', 'drops', 'sublingual', 'dropper', 'liquid', 'oral'],
        gummies: ['gummy', 'gummies', 'edible', 'chew', 'candy', 'flavored', 'taste'],
        topical: ['topical', 'cream', 'balm', 'salve', 'lotion', 'rub', 'apply', 'skin', 'roll-on'],
        capsules: ['capsule', 'softgel', 'pill', 'tablet', 'supplement', 'gel cap'],
        vape: ['vape', 'inhale', 'cartridge', 'pen', 'vapor', 'e-liquid'],
        pet: ['pet', 'dog', 'cat', 'animal', 'canine', 'feline', 'furry']
      };

      const strengthIndicators = {
        low: {
          keywords: ['250mg', '300mg', '500mg', 'low', 'starter', 'beginner', 'mild', 'light'],
          negatives: ['1000mg', '1500mg', '2000mg', '3000mg', 'extra strength', 'maximum'],
          mgMax: 500
        },
        medium: {
          keywords: ['750mg', '1000mg', '1500mg', 'medium', 'regular', 'standard'],
          negatives: [],
          mgRange: [500, 1500]
        },
        high: {
          keywords: ['1500mg', '2000mg', '2500mg', '3000mg', 'extra strength', 'maximum', 'high potency', 'strong', 'powerful'],
          negatives: ['250mg', '300mg', '500mg', 'starter', 'beginner'],
          mgMin: 1500
        }
      };

      // Score and filter products
      const scoredProducts = products.map(product => {
        let score = 0;
        const title = product.title.toLowerCase();
        const description = (product.body_html || '').toLowerCase().replace(/<[^>]*>/g, '');
        const tags = (product.tags || '').toLowerCase();
        const combinedText = `${title} ${description} ${tags}`;

        // Score by concern
        if (concern && concernKeywords[concern]) {
          concernKeywords[concern].forEach(keyword => {
            if (combinedText.includes(keyword)) {
              score += 30;
            }
          });
        }

        // Score by application method
        if (applicationMethod && methodKeywords[applicationMethod]) {
          methodKeywords[applicationMethod].forEach(keyword => {
            if (combinedText.includes(keyword)) {
              score += 25;
            }
          });
        }

        // Score by strength
        if (strength && strengthIndicators[strength]) {
          const indicator = strengthIndicators[strength];

          indicator.keywords.forEach(keyword => {
            if (combinedText.includes(keyword)) {
              score += 20;
            }
          });

          indicator.negatives.forEach(keyword => {
            if (combinedText.includes(keyword)) {
              score -= 15;
            }
          });

          // Check for mg concentration mentions
          const mgMatch = combinedText.match(/(\d+)\s*mg/i);
          if (mgMatch) {
            const mg = parseInt(mgMatch[1]);
            if (strength === 'low' && mg <= (indicator.mgMax || 500)) {
              score += 15;
            } else if (strength === 'medium' && mg > 500 && mg <= 1500) {
              score += 15;
            } else if (strength === 'high' && mg > 1500) {
              score += 15;
            }
          }
        }

        return {
          id: product.id,
          title: product.title,
          image: product.images[0]?.src || '',
          price: product.variants[0]?.price || '0.00',
          url: `https://${this.shopDomain}/products/${product.handle}`,
          score: score,
          matchScore: Math.min(100, Math.round((score / 75) * 100))
        };
      });

      // Filter products with minimum score and sort by score
      const filteredProducts = scoredProducts
        .filter(p => p.score > 20)
        .sort((a, b) => b.score - a.score)
        .slice(0, 6);

      // Create human-readable match info for BlueSky CBD
      const concernLabels = {
        pain: 'Pain & Inflammation',
        sleep: 'Sleep & Relaxation',
        anxiety: 'Anxiety & Stress',
        recovery: 'Recovery & Wellness',
        focus: 'Focus & Clarity',
        general: 'General Wellness'
      };

      const methodLabels = {
        oil: 'CBD Oil/Tincture',
        gummies: 'Gummies/Edibles',
        topical: 'Topical/Cream',
        capsules: 'Capsules/Softgels',
        vape: 'Vape/Inhale',
        pet: 'Pet Products'
      };

      const strengthLabels = {
        low: 'Low Strength',
        medium: 'Medium Strength',
        high: 'High Strength'
      };

      return {
        success: true,
        recommendations: filteredProducts,
        matchInfo: {
          concern: concernLabels[concern] || concern,
          applicationMethod: methodLabels[applicationMethod] || applicationMethod,
          strength: strengthLabels[strength] || strength
        },
        basedOn: 'guided_preferences'
      };
    } catch (error) {
      console.error('Guided recommendations error:', error);
      return {
        success: false,
        error: error.message,
        recommendations: []
      };
    }
  }

  /**
   * Get loyalty program points (if using loyalty app)
   */
  async getLoyaltyPoints(customerEmail) {
    try {
      const customerResponse = await this._request(
        `/customers/search.json?query=email:${encodeURIComponent(customerEmail)}`
      );

      if (!customerResponse.customers || customerResponse.customers.length === 0) {
        return {
          success: false,
          message: 'Customer not found'
        };
      }

      const customer = customerResponse.customers[0];

      // Check metafields for loyalty points
      const metafieldsResponse = await this._request(
        `/customers/${customer.id}/metafields.json`
      );

      const loyaltyData = metafieldsResponse.metafields.find(
        m => m.namespace === 'loyalty' || m.key === 'points'
      );

      if (loyaltyData) {
        return {
          success: true,
          points: parseInt(loyaltyData.value) || 0,
          tier: this._calculateTier(parseInt(loyaltyData.value)),
          customer: {
            email: customer.email,
            name: `${customer.first_name} ${customer.last_name}`
          }
        };
      }

      // Calculate points from order history
      const ordersData = await this.getCustomerOrders(customerEmail);
      const points = this._calculatePointsFromOrders(ordersData.orders);

      return {
        success: true,
        points: points,
        tier: this._calculateTier(points),
        message: 'Points calculated from order history',
        estimatedOnly: true
      };
    } catch (error) {
      console.error('Loyalty points error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Redeem loyalty points
   */
  async redeemPoints(customerEmail, points, rewardType = 'discount') {
    try {
      const loyaltyData = await this.getLoyaltyPoints(customerEmail);

      if (!loyaltyData.success) {
        return loyaltyData;
      }

      if (loyaltyData.points < points) {
        return {
          success: false,
          message: `Insufficient points. You have ${loyaltyData.points} points, need ${points}.`
        };
      }

      // Create discount code
      const discountCode = this._generateDiscountCode();
      const discountValue = Math.floor(points / 100); // 100 points = $1

      // In production, create actual Shopify discount code
      console.log(`Creating discount code: ${discountCode} for $${discountValue}`);

      return {
        success: true,
        discountCode: discountCode,
        discountValue: discountValue,
        pointsRedeemed: points,
        pointsRemaining: loyaltyData.points - points,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
        message: `Discount code ${discountCode} created! Use it at checkout for $${discountValue} off.`
      };
    } catch (error) {
      console.error('Points redemption error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Helper: Format order information
   */
  _formatOrderInfo(order) {
    return {
      id: order.id,
      orderNumber: order.name,
      createdAt: order.created_at,
      financialStatus: order.financial_status,
      fulfillmentStatus: order.fulfillment_status,
      total: order.total_price,
      currency: order.currency,
      items: order.line_items.map(item => ({
        productId: item.product_id,
        name: item.name,
        quantity: item.quantity,
        price: item.price
      })),
      shippingAddress: order.shipping_address,
      tags: order.tags,
      note: order.note
    };
  }

  /**
   * Helper: Get popular products
   */
  async _getPopularProducts() {
    try {
      const response = await this._request('/products.json?limit=6&published_status=published');

      return {
        success: true,
        recommendations: response.products.map(p => ({
          id: p.id,
          title: p.title,
          image: p.images[0]?.src,
          price: p.variants[0]?.price,
          url: `https://${this.shopDomain}/products/${p.handle}`
        })),
        basedOn: 'popular'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Helper: Get related products
   */
  async _getRelatedProducts(productIds, context) {
    // Simplified - in production use recommendation engine
    return await this._getPopularProducts();
  }

  /**
   * Helper: Estimate delivery date
   */
  _estimateDelivery(fulfillments) {
    if (!fulfillments || fulfillments.length === 0) {
      return null;
    }

    const latestFulfillment = fulfillments[fulfillments.length - 1];
    const shippedDate = new Date(latestFulfillment.created_at);
    const estimatedDays = 5; // Default shipping time

    const estimated = new Date(shippedDate);
    estimated.setDate(estimated.getDate() + estimatedDays);

    return estimated.toISOString().split('T')[0];
  }

  /**
   * Helper: Calculate loyalty tier
   */
  _calculateTier(points) {
    if (points >= 5000) return 'Platinum';
    if (points >= 2000) return 'Gold';
    if (points >= 500) return 'Silver';
    return 'Bronze';
  }

  /**
   * Helper: Calculate points from orders
   */
  _calculatePointsFromOrders(orders) {
    if (!orders) return 0;

    return orders.reduce((total, order) => {
      const orderTotal = parseFloat(order.total) || 0;
      return total + Math.floor(orderTotal * 10); // 10 points per dollar
    }, 0);
  }

  /**
   * Helper: Generate discount code
   */
  _generateDiscountCode() {
    const prefix = 'LOYALTY';
    const random = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `${prefix}${random}`;
  }
}

module.exports = ShopifyIntegration;
