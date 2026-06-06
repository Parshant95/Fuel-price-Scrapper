// scraper/src/scrapeRunner.js
const mongoose = require('mongoose');
const config = require('../config');
const logger = require('./utils/logger');
const { fetchAllStatesPricesPage } = require('./scrapers/webScraper');
const { parseWithGroq } = require('./parsers/groqParser');
const { validatePrices } = require('./validators/priceValidator');
const { savePrices } = require('./utils/dbWriter');
const { ScrapeRun } = require('./models');

/**
 * Full scrape pipeline:
 * 1. Fetch HTML from source
 * 2. Parse with Groq → structured JSON
 * 3. Validate prices
 * 4. Write to MongoDB
 */
async function runScrape() {
  const run = await ScrapeRun.create({
    started_at: new Date(),
    status: 'running',
    source_url: config.scraper.sourceUrl,
  });

  logger.info('═══ Scrape run started ═══', { runId: run._id });

  try {
    // Step 1: Fetch
    const pageText = await fetchAllStatesPricesPage();

    // Step 2: Parse via Groq
    const rawPrices = await parseWithGroq(pageText);

    // Step 3: Validate
    const { valid, invalid } = validatePrices(rawPrices);

    if (valid.length === 0) {
      throw new Error('No valid prices found after validation');
    }

    // Step 4: Save to DB
    const { saved, skipped } = await savePrices(valid, config.scraper.sourceUrl);

    await ScrapeRun.updateOne(
      { _id: run._id },
      {
        finished_at: new Date(),
        status: 'success',
        states_saved: saved,
      }
    );

    logger.info('═══ Scrape run complete ═══', {
      statesExtracted: rawPrices.length,
      valid: valid.length,
      invalid: invalid.length,
      saved,
      skipped,
    });

    return { success: true, saved, skipped };
  } catch (err) {
    logger.error('Scrape run failed', { error: err.message });

    await ScrapeRun.updateOne(
      { _id: run._id },
      {
        finished_at: new Date(),
        status: 'failed',
        error: err.message,
      }
    );

    return { success: false, error: err.message };
  }
}

module.exports = { runScrape };
