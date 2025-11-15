/**
 * Shopify Integration API Endpoint
 * Handles orders, subscriptions, recommendations, and loyalty
 */

const ShopifyIntegration = require('../lib/shopify');
const rateLimiter = require('../lib/rate-limiter');

module.exports = async (req, res) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.status(200)
      .setHeader('Access-Control-Allow-Origin', '*')
      .setHeader('Access-Control-Allow-Headers', 'Content-Type')
      .setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      .end();
    return;
  }

  // Rate limiting
  const identifier = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
  const rateCheck = rateLimiter.checkRateLimit(identifier, { type: 'shopify' });

  if (!rateCheck.allowed) {
    res.status(429).json({
      error: 'Rate limit exceeded',
      message: rateCheck.message
    });
    return;
  }

  try {
    const { action } = req.query;

    // Initialize Shopify API
    const shopify = new ShopifyIntegration({
      shopDomain: req.body.shopDomain || req.query.shopDomain,
      accessToken: process.env.SHOPIFY_ACCESS_TOKEN
    });

    switch (action) {
      case 'lookup-order':
        // Look up order by number
        const { orderNumber, customerEmail } = req.query;

        if (!orderNumber) {
          res.status(400).json({ error: 'Order number required' });
          return;
        }

        const orderResult = await shopify.lookupOrder(orderNumber, customerEmail);
        res.status(200).json(orderResult);
        break;

      case 'track-order':
        // Get tracking information
        const { orderId } = req.query;

        if (!orderId) {
          res.status(400).json({ error: 'Order ID required' });
          return;
        }

        const trackingResult = await shopify.getOrderTracking(orderId);
        res.status(200).json(trackingResult);
        break;

      case 'order-history':
        // Get customer's order history
        const email = req.query.email;

        if (!email) {
          res.status(400).json({ error: 'Email required' });
          return;
        }

        const historyResult = await shopify.getCustomerOrders(
          email,
          parseInt(req.query.limit) || 10
        );
        res.status(200).json(historyResult);
        break;

      case 'subscriptions':
        // Get subscription information
        if (!req.query.email) {
          res.status(400).json({ error: 'Email required' });
          return;
        }

        const subscriptionResult = await shopify.getSubscriptions(req.query.email);
        res.status(200).json(subscriptionResult);
        break;

      case 'manage-subscription':
        // Manage subscription (pause/cancel/update)
        const { subscriptionAction, subscriptionId } = req.body;

        if (!subscriptionAction || !subscriptionId) {
          res.status(400).json({
            error: 'subscriptionAction and subscriptionId required'
          });
          return;
        }

        const manageResult = await shopify.manageSubscription(
          subscriptionAction,
          subscriptionId,
          req.body.params || {}
        );
        res.status(200).json(manageResult);
        break;

      case 'recommendations':
        // Get product recommendations
        const recEmail = req.query.email;

        if (!recEmail) {
          res.status(400).json({ error: 'Email required' });
          return;
        }

        const recommendationsResult = await shopify.getRecommendations(
          recEmail,
          {
            currentProduct: req.query.productId,
            context: req.query.context
          }
        );
        res.status(200).json(recommendationsResult);
        break;

      case 'loyalty-points':
        // Get loyalty points
        const loyaltyEmail = req.query.email;

        if (!loyaltyEmail) {
          res.status(400).json({ error: 'Email required' });
          return;
        }

        const pointsResult = await shopify.getLoyaltyPoints(loyaltyEmail);
        res.status(200).json(pointsResult);
        break;

      case 'redeem-points':
        // Redeem loyalty points
        const { email: redeemEmail, points, rewardType } = req.body;

        if (!redeemEmail || !points) {
          res.status(400).json({ error: 'Email and points required' });
          return;
        }

        const redeemResult = await shopify.redeemPoints(
          redeemEmail,
          parseInt(points),
          rewardType
        );
        res.status(200).json(redeemResult);
        break;

      default:
        res.status(400).json({
          error: 'Invalid action',
          validActions: [
            'lookup-order',
            'track-order',
            'order-history',
            'subscriptions',
            'manage-subscription',
            'recommendations',
            'loyalty-points',
            'redeem-points'
          ]
        });
    }
  } catch (error) {
    console.error('Shopify API error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};
