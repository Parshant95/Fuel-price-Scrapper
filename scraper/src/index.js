// scraper/src/index.js
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const cron = require('node-cron');
const mongoose = require('mongoose');
const config = require('../config');
const logger = require('./utils/logger');
const { runScrape } = require('./scrapeRunner');

async function connectDB() {
  logger.info('Connecting to MongoDB...', { uri: config.mongodb.uri.replace(/\/\/.*@/, '//***@') });
  await mongoose.connect(config.mongodb.uri);
  logger.info('MongoDB connected');
}

async function main() {
  await connectDB();

  const runOnce = process.argv.includes('--run-once');

  if (runOnce) {
    // Used for testing: npm run scrape
    logger.info('Running single scrape (--run-once mode)');
    const result = await runScrape();
    logger.info('Single scrape finished', result);
    await mongoose.disconnect();
    process.exit(result.success ? 0 : 1);
  } else {
    // Normal mode: run immediately on start, then on schedule
    logger.info('Scraper starting up — running initial scrape now...');
    await runScrape();

    logger.info('Scheduling cron job', { schedule: config.scraper.schedule });
    cron.schedule(config.scraper.schedule, async () => {
      logger.info('Cron triggered scrape');
      await runScrape();
    });

    logger.info('Scraper running. Press Ctrl+C to stop.');
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down scraper...');
  await mongoose.disconnect();
  process.exit(0);
});

main().catch((err) => {
  logger.error('Fatal error in scraper', { error: err.message });
  process.exit(1);
});
