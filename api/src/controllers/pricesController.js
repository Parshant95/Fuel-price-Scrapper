// api/src/controllers/pricesController.js
const mongoose = require('mongoose');

// ─── State name normalizer ────────────────────────────────────────────────────
// Maps common variants (from GPS/geocoding APIs) to the canonical DB name
const STATE_ALIASES = {
  'jammu & kashmir':              'Jammu and Kashmir',
  'jammu and kashmir':            'Jammu and Kashmir',
  'j&k':                          'Jammu and Kashmir',
  'andaman & nicobar':            'Andaman and Nicobar',
  'andaman & nicobar islands':    'Andaman and Nicobar',
  'andaman and nicobar islands':  'Andaman and Nicobar',
  'dadra & nagar haveli':         'Dadra and Nagar Haveli',
  'dadra and nagar haveli and daman and diu': 'Dadra and Nagar Haveli',
  'daman & diu':                  'Daman and Diu',
  'delhi':                        'Delhi',
  'new delhi':                    'Delhi',
  'ncr':                          'Delhi',
  'odisha':                       'Odisha',
  'orissa':                       'Odisha',
  'uttarakhand':                  'Uttarakhand',
  'uttaranchal':                  'Uttarakhand',
  'telangana':                    'Telangana',
  'pondicherry':                  'Puducherry',
  'puducherry':                   'Puducherry',
};

function normalizeState(name) {
  if (!name) return name;
  const trimmed = name.trim();
  const lower = trimmed.toLowerCase();
  return STATE_ALIASES[lower] || trimmed;
}

// ─── Inline models (shared with scraper via MongoDB) ──────────────────────────
const FuelPrice = mongoose.models.FuelPrice || mongoose.model('FuelPrice',
  new mongoose.Schema({
    state:        String,
    city:         String,
    petrol_price: Number,
    diesel_price: Number,
    cng_price:    Number,
    price_date:   String,
    source_url:   String,
    updated_at:   Date,
  })
);

const PriceHistory = mongoose.models.PriceHistory || mongoose.model('PriceHistory',
  new mongoose.Schema({
    state:        { type: String, index: true },
    city:         String,
    petrol_price: Number,
    diesel_price: Number,
    cng_price:    Number,
    price_date:   String,
    source_url:   String,
    fetched_at:   { type: Date, index: true },
  })
);

const ScrapeRun = mongoose.models.ScrapeRun || mongoose.model('ScrapeRun',
  new mongoose.Schema({
    started_at:   Date,
    finished_at:  Date,
    status:       String,
    states_saved: Number,
    error:        String,
    source_url:   String,
  })
);

// ─── GET /api/prices/latest ───────────────────────────────────────────────────
exports.getAllLatest = async (req, res) => {
  try {
    const prices = await FuelPrice
      .find({}, '-__v -source_url')
      .sort({ state: 1 })
      .lean();

    res.set('Cache-Control', 'public, max-age=1800'); // Cache 30 min in CDN/browser
    res.json({
      count: prices.length,
      updated_at: prices[0]?.updated_at || null,
      data: prices,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── GET /api/prices/:state ───────────────────────────────────────────────────
exports.getStatePrice = async (req, res) => {
  try {
    const stateName = normalizeState(decodeURIComponent(req.params.state));
    const price = await FuelPrice
      .findOne({ state: new RegExp(`^${stateName}$`, 'i') }, '-__v')
      .lean();

    if (!price) {
      return res.status(404).json({ error: `No price data found for state: ${stateName}` });
    }

    res.set('Cache-Control', 'public, max-age=1800');
    res.json({ data: price });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── GET /api/prices/:state/history ──────────────────────────────────────────
exports.getStateHistory = async (req, res) => {
  try {
    const stateName = normalizeState(decodeURIComponent(req.params.state));
    const limit = Math.min(parseInt(req.query.limit) || 30, 100);
    const days = parseInt(req.query.days) || 30;

    const since = new Date();
    since.setDate(since.getDate() - days);

    const history = await PriceHistory
      .find({
        state: new RegExp(`^${stateName}$`, 'i'),
        fetched_at: { $gte: since },
      })
      .sort({ fetched_at: -1 })
      .limit(limit)
      .lean();

    res.json({
      state: stateName,
      count: history.length,
      days_back: days,
      data: history,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── GET /api/prices/runs/latest ─────────────────────────────────────────────
exports.getLatestRun = async (req, res) => {
  try {
    const run = await ScrapeRun.findOne().sort({ started_at: -1 }).lean();
    res.json({ data: run });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
