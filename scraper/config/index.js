// scraper/config/index.js
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

module.exports = {
  groq: {
    apiKey: process.env.GROQ_API_KEY,
    model: process.env.GROQ_MODEL || 'llama3-70b-8192',
  },
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/fuel_tracker',
  },
  scraper: {
    schedule: process.env.SCRAPE_SCHEDULE || '0 7,18 * * *',
    sourceUrl: process.env.SCRAPE_SOURCE_URL || 'https://www.mypetrolprice.com',
    timeoutMs: parseInt(process.env.SCRAPE_TIMEOUT_MS) || 15000,
    maxHtmlChars: parseInt(process.env.MAX_HTML_CHARS) || 14000,
  },
  log: {
    level: process.env.LOG_LEVEL || 'info',
  },
};
