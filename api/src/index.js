// api/src/index.js
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const priceRoutes = require('./routes/prices');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 4000;

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

// Rate limit: 100 requests per 15 minutes per IP
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/prices', priceRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ─── Error handler ────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err.message });
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Start ────────────────────────────────────────────────────────────────────
async function start() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fuel_tracker');
  logger.info('MongoDB connected');

  app.listen(PORT, () => {
    logger.info(`API server running on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  logger.error('Failed to start API', { error: err.message });
  process.exit(1);
});
