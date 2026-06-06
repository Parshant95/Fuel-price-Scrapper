// scraper/src/utils/dbWriter.js
const { FuelPrice, PriceHistory } = require('../models');
const logger = require('./logger');

const PRICE_CHANGE_THRESHOLD = 0.5; // ₹ — skip history write if change is trivial

/**
 * Saves validated prices to MongoDB.
 * - Upserts `fuel_prices` (latest only, one doc per state)
 * - Appends to `price_history` only if price changed meaningfully
 *
 * Returns { saved, skipped }
 */
async function savePrices(validPrices, sourceUrl) {
  let saved = 0;
  let skipped = 0;

  for (const entry of validPrices) {
    try {
      // Check what's currently stored for this state
      const existing = await FuelPrice.findOne({ state: entry.state });

      const petrolChanged = hasChanged(existing?.petrol_price, entry.petrol_price);
      const dieselChanged = hasChanged(existing?.diesel_price, entry.diesel_price);

      // Always upsert the latest price doc
      await FuelPrice.updateOne(
        { state: entry.state },
        {
          $set: {
            city:          entry.city,
            petrol_price:  entry.petrol_price,
            diesel_price:  entry.diesel_price,
            price_date:    entry.price_date,
            source_url:    sourceUrl,
            updated_at:    new Date(),
          },
        },
        { upsert: true }
      );

      // Only append history if prices actually changed
      if (!existing || petrolChanged || dieselChanged) {
        await PriceHistory.create({
          state:         entry.state,
          city:          entry.city,
          petrol_price:  entry.petrol_price,
          diesel_price:  entry.diesel_price,
          price_date:    entry.price_date,
          source_url:    sourceUrl,
          fetched_at:    new Date(),
        });
        saved++;
        logger.info('Price saved', {
          state: entry.state,
          petrol: entry.petrol_price,
          diesel: entry.diesel_price,
          changed: { petrol: petrolChanged, diesel: dieselChanged },
        });
      } else {
        skipped++;
        logger.debug('Price unchanged, skipping history write', { state: entry.state });
      }
    } catch (err) {
      logger.error('Failed to save entry', { state: entry.state, error: err.message });
    }
  }

  return { saved, skipped };
}

function hasChanged(oldPrice, newPrice) {
  if (oldPrice === null || oldPrice === undefined) return newPrice !== null;
  if (newPrice === null) return true;
  return Math.abs(oldPrice - newPrice) >= PRICE_CHANGE_THRESHOLD;
}

module.exports = { savePrices };
