/**
 * Daily Email Report - Cron Job Handler
 *
 * This script sends the daily email report of chat logs.
 * Run this daily via cron, GitHub Actions, or serverless cron (Vercel Cron, AWS EventBridge)
 *
 * Usage:
 *   node cron-daily-report.js
 *
 * Or schedule with crontab:
 *   0 9 * * * /usr/bin/node /path/to/cron-daily-report.js
 */

const { sendDailyReport } = require('./index');

async function main() {
  console.log('Starting daily chat log report...');
  console.log('Time:', new Date().toISOString());

  try {
    await sendDailyReport();
    console.log('Daily report completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Failed to send daily report:', error);
    process.exit(1);
  }
}

main();
