// services/worldBankService.js
// Fetches data from the World Bank API with caching

const fetch = require('node-fetch');

const WB_BASE = 'https://api.worldbank.org/v2/country';
const CACHE = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Fetch a World Bank indicator for a country over multiple years.
 * Returns array of { year, value } sorted ascending.
 */
async function fetchIndicator(countryCode, indicator, dateRange = '2014:2023') {
  const cacheKey = `${countryCode}_${indicator}`;
  const cached = CACHE.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  const url = `${WB_BASE}/${countryCode}/indicator/${indicator}?format=json&date=${dateRange}&per_page=20&mrv=10`;

  try {
    const res = await fetch(url, { timeout: 8000 });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const json = await res.json();
    if (!Array.isArray(json) || json.length < 2 || !json[1]) {
      throw new Error('Unexpected API response structure');
    }

    const data = json[1]
      .filter(d => d.value !== null && d.value !== undefined)
      .map(d => ({ year: parseInt(d.date), value: parseFloat(d.value.toFixed(2)) }))
      .sort((a, b) => a.year - b.year);

    if (data.length === 0) throw new Error('No data returned');

    CACHE.set(cacheKey, { data, ts: Date.now() });
    return data;
  } catch (err) {
    console.warn(`[WorldBank] Failed for ${countryCode}/${indicator}: ${err.message}`);
    throw err;
  }
}

module.exports = { fetchIndicator };
