// routes/indicators.js
// Express routes for all macroeconomic indicator endpoints

const express = require('express');
const router = express.Router();
const { fetchIndicator } = require('../services/worldBankService');
const fallback = require('../data.json');

const INDICATORS = {
  gdp: 'NY.GDP.MKTP.KD.ZG',
  inflation: 'FP.CPI.TOTL.ZG',
  unemployment: 'SL.UEM.TOTL.ZS',
  percapita: 'NY.GDP.PCAP.CD',
};

// Helper: get country code from query param, default IND
function getCode(req) {
  return (req.query.country || 'IND').toUpperCase();
}

// Helper: get fallback data for a country + field
function getFallback(code, field) {
  const country = fallback[code] || fallback['IND'];
  return country[field] || [];
}

// ─── GDP Growth ────────────────────────────────────────────────────────────────
router.get('/gdp', async (req, res) => {
  const code = getCode(req);
  try {
    const data = await fetchIndicator(code, INDICATORS.gdp);
    res.json({ source: 'worldbank', country: code, data });
  } catch {
    res.json({ source: 'fallback', country: code, data: getFallback(code, 'gdp') });
  }
});

// ─── Inflation ─────────────────────────────────────────────────────────────────
router.get('/inflation', async (req, res) => {
  const code = getCode(req);
  try {
    const data = await fetchIndicator(code, INDICATORS.inflation);
    res.json({ source: 'worldbank', country: code, data });
  } catch {
    res.json({ source: 'fallback', country: code, data: getFallback(code, 'inflation') });
  }
});

// ─── Unemployment ──────────────────────────────────────────────────────────────
router.get('/unemployment', async (req, res) => {
  const code = getCode(req);
  try {
    const data = await fetchIndicator(code, INDICATORS.unemployment);
    res.json({ source: 'worldbank', country: code, data });
  } catch {
    res.json({ source: 'fallback', country: code, data: getFallback(code, 'unemployment') });
  }
});

// ─── Per Capita Income ─────────────────────────────────────────────────────────
router.get('/percapita', async (req, res) => {
  const code = getCode(req);
  try {
    const data = await fetchIndicator(code, INDICATORS.percapita);
    res.json({ source: 'worldbank', country: code, data });
  } catch {
    res.json({ source: 'fallback', country: code, data: getFallback(code, 'percapita') });
  }
});

// ─── GDP Total (USD Trillion) ──────────────────────────────────────────────────
router.get('/gdp-total', async (req, res) => {
  const code = getCode(req);
  // World Bank: NY.GDP.MKTP.CD → current USD, we convert to trillions in transform
  try {
    const raw = await fetchIndicator(code, 'NY.GDP.MKTP.CD');
    const data = raw.map(d => ({ year: d.year, value: parseFloat((d.value / 1e12).toFixed(2)) }));
    res.json({ source: 'worldbank', country: code, data });
  } catch {
    const country = fallback[code] || fallback['IND'];
    res.json({ source: 'fallback', country: code, data: country.gdpTotal || [] });
  }
});

// ─── GDP Components (C, I, G, X-M) ────────────────────────────────────────────
router.get('/gdp-components', async (req, res) => {
  const code = getCode(req);
  // World Bank doesn't have a single endpoint for all components;
  // we serve from our enriched fallback dataset
  const country = fallback[code] || fallback['IND'];
  res.json({ source: 'fallback', country: code, data: country.gdpComponents });
});

// ─── Sector-wise GDP ───────────────────────────────────────────────────────────
router.get('/sectors', async (req, res) => {
  const code = getCode(req);
  const country = fallback[code] || fallback['IND'];
  res.json({ source: 'fallback', country: code, data: country.sectors });
});

// ─── Country list ──────────────────────────────────────────────────────────────
router.get('/countries', (req, res) => {
  const list = Object.entries(fallback).map(([code, v]) => ({ code, name: v.name }));
  res.json(list);
});

// ─── Summary (all 4 latest figures) ───────────────────────────────────────────
router.get('/summary', async (req, res) => {
  const code = getCode(req);
  const pick = arr => arr.length ? arr[arr.length - 1] : null;

  async function safeFetch(field, indicator) {
    try {
      const data = await fetchIndicator(code, indicator);
      return pick(data);
    } catch {
      return pick(getFallback(code, field));
    }
  }

  const [gdp, inflation, unemployment, percapita] = await Promise.all([
    safeFetch('gdp', INDICATORS.gdp),
    safeFetch('inflation', INDICATORS.inflation),
    safeFetch('unemployment', INDICATORS.unemployment),
    safeFetch('percapita', INDICATORS.percapita),
  ]);

  res.json({ country: code, gdp, inflation, unemployment, percapita });
});

module.exports = router;
