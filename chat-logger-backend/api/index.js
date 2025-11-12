/**
 * Vercel Serverless Function - Main Endpoint
 * Receives and stores anonymous chat logs
 */

const { handler } = require('../index');

module.exports = async (req, res) => {
  // Convert Vercel request to Lambda-style event
  const event = {
    httpMethod: req.method,
    headers: req.headers,
    body: JSON.stringify(req.body)
  };

  // Call main handler
  const response = await handler(event, {});

  // Convert Lambda-style response to Vercel response
  res.status(response.statusCode);

  Object.entries(response.headers).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  res.send(response.body);
};
