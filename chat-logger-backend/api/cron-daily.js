/**
 * Vercel Serverless Function - Daily Cron Job
 * Sends daily email report of chat logs
 *
 * This endpoint is called automatically by Vercel Cron at 9 AM daily
 * Schedule configured in vercel.json
 */

const { sendDailyReport } = require('../index');

module.exports = async (req, res) => {
  // Verify this is a cron request from Vercel
  const authHeader = req.headers.authorization || '';
  const cronSecret = process.env.CRON_SECRET || 'default-secret-change-me';

  if (authHeader !== `Bearer ${cronSecret}`) {
    console.warn('Unauthorized cron attempt');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  console.log('Starting daily chat report cron job...');

  try {
    await sendDailyReport();
    console.log('Daily report sent successfully');

    res.status(200).json({
      success: true,
      message: 'Daily report sent',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to send daily report:', error);

    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};
