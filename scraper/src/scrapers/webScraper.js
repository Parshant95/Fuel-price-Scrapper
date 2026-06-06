// scraper/src/scrapers/webScraper.js
const axios = require('axios');
const cheerio = require('cheerio');
const config = require('../../config');
const logger = require('../utils/logger');

/**
 * Fetches the fuel price page and returns relevant text.
 * Strips scripts, styles, and ads to reduce token usage before
 * sending to Groq.
 */
async function fetchFuelPricePage() {
  logger.info('Fetching fuel price page...', { url: config.scraper.sourceUrl });

  const response = await axios.get(config.scraper.sourceUrl, {
    timeout: config.scraper.timeoutMs,
    headers: {
      // Mimic a real browser to avoid 403 blocks
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept-Language': 'en-IN,en;q=0.9',
      Accept: 'text/html,application/xhtml+xml',
    },
  });

  const $ = cheerio.load(response.data);

  // Remove noise elements to save Groq context tokens
  $('script, style, noscript, iframe, nav, footer, header, .ads, .advertisement, #comments').remove();

  // Extract only the main content text
  const cleanText = $('body').text().replace(/\s+/g, ' ').trim();

  // Trim to max allowed chars for Groq context
  const trimmed = cleanText.substring(0, config.scraper.maxHtmlChars);

  logger.info('Page fetched and cleaned', {
    originalLength: response.data.length,
    cleanedLength: trimmed.length,
  });

  return trimmed;
}

/**
 * Alternative: fetch the petrol price listing page for a specific state.
 * Use this if the main page doesn't have all states.
 */
async function fetchAllStatesPricesPage() {
  const url = `${config.scraper.sourceUrl}/Petrol-Price-in-India.aspx`;
  logger.info('Fetching all-states page', { url });

  const response = await axios.get(url, {
    timeout: config.scraper.timeoutMs,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept-Language': 'en-IN,en;q=0.9',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      Referer: 'https://www.google.com/',
    },
  });

  const $ = cheerio.load(response.data);
  $('script, style, noscript, iframe, .ads').remove();

  // Target the main price table/list specifically
  const tableText = $('table, .price-list, .state-price, main').text();
  const cleanText = (tableText || $('body').text()).replace(/\s+/g, ' ').trim();

  return cleanText.substring(0, config.scraper.maxHtmlChars);
}

module.exports = { fetchFuelPricePage, fetchAllStatesPricesPage };
