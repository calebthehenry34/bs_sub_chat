/**
 * Suggestions & Quick Replies API Endpoint
 * Provides auto-complete suggestions and context-aware quick actions
 */

const suggestionsEngine = require('../lib/suggestions');
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
  const rateCheck = rateLimiter.checkRateLimit(identifier, { type: 'suggestions' });

  if (!rateCheck.allowed) {
    res.status(429).json({
      error: 'Rate limit exceeded',
      message: rateCheck.message
    });
    return;
  }

  try {
    const { action } = req.query;

    switch (action) {
      case 'autocomplete':
        // Get auto-complete suggestions
        const { input, limit } = req.query;
        const context = req.body?.context || {};

        const suggestions = suggestionsEngine.getSuggestions(
          input,
          parseInt(limit) || 5,
          context
        );

        res.status(200).json(suggestions);
        break;

      case 'quick-replies':
        // Get smart quick replies
        const quickRepliesContext = {
          lastIntent: req.query.lastIntent || req.body?.lastIntent,
          customerEmail: req.query.email || req.body?.email,
          sessionId: req.query.sessionId || req.body?.sessionId,
          conversationState: req.body?.conversationState
        };

        const quickReplies = await suggestionsEngine.getQuickReplies(quickRepliesContext);
        res.status(200).json(quickReplies);
        break;

      case 'follow-up':
        // Get follow-up questions
        const { intent } = req.query;
        const data = req.body?.data || {};

        const followUps = suggestionsEngine.getFollowUpQuestions(intent, data);
        res.status(200).json({
          intent,
          followUpQuestions: followUps
        });
        break;

      case 'prompt':
        // Get conversational prompts
        const { state } = req.query;
        const prompt = suggestionsEngine.getConversationalPrompts(state || 'initial');

        res.status(200).json({
          prompt,
          state: state || 'initial'
        });
        break;

      default:
        res.status(400).json({
          error: 'Invalid action',
          validActions: ['autocomplete', 'quick-replies', 'follow-up', 'prompt']
        });
    }
  } catch (error) {
    console.error('Suggestions error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};
