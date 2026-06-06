// scraper/src/parsers/groqParser.js
const Groq = require('groq-sdk');
const config = require('../../config');
const logger = require('../utils/logger');

const groq = new Groq({ apiKey: config.groq.apiKey });

const SYSTEM_PROMPT = `You are a precise data extraction assistant.
Your job is to extract fuel prices from raw webpage text for Indian states.
You MUST respond with ONLY valid JSON. No explanation, no markdown, no code fences.
If a price is missing or unclear, use null.
Always use numbers (not strings) for prices.`;

const USER_PROMPT_TEMPLATE = (pageText) => `
Extract today's fuel prices for ALL Indian states from this webpage text.

Return ONLY a JSON array in this exact format:
[
  {
    "state": "Maharashtra",
    "city": "Mumbai",
    "petrol_price": 104.21,
    "diesel_price": 92.15,
    "cng_price": 76.50,
    "date": "YYYY-MM-DD or as found on page"
  }
]

Rules:
- Include every state you can find
- Prices must be numbers in ₹/litre (CNG in ₹/kg)
- If only city prices are listed, use the major city for each state
- If a price is not found, set it to null
- date field: use the date mentioned on the page, or today if not found

Webpage text:
${pageText}
`;

/**
 * Sends the cleaned page text to Groq and parses the response into
 * a structured array of fuel price objects.
 */
async function parseWithGroq(pageText) {
  logger.info('Sending to Groq for parsing...', { model: config.groq.model });

  const response = await groq.chat.completions.create({
    model: config.groq.model,
    temperature: 0,        // Zero temperature = deterministic, best for extraction
    max_tokens: 4096,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: USER_PROMPT_TEMPLATE(pageText) },
    ],
  });

  const rawContent = response.choices[0]?.message?.content?.trim();
  logger.info('Groq response received', { length: rawContent?.length });

  if (!rawContent) {
    throw new Error('Groq returned an empty response');
  }

  // Strip markdown code fences if Groq adds them despite instructions
  const cleaned = rawContent
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    logger.error('Failed to parse Groq JSON response', { raw: cleaned.substring(0, 500) });
    throw new Error(`Groq response was not valid JSON: ${err.message}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Groq response was not an array');
  }

  logger.info('Groq parsing complete', { statesFound: parsed.length });
  return parsed;
}

module.exports = { parseWithGroq };
