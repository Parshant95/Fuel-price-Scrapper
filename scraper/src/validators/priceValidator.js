// scraper/src/validators/priceValidator.js
const logger = require('../utils/logger');

// Realistic price bounds for Indian fuel in ₹/litre
const PRICE_BOUNDS = {
  petrol: { min: 80, max: 130 },
  diesel: { min: 70, max: 120 },
  cng:    { min: 50, max: 120 },
};

// Known Indian states for sanity check
const KNOWN_STATES = new Set([
  'andhra pradesh', 'arunachal pradesh', 'assam', 'bihar', 'chhattisgarh',
  'goa', 'gujarat', 'haryana', 'himachal pradesh', 'jharkhand', 'karnataka',
  'kerala', 'madhya pradesh', 'maharashtra', 'manipur', 'meghalaya', 'mizoram',
  'nagaland', 'odisha', 'punjab', 'rajasthan', 'sikkim', 'tamil nadu',
  'telangana', 'tripura', 'uttar pradesh', 'uttarakhand', 'west bengal',
  'delhi', 'jammu and kashmir', 'ladakh', 'chandigarh', 'puducherry',
  'andaman and nicobar', 'andaman and nicobar islands', 'dadra and nagar haveli',
  'daman and diu', 'lakshadweep', 'pondicherry',
]);

function isValidPrice(price, type) {
  if (price === null || price === undefined) return false;
  const num = parseFloat(price);
  if (isNaN(num)) return false;
  const bounds = PRICE_BOUNDS[type];
  return num >= bounds.min && num <= bounds.max;
}

function isKnownState(stateName) {
  return KNOWN_STATES.has(stateName?.toLowerCase()?.trim());
}

/**
 * Validates and normalises the raw parsed array from Groq.
 * Returns { valid: [...], invalid: [...] }
 */
function validatePrices(rawPrices) {
  const valid = [];
  const invalid = [];

  for (const entry of rawPrices) {
    const errors = [];

    // Must have a state name
    if (!entry.state || typeof entry.state !== 'string') {
      errors.push('missing state name');
    }

    // Warn on unknown states (don't reject — Groq might use abbreviations)
    if (entry.state && !isKnownState(entry.state)) {
      logger.warn('Unrecognised state name', { state: entry.state });
    }

    // Validate petrol price
    if (!isValidPrice(entry.petrol_price, 'petrol')) {
      if (entry.petrol_price !== null) {
        errors.push(`petrol price out of range: ${entry.petrol_price}`);
      }
    }

    // Validate diesel price
    if (!isValidPrice(entry.diesel_price, 'diesel')) {
      if (entry.diesel_price !== null) {
        errors.push(`diesel price out of range: ${entry.diesel_price}`);
      }
    }

    // Validate CNG price (optional — not all states have CNG)
    if (entry.cng_price !== null && entry.cng_price !== undefined) {
      if (!isValidPrice(entry.cng_price, 'cng')) {
        errors.push(`cng price out of range: ${entry.cng_price}`);
      }
    }

    // Require at least one valid price
    const hasPetrol = isValidPrice(entry.petrol_price, 'petrol');
    const hasDiesel = isValidPrice(entry.diesel_price, 'diesel');
    const hasCng    = isValidPrice(entry.cng_price, 'cng');
    if (!hasPetrol && !hasDiesel) {
      errors.push('no valid price found for either fuel type');
    }

    if (errors.length > 0) {
      invalid.push({ entry, errors });
      logger.warn('Invalid entry skipped', { state: entry.state, errors });
    } else {
      valid.push({
        state:        entry.state.trim(),
        city:         entry.city?.trim() || null,
        petrol_price: hasPetrol ? parseFloat(entry.petrol_price) : null,
        diesel_price: hasDiesel ? parseFloat(entry.diesel_price) : null,
        cng_price:    hasCng    ? parseFloat(entry.cng_price)    : null,
        price_date:   entry.date || new Date().toISOString().split('T')[0],
      });
    }
  }

  logger.info('Validation complete', {
    total: rawPrices.length,
    valid: valid.length,
    invalid: invalid.length,
  });

  return { valid, invalid };
}

module.exports = { validatePrices };
