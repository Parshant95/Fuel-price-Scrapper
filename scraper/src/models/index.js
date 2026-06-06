// scraper/src/models/index.js
const mongoose = require('mongoose');

// ─── Latest price per state (upserted on every scrape) ────────────────────────
const fuelPriceSchema = new mongoose.Schema(
  {
    state:         { type: String, required: true, index: true },
    city:          { type: String, default: null },
    petrol_price:  { type: Number, default: null },
    diesel_price:  { type: Number, default: null },
    price_date:    { type: String },               // "YYYY-MM-DD"
    source_url:    { type: String },
    updated_at:    { type: Date, default: Date.now },
  },
  { timestamps: false }
);

// One document per state — used for fast latest-price lookups
fuelPriceSchema.index({ state: 1 }, { unique: true });

// ─── Full price history (append-only) ─────────────────────────────────────────
const priceHistorySchema = new mongoose.Schema(
  {
    state:         { type: String, required: true, index: true },
    city:          { type: String, default: null },
    petrol_price:  { type: Number, default: null },
    diesel_price:  { type: Number, default: null },
    price_date:    { type: String },
    source_url:    { type: String },
    fetched_at:    { type: Date, default: Date.now, index: true },
  },
  { timestamps: false }
);

// Compound index for efficient state + time range queries
priceHistorySchema.index({ state: 1, fetched_at: -1 });

// Auto-expire history older than 180 days (optional — remove if you want forever)
priceHistorySchema.index({ fetched_at: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 });

// ─── Scrape run log ────────────────────────────────────────────────────────────
const scrapeRunSchema = new mongoose.Schema({
  started_at:   { type: Date, default: Date.now },
  finished_at:  { type: Date },
  status:       { type: String, enum: ['running', 'success', 'failed'], default: 'running' },
  states_saved: { type: Number, default: 0 },
  error:        { type: String, default: null },
  source_url:   { type: String },
});

module.exports = {
  FuelPrice:    mongoose.model('FuelPrice', fuelPriceSchema),
  PriceHistory: mongoose.model('PriceHistory', priceHistorySchema),
  ScrapeRun:    mongoose.model('ScrapeRun', scrapeRunSchema),
};
