// api/src/routes/prices.js
const express = require('express');
const router = express.Router();
const pricesController = require('../controllers/pricesController');

// GET /api/prices/latest         → all states latest prices
// GET /api/prices/:state         → single state latest price
// GET /api/prices/:state/history → price history for a state
// GET /api/prices/runs/latest    → last scrape run info

router.get('/latest', pricesController.getAllLatest);
router.get('/runs/latest', pricesController.getLatestRun);
router.get('/:state/history', pricesController.getStateHistory);
router.get('/:state', pricesController.getStatePrice);

module.exports = router;
