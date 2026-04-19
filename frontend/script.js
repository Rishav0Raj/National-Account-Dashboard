/* ═══════════════════════════════════════════════════════════════
   National Accounts Dashboard — script.js
   Features: 33 countries · GDP rankings · Download charts ·
             Comparison (GDP Total + Growth + Inflation +
             Unemployment + Per Capita)
═══════════════════════════════════════════════════════════════ */
'use strict';

// ─── CONFIG ───────────────────────────────────────────────────
const API_BASE = 'http://localhost:3000';   // Update with your Render backend URL

// Master country registry (code → { name, flag, region })
const COUNTRIES = {
  IND: { name:'India',          flag:'🇮🇳', region:'Asia' },
  CHN: { name:'China',          flag:'🇨🇳', region:'Asia' },
  JPN: { name:'Japan',          flag:'🇯🇵', region:'Asia' },
  KOR: { name:'South Korea',    flag:'🇰🇷', region:'Asia' },
  IDN: { name:'Indonesia',      flag:'🇮🇩', region:'Asia' },
  THA: { name:'Thailand',       flag:'🇹🇭', region:'Asia' },
  MYS: { name:'Malaysia',       flag:'🇲🇾', region:'Asia' },
  VNM: { name:'Vietnam',        flag:'🇻🇳', region:'Asia' },
  PAK: { name:'Pakistan',       flag:'🇵🇰', region:'Asia' },
  BGD: { name:'Bangladesh',     flag:'🇧🇩', region:'Asia' },
  IRN: { name:'Iran',           flag:'🇮🇷', region:'Asia' },
  USA: { name:'United States',  flag:'🇺🇸', region:'Americas' },
  CAN: { name:'Canada',         flag:'🇨🇦', region:'Americas' },
  BRA: { name:'Brazil',         flag:'🇧🇷', region:'Americas' },
  MEX: { name:'Mexico',         flag:'🇲🇽', region:'Americas' },
  ARG: { name:'Argentina',      flag:'🇦🇷', region:'Americas' },
  DEU: { name:'Germany',        flag:'🇩🇪', region:'Europe' },
  GBR: { name:'United Kingdom', flag:'🇬🇧', region:'Europe' },
  FRA: { name:'France',         flag:'🇫🇷', region:'Europe' },
  NLD: { name:'Netherlands',    flag:'🇳🇱', region:'Europe' },
  CHE: { name:'Switzerland',    flag:'🇨🇭', region:'Europe' },
  SWE: { name:'Sweden',         flag:'🇸🇪', region:'Europe' },
  NOR: { name:'Norway',         flag:'🇳🇴', region:'Europe' },
  DNK: { name:'Denmark',        flag:'🇩🇰', region:'Europe' },
  FIN: { name:'Finland',        flag:'🇫🇮', region:'Europe' },
  POL: { name:'Poland',         flag:'🇵🇱', region:'Europe' },
  TUR: { name:'Turkey',         flag:'🇹🇷', region:'Europe' },
  SAU: { name:'Saudi Arabia',   flag:'🇸🇦', region:'Middle East & Africa' },
  ARE: { name:'UAE',            flag:'🇦🇪', region:'Middle East & Africa' },
  EGY: { name:'Egypt',          flag:'🇪🇬', region:'Middle East & Africa' },
  NGA: { name:'Nigeria',        flag:'🇳🇬', region:'Middle East & Africa' },
  ZAF: { name:'South Africa',   flag:'🇿🇦', region:'Middle East & Africa' },
  AUS: { name:'Australia',      flag:'🇦🇺', region:'Oceania' },
};

// Color palette
const C = {
  copper:  { line:'#c17d3c', fill:'rgba(193,125,60,0.13)' },
  green:   { line:'#2d6a4f', fill:'rgba(45,106,79,0.13)'  },
  blue:    { line:'#2471a3', fill:'rgba(36,113,163,0.13)' },
  purple:  { line:'#7d3c98', fill:'rgba(125,60,152,0.13)' },
  red:     { line:'#c0392b', fill:'rgba(192,57,43,0.13)'  },
  teal:    { line:'#1a7a6e', fill:'rgba(26,122,110,0.13)' },
};
const PIE_COMP    = ['#c17d3c','#2d6a4f','#2471a3','#7d3c98'];
const PIE_SECTORS = ['#27ae60','#e67e22','#3498db'];

// ─── STATE ────────────────────────────────────────────────────
let activeCountry = 'IND';
let charts = {};
let isDark = localStorage.getItem('nad-dark') === 'true';

// Cached data for the GDP rankings table (all countries, latest year)
let gdpRankingsCache = [];

// ─── DOM REFS ─────────────────────────────────────────────────
const countrySelect   = document.getElementById('countrySelect');
const countryHeadline = document.getElementById('countryHeadline');
const countryYear     = document.getElementById('countryYear');
const insightText     = document.getElementById('insightText');
const loadingOverlay  = document.getElementById('loadingOverlay');
const dataSourceBadge = document.getElementById('dataSourceBadge');
const darkToggle      = document.getElementById('darkToggle');
const toastEl         = document.getElementById('toast');
const compareBtn      = document.getElementById('compareBtn');
const cmpInsight      = document.getElementById('cmpInsight');

// ─── UTILITIES ───────────────────────────────────────────────
function showLoading() { loadingOverlay.classList.add('active'); }
function hideLoading() { loadingOverlay.classList.remove('active'); }

let toastTimer;
function showToast(msg, dur = 3000) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), dur);
}

function latestVal(arr) {
  if (!arr || !arr.length) return null;
  return arr[arr.length - 1].value;
}
function prevVal(arr) {
  if (!arr || arr.length < 2) return null;
  return arr[arr.length - 2].value;
}
function fmtNum(n, dec = 2) {
  if (n == null) return '—';
  return n.toFixed(dec);
}
function fmtTrillion(n) {
  if (n == null) return '—';
  if (n >= 1) return `$${n.toFixed(2)}T`;
  return `$${(n * 1000).toFixed(0)}B`;
}
function fmtUSD(n) {
  if (n == null) return '—';
  return '$' + Math.round(n).toLocaleString('en-US');
}

function updateBadge(source) {
  const isFB = source === 'fallback';
  dataSourceBadge.textContent = isFB ? 'Cached Data' : 'Live Data';
  dataSourceBadge.className = 'nav-badge' + (isFB ? ' fallback' : '');
}

// ─── CHART.JS DEFAULTS ───────────────────────────────────────
function applyChartDefaults() {
  const tc = isDark ? '#a09890' : '#5c5650';
  const gc = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  Chart.defaults.color = tc;
  Chart.defaults.font.family = "'DM Sans', sans-serif";
  Chart.defaults.font.size = 12;
  Chart.defaults.scale.grid.color = gc;
  Chart.defaults.plugins.legend.labels.boxWidth = 12;
  Chart.defaults.plugins.legend.labels.padding = 16;
}

function tooltipStyle() {
  return {
    backgroundColor: isDark ? '#1c1b18' : '#fff',
    titleColor:      isDark ? '#f0ede6' : '#1a1714',
    bodyColor:       isDark ? '#a09890' : '#5c5650',
    borderColor:     isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
    borderWidth: 1,
    padding: 10,
    cornerRadius: 8,
  };
}

// ─── CHART FACTORY ───────────────────────────────────────────
function makeChart(id, config) {
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
  const ctx = document.getElementById(id);
  if (!ctx) return null;
  charts[id] = new Chart(ctx.getContext('2d'), config);
  return charts[id];
}

function lineDataset(label, data, col, fill = true) {
  return {
    label, data,
    borderColor: col.line,
    backgroundColor: col.fill,
    fill,
    tension: 0.4,
    pointRadius: 4,
    pointHoverRadius: 7,
    pointBackgroundColor: col.line,
  };
}

function lineConfig(labels, datasets, yLabel = '', fmt = v => v.toFixed(2)) {
  return {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 600, easing: 'easeInOutQuart' },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: datasets.length > 1 },
        tooltip: { ...tooltipStyle(), callbacks: { label: c => ` ${c.dataset.label}: ${fmt(c.parsed.y)}` } }
      },
      scales: {
        x: { grid: { display: false } },
        y: { title: { display: !!yLabel, text: yLabel, font: { size: 11 } } }
      }
    }
  };
}

function barConfig(labels, datasets, stacked = false) {
  return {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 600 },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: datasets.length > 1 },
        tooltip: { ...tooltipStyle() }
      },
      scales: {
        x: { grid: { display: false }, stacked },
        y: { stacked }
      }
    }
  };
}

function areaConfig(labels, datasets, fmt) {
  const cfg = lineConfig(labels, datasets, '', fmt);
  cfg.options.plugins.legend.display = false;
  return cfg;
}

function doughnutConfig(labels, data, colors) {
  return {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderWidth: 2,
        borderColor: isDark ? '#1c1b18' : '#fff',
        hoverOffset: 10,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { animateRotate: true, duration: 700 },
      cutout: '58%',
      plugins: {
        legend: { position: 'right', labels: { padding: 14 } },
        tooltip: { ...tooltipStyle(), callbacks: { label: c => ` ${c.label}: ${c.parsed}%` } }
      }
    }
  };
}

// ─── DOWNLOAD A CHART AS PNG ──────────────────────────────────
window.downloadChart = function(canvasId, filename) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const link = document.createElement('a');
  link.download = `${filename}_${activeCountry}_${new Date().getFullYear()}.png`;
  link.href = canvas.toDataURL('image/png', 1.0);
  link.click();
  showToast(`✓ Saved ${filename}.png`);
};

// ─── API HELPERS ─────────────────────────────────────────────
async function apiFetch(path) {
  const r = await fetch(API_BASE + '/api' + path);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

// ─── POPULATE COMPARISON SELECTS ─────────────────────────────
function populateComparisonSelects() {
  const regions = {};
  Object.entries(COUNTRIES).forEach(([code, c]) => {
    if (!regions[c.region]) regions[c.region] = [];
    regions[c.region].push({ code, ...c });
  });

  [document.getElementById('cmpA'), document.getElementById('cmpB')].forEach((sel, i) => {
    sel.innerHTML = '';
    Object.entries(regions).forEach(([region, list]) => {
      const og = document.createElement('optgroup');
      og.label = region;
      list.forEach(({ code, name, flag }) => {
        const opt = document.createElement('option');
        opt.value = code;
        opt.textContent = `${flag} ${name}`;
        if (i === 0 && code === 'IND') opt.selected = true;
        if (i === 1 && code === 'USA') opt.selected = true;
        og.appendChild(opt);
      });
      sel.appendChild(og);
    });
  });
}

// ─── RENDER SUMMARY CARDS ─────────────────────────────────────
function renderCards(gdpData, gdpTotalData, inflData, unempData, pcData) {
  const defs = [
    { id:'gdp',        arr:gdpData,      fmt: v => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`  },
    { id:'gdptotal',   arr:gdpTotalData, fmt: v => fmtTrillion(v) },
    { id:'inflation',  arr:inflData,     fmt: v => `${v.toFixed(1)}%`  },
    { id:'unemployment',arr:unempData,   fmt: v => `${v.toFixed(1)}%`  },
    { id:'percapita',  arr:pcData,       fmt: v => fmtUSD(v)  },
  ];
  defs.forEach(({ id, arr, fmt }) => {
    const valEl   = document.getElementById(`val-${id}`);
    const trendEl = document.getElementById(`trend-${id}`);
    if (!valEl) return;
    const latest = latestVal(arr);
    const prev   = prevVal(arr);
    if (latest != null) {
      valEl.textContent = fmt(latest);
      valEl.style.animation = 'none';
      requestAnimationFrame(() => { valEl.style.animation = 'numPop 0.45s cubic-bezier(0.34,1.56,0.64,1)'; });
    } else { valEl.textContent = '—'; }

    if (trendEl && latest != null && prev != null) {
      const delta = latest - prev;
      const dir   = delta >= 0 ? '▲' : '▼';
      trendEl.textContent = `${dir} ${Math.abs(delta).toFixed(2)} vs prior year`;
      trendEl.className   = `card-trend ${delta >= 0 ? 'up' : 'down'}`;
    } else if (trendEl) {
      trendEl.textContent = '';
      trendEl.className   = 'card-trend';
    }
  });
}

// ─── RENDER INSIGHT BANNER ───────────────────────────────────
function renderInsight(code, gdpData, inflData, unempData, gdpTotalData) {
  const name     = COUNTRIES[code]?.name || code;
  const gdp      = latestVal(gdpData);
  const infl     = latestVal(inflData);
  const unemp    = latestVal(unempData);
  const gdpTotal = latestVal(gdpTotalData);
  const year     = gdpData?.length ? gdpData[gdpData.length-1].year : '—';

  countryYear.textContent = `${year} latest`;

  let txt = `<strong>${name}</strong>`;
  if (gdpTotal != null) txt += ` has a nominal GDP of <strong>${fmtTrillion(gdpTotal)}</strong>.`;
  if (gdp != null) {
    const pace = gdp > 6 ? 'strong' : gdp > 3 ? 'moderate' : gdp > 0 ? 'slow' : 'contracting';
    txt += ` Growth at <strong>${gdp.toFixed(2)}%</strong> is ${pace}.`;
  }
  if (infl != null) {
    const inflDesc = infl > 8 ? 'dangerously high' : infl > 4 ? 'elevated' : infl > 0 ? 'contained' : 'deflationary';
    txt += ` Inflation is <strong>${inflDesc} at ${infl.toFixed(1)}%</strong>.`;
  }
  if (unemp != null) {
    const uDesc = unemp < 4 ? 'tight labour market' : unemp < 8 ? 'balanced labour market' : 'elevated unemployment';
    txt += ` The <strong>${uDesc}</strong> (${unemp.toFixed(1)}% unemployed).`;
  }
  insightText.innerHTML = txt;
}

// ─── RENDER TIME-SERIES CHARTS ────────────────────────────────
function renderTimeCharts(gdpData, gdpTotalData, inflData, unempData, pcData) {
  applyChartDefaults();

  // GDP Total — area chart
  makeChart('gdpTotalChart', lineConfig(
    gdpTotalData.map(d => d.year),
    [lineDataset('Nominal GDP (T$)', gdpTotalData.map(d => d.value), C.copper)],
    '',
    v => `$${v.toFixed(2)}T`
  ));

  // GDP Growth — line
  makeChart('gdpChart', lineConfig(
    gdpData.map(d => d.year),
    [lineDataset('GDP Growth %', gdpData.map(d => d.value), C.blue)],
    '',
    v => `${v.toFixed(2)}%`
  ));

  // Inflation — bar
  makeChart('inflationChart', barConfig(
    inflData.map(d => d.year),
    [{
      label: 'Inflation %',
      data:  inflData.map(d => d.value),
      backgroundColor: inflData.map(d =>
        d.value > 8 ? 'rgba(192,57,43,0.75)' : d.value > 4 ? 'rgba(230,126,34,0.75)' : 'rgba(36,113,163,0.65)'
      ),
      borderColor: inflData.map(d =>
        d.value > 8 ? '#c0392b' : d.value > 4 ? '#e67e22' : '#2471a3'
      ),
      borderWidth: 1.5,
      borderRadius: 4,
    }]
  ));

  // Unemployment — line
  makeChart('unemploymentChart', lineConfig(
    unempData.map(d => d.year),
    [lineDataset('Unemployment %', unempData.map(d => d.value), C.purple)],
    '',
    v => `${v.toFixed(2)}%`
  ));

  // Per Capita — bar
  makeChart('percapitaChart', barConfig(
    pcData.map(d => d.year),
    [{
      label: 'Per Capita USD',
      data:  pcData.map(d => d.value),
      backgroundColor: 'rgba(45,106,79,0.65)',
      borderColor: '#2d6a4f',
      borderWidth: 1.5,
      borderRadius: 4,
    }]
  ));
}

// ─── RENDER COMPOSITION CHARTS ───────────────────────────────
function renderCompositionCharts(compData, sectorData) {
  applyChartDefaults();

  makeChart('gdpComponentsChart', doughnutConfig(
    ['Consumption', 'Investment', 'Government', 'Net Exports'],
    [compData.consumption, compData.investment, compData.government, Math.max(compData.netExports, 0)],
    PIE_COMP
  ));

  makeChart('sectorsChart', doughnutConfig(
    ['Agriculture', 'Industry', 'Services'],
    [sectorData.agriculture, sectorData.industry, sectorData.services],
    PIE_SECTORS
  ));
}

// ─── GDP RANKINGS SECTION ─────────────────────────────────────
// Builds a full "Total GDP Leaderboard" section dynamically
function buildGdpRankingSection() {
  // Remove existing section if re-rendering
  const old = document.getElementById('gdpRankingSection');
  if (old) old.remove();

  const section = document.createElement('section');
  section.id = 'gdpRankingSection';
  section.className = 'charts-section gdp-ranking-section';
  section.innerHTML = `
    <div class="section-header">
      <h2>Total GDP Rankings</h2>
      <span class="section-sub">All 33 countries · Nominal GDP · 2023</span>
    </div>
    <div class="gdp-ranking-layout">
      <!-- Left: bar chart -->
      <div class="chart-card ranking-chart-card">
        <div class="chart-title-row">
          <span class="chart-title">Top Economies by Nominal GDP <span class="unit-tag">USD Trillion · 2023</span></span>
          <button class="dl-btn" onclick="downloadChart('gdpRankBarChart','GDP_Rankings')">⬇ PNG</button>
        </div>
        <div class="ranking-bar-wrap"><canvas id="gdpRankBarChart"></canvas></div>
      </div>
      <!-- Right: table -->
      <div class="chart-card ranking-table-card">
        <div class="chart-title-row">
          <span class="chart-title">Full Country Table <span class="unit-tag">Ranked by GDP</span></span>
          <div class="rank-filter-btns">
            <button class="rank-filter active" data-filter="all">All</button>
            <button class="rank-filter" data-filter="Asia">Asia</button>
            <button class="rank-filter" data-filter="Americas">Americas</button>
            <button class="rank-filter" data-filter="Europe">Europe</button>
            <button class="rank-filter" data-filter="Middle East & Africa">ME & Africa</button>
          </div>
        </div>
        <div class="rank-table-wrap">
          <table class="rank-table" id="gdpRankTable">
            <thead>
              <tr>
                <th>#</th><th>Country</th><th>GDP (T$)</th><th>Growth %</th><th>Per Capita</th>
              </tr>
            </thead>
            <tbody id="gdpRankBody"></tbody>
          </table>
        </div>
      </div>
    </div>
    <!-- Bottom: sparkline trend strip -->
    <div class="chart-card gdp-trend-strip-card">
      <div class="chart-title-row">
        <span class="chart-title">GDP Trajectory 2014–2023 <span class="unit-tag">Top 8 economies · USD Trillion</span></span>
        <button class="dl-btn" onclick="downloadChart('gdpTrendStripChart','GDP_Trajectory')">⬇ PNG</button>
      </div>
      <div class="gdp-trend-strip-wrap"><canvas id="gdpTrendStripChart"></canvas></div>
    </div>
  `;

  // Insert after insights banner (before GDP overview)
  const insightsBanner = document.getElementById('insightsBanner');
  insightsBanner.after(section);

  // Wire up filter buttons
  section.querySelectorAll('.rank-filter').forEach(btn => {
    btn.addEventListener('click', () => {
      section.querySelectorAll('.rank-filter').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderRankTable(btn.dataset.filter);
    });
  });
}

async function loadGdpRankings() {
  // Collect latest GDP total + growth + percapita for all countries
  const codes = Object.keys(COUNTRIES);

  // Fetch in parallel (each from our backend which uses fallback)
  const results = await Promise.all(codes.map(async code => {
    try {
      const [gRes, gdpTRes, pcRes] = await Promise.all([
        apiFetch(`/gdp?country=${code}`),
        apiFetch(`/gdp-total?country=${code}`),
        apiFetch(`/percapita?country=${code}`),
      ]);
      return {
        code,
        name: COUNTRIES[code].name,
        flag: COUNTRIES[code].flag,
        region: COUNTRIES[code].region,
        gdpTotal: gRes.data,   // growth series
        gdpTotalSeries: gdpTRes.data, // nominal series
        pcSeries: pcRes.data,
        latestGdpTotal: latestVal(gdpTRes.data),
        latestGrowth:   latestVal(gRes.data),
        latestPc:       latestVal(pcRes.data),
      };
    } catch {
      return {
        code,
        name: COUNTRIES[code].name,
        flag: COUNTRIES[code].flag,
        region: COUNTRIES[code].region,
        gdpTotal: [], gdpTotalSeries: [], pcSeries: [],
        latestGdpTotal: null, latestGrowth: null, latestPc: null,
      };
    }
  }));

  // Sort by nominal GDP descending, assign global rank
  gdpRankingsCache = results
    .filter(r => r.latestGdpTotal != null)
    .sort((a, b) => b.latestGdpTotal - a.latestGdpTotal)
    .map((r, i) => ({ ...r, rank: i + 1 }));

  renderRankTable('all');
  renderRankBarChart();
  renderGdpTrendStrip(gdpRankingsCache.slice(0, 8)); // top 8
}

function renderRankTable(filter) {
  const tbody = document.getElementById('gdpRankBody');
  if (!tbody) return;

  const filtered = filter === 'all'
    ? gdpRankingsCache
    : gdpRankingsCache.filter(r => r.region === filter);

  tbody.innerHTML = filtered.map(r => {
    const growthColor = r.latestGrowth > 5 ? '#27ae60'
                      : r.latestGrowth > 2 ? '#e67e22'
                      : r.latestGrowth < 0 ? '#c0392b'
                      : '#5c5650';
    const growthSign  = r.latestGrowth > 0 ? '+' : '';
    const isActive    = r.code === activeCountry;
    return `
      <tr class="${isActive ? 'rank-row-active' : ''}" data-code="${r.code}" style="cursor:pointer">
        <td class="rank-num">${r.rank}</td>
        <td class="rank-country">
          <span class="rank-flag">${r.flag}</span>
          <span class="rank-name">${r.name}</span>
          <span class="rank-region">${r.region}</span>
        </td>
        <td class="rank-gdp">${fmtTrillion(r.latestGdpTotal)}</td>
        <td class="rank-growth" style="color:${growthColor};font-weight:600">
          ${r.latestGrowth != null ? `${growthSign}${r.latestGrowth.toFixed(1)}%` : '—'}
        </td>
        <td class="rank-pc">${r.latestPc != null ? fmtUSD(r.latestPc) : '—'}</td>
      </tr>`;
  }).join('');

  // Row click → switch main country
  tbody.querySelectorAll('tr[data-code]').forEach(row => {
    row.addEventListener('click', () => {
      const code = row.dataset.code;
      countrySelect.value = code;
      activeCountry = code;
      loadCountry(code);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
}

function renderRankBarChart() {
  applyChartDefaults();
  // Show top 15 for readability
  const top15 = gdpRankingsCache.slice(0, 15);
  const labels = top15.map(r => `${r.flag} ${r.name}`);
  const vals   = top15.map(r => r.latestGdpTotal);

  // Color bars: active country = copper, rest = graduated blue-green
  const colors = top15.map(r =>
    r.code === activeCountry
      ? 'rgba(193,125,60,0.85)'
      : 'rgba(45,106,79,0.65)'
  );
  const borders = top15.map(r =>
    r.code === activeCountry ? '#c17d3c' : '#2d6a4f'
  );

  makeChart('gdpRankBarChart', {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Nominal GDP (USD Trillion)',
        data: vals,
        backgroundColor: colors,
        borderColor: borders,
        borderWidth: 1.5,
        borderRadius: 5,
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 700 },
      plugins: {
        legend: { display: false },
        tooltip: {
          ...tooltipStyle(),
          callbacks: { label: c => ` $${c.parsed.x.toFixed(2)} Trillion` }
        }
      },
      scales: {
        x: { title: { display: true, text: 'USD Trillion', font: { size: 11 } } },
        y: { grid: { display: false }, ticks: { font: { size: 11 } } }
      }
    }
  });
}

function renderGdpTrendStrip(top8) {
  applyChartDefaults();
  const colors = [C.copper, C.green, C.blue, C.purple, C.red, C.teal,
    { line:'#d35400', fill:'rgba(211,84,0,0.1)' },
    { line:'#1a5276', fill:'rgba(26,82,118,0.1)' }
  ];

  // Gather all years (union)
  const allYears = [...new Set(top8.flatMap(r => r.gdpTotalSeries.map(d => d.year)))].sort();

  const datasets = top8.map((r, i) => {
    const map = Object.fromEntries(r.gdpTotalSeries.map(d => [d.year, d.value]));
    return {
      label: `${r.flag} ${r.name}`,
      data:  allYears.map(y => map[y] ?? null),
      borderColor: colors[i].line,
      backgroundColor: colors[i].fill,
      fill: false,
      tension: 0.4,
      pointRadius: 3,
      pointHoverRadius: 6,
      borderWidth: 2,
    };
  });

  makeChart('gdpTrendStripChart', {
    type: 'line',
    data: { labels: allYears, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 600 },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: true, position: 'top' },
        tooltip: {
          ...tooltipStyle(),
          callbacks: { label: c => ` ${c.dataset.label}: $${c.parsed.y.toFixed(2)}T` }
        }
      },
      scales: {
        x: { grid: { display: false } },
        y: { title: { display: true, text: 'USD Trillion', font: { size: 11 } } }
      }
    }
  });
}

// ─── COMPARISON CHARTS ────────────────────────────────────────
function alignSeries(series, labels) {
  const map = Object.fromEntries(series.map(d => [d.year, d.value]));
  return labels.map(y => map[y] ?? null);
}

function renderComparisonCharts(codeA, codeB, data) {
  applyChartDefaults();
  const nameA = `${COUNTRIES[codeA].flag} ${COUNTRIES[codeA].name}`;
  const nameB = `${COUNTRIES[codeB].flag} ${COUNTRIES[codeB].name}`;

  // Helper to get union labels
  function unionLabels(...arrays) {
    return [...new Set(arrays.flatMap(a => a.map(d => d.year)))].sort();
  }

  // ── Nominal GDP (line) ──
  const gdpTLabels = unionLabels(data.gdpTotalA, data.gdpTotalB);
  makeChart('cmpGdpTotalChart', lineConfig(
    gdpTLabels,
    [
      lineDataset(nameA, alignSeries(data.gdpTotalA, gdpTLabels), C.copper, false),
      lineDataset(nameB, alignSeries(data.gdpTotalB, gdpTLabels), C.green, false),
    ],
    '', v => `$${v.toFixed(2)}T`
  ));

  // ── GDP Growth (line) ──
  const gdpGLabels = unionLabels(data.gdpA, data.gdpB);
  makeChart('cmpGdpChart', lineConfig(
    gdpGLabels,
    [
      lineDataset(nameA, alignSeries(data.gdpA, gdpGLabels), C.copper, false),
      lineDataset(nameB, alignSeries(data.gdpB, gdpGLabels), C.green, false),
    ],
    '', v => `${v.toFixed(2)}%`
  ));

  // ── Inflation (grouped bar) ──
  const inflLabels = unionLabels(data.inflA, data.inflB);
  makeChart('cmpInflationChart', barConfig(
    inflLabels,
    [
      { label: nameA, data: alignSeries(data.inflA, inflLabels), backgroundColor:'rgba(193,125,60,0.7)', borderColor:'#c17d3c', borderWidth:1.5, borderRadius:3 },
      { label: nameB, data: alignSeries(data.inflB, inflLabels), backgroundColor:'rgba(45,106,79,0.7)',  borderColor:'#2d6a4f', borderWidth:1.5, borderRadius:3 },
    ]
  ));

  // ── Unemployment (line) ──
  const uLabels = unionLabels(data.unempA, data.unempB);
  makeChart('cmpUnemploymentChart', lineConfig(
    uLabels,
    [
      lineDataset(nameA, alignSeries(data.unempA, uLabels), C.copper, false),
      lineDataset(nameB, alignSeries(data.unempB, uLabels), C.green, false),
    ],
    '', v => `${v.toFixed(2)}%`
  ));

  // ── Per Capita (line) ──
  const pcLabels = unionLabels(data.pcA, data.pcB);
  makeChart('cmpPercapitaChart', lineConfig(
    pcLabels,
    [
      lineDataset(nameA, alignSeries(data.pcA, pcLabels), C.copper),
      lineDataset(nameB, alignSeries(data.pcB, pcLabels), C.green),
    ],
    '', v => `$${Math.round(v).toLocaleString('en-US')}`
  ));
}

// ─── COMPARISON INSIGHT ───────────────────────────────────────
function renderComparisonInsight(codeA, codeB, data) {
  const nameA = COUNTRIES[codeA].name;
  const nameB = COUNTRIES[codeB].name;

  const avgGdpA = data.gdpA.reduce((s,d)=>s+d.value,0) / data.gdpA.length;
  const avgGdpB = data.gdpB.reduce((s,d)=>s+d.value,0) / data.gdpB.length;
  const fasterGDP   = avgGdpA > avgGdpB ? nameA : nameB;
  const fasterAvg   = avgGdpA > avgGdpB ? avgGdpA : avgGdpB;
  const slowerAvg   = avgGdpA > avgGdpB ? avgGdpB : avgGdpA;

  const latPCA  = latestVal(data.pcA);
  const latPCB  = latestVal(data.pcB);
  const richer  = latPCA > latPCB ? nameA : nameB;
  const richerPC = latPCA > latPCB ? latPCA : latPCB;

  const latGdpTA = latestVal(data.gdpTotalA);
  const latGdpTB = latestVal(data.gdpTotalB);
  const biggerEcon = latGdpTA > latGdpTB ? nameA : nameB;
  const biggerVal  = latGdpTA > latGdpTB ? latGdpTA : latGdpTB;

  cmpInsight.style.display = 'block';
  cmpInsight.innerHTML = `
    📊 <strong>${biggerEcon}</strong> has the larger economy at <strong>${fmtTrillion(biggerVal)}</strong> GDP. 
    <strong>${fasterGDP}</strong> is growing faster (avg <strong>${fasterAvg.toFixed(1)}%</strong> vs ${slowerAvg.toFixed(1)}% 2014–2023).
    <strong>${richer}</strong> leads in per capita wealth at <strong>${fmtUSD(richerPC)}</strong> — 
    reflecting a distinction between economic size and individual prosperity.
  `;
}

// ─── MAIN LOAD COUNTRY ────────────────────────────────────────
async function loadCountry(code) {
  showLoading();
  activeCountry = code;
  countryHeadline.textContent = COUNTRIES[code]?.name || code;

  try {
    const [gdpRes, gdpTRes, inflRes, unempRes, pcRes, compRes, secRes] = await Promise.all([
      apiFetch(`/gdp?country=${code}`),
      apiFetch(`/gdp-total?country=${code}`),
      apiFetch(`/inflation?country=${code}`),
      apiFetch(`/unemployment?country=${code}`),
      apiFetch(`/percapita?country=${code}`),
      apiFetch(`/gdp-components?country=${code}`),
      apiFetch(`/sectors?country=${code}`),
    ]);

    updateBadge(gdpRes.source);

    const gdpData      = gdpRes.data;
    const gdpTotalData = gdpTRes.data;
    const inflData     = inflRes.data;
    const unempData    = unempRes.data;
    const pcData       = pcRes.data;

    renderCards(gdpData, gdpTotalData, inflData, unempData, pcData);
    renderInsight(code, gdpData, inflData, unempData, gdpTotalData);
    renderTimeCharts(gdpData, gdpTotalData, inflData, unempData, pcData);
    renderCompositionCharts(compRes.data, secRes.data);

    // Update ranking bar chart highlight
    if (gdpRankingsCache.length) {
      renderRankBarChart();
      renderRankTable(
        document.querySelector('.rank-filter.active')?.dataset.filter || 'all'
      );
    }

  } catch (err) {
    console.error('loadCountry error:', err);
    showToast('⚠ Failed to load data. Please try again.');
  } finally {
    hideLoading();
  }
}

// ─── LOAD COMPARISON ─────────────────────────────────────────
async function loadComparison() {
  const codeA = document.getElementById('cmpA').value;
  const codeB = document.getElementById('cmpB').value;

  if (codeA === codeB) { showToast('Please select two different countries.'); return; }
  showLoading();

  try {
    const [gdpA, gdpB, gdpTotalA, gdpTotalB, inflA, inflB, unempA, unempB, pcA, pcB] =
      await Promise.all([
        apiFetch(`/gdp?country=${codeA}`).then(r=>r.data),
        apiFetch(`/gdp?country=${codeB}`).then(r=>r.data),
        apiFetch(`/gdp-total?country=${codeA}`).then(r=>r.data),
        apiFetch(`/gdp-total?country=${codeB}`).then(r=>r.data),
        apiFetch(`/inflation?country=${codeA}`).then(r=>r.data),
        apiFetch(`/inflation?country=${codeB}`).then(r=>r.data),
        apiFetch(`/unemployment?country=${codeA}`).then(r=>r.data),
        apiFetch(`/unemployment?country=${codeB}`).then(r=>r.data),
        apiFetch(`/percapita?country=${codeA}`).then(r=>r.data),
        apiFetch(`/percapita?country=${codeB}`).then(r=>r.data),
      ]);

    const payload = { gdpA, gdpB, gdpTotalA, gdpTotalB, inflA, inflB, unempA, unempB, pcA, pcB };
    renderComparisonCharts(codeA, codeB, payload);
    renderComparisonInsight(codeA, codeB, payload);

    showToast(`✓ ${COUNTRIES[codeA].name} vs ${COUNTRIES[codeB].name}`);
    document.getElementById('comparisonSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) {
    console.error('loadComparison error:', err);
    showToast('⚠ Comparison failed. Please try again.');
  } finally {
    hideLoading();
  }
}

// ─── DARK MODE ───────────────────────────────────────────────
function applyDark() {
  document.body.classList.toggle('dark', isDark);
  localStorage.setItem('nad-dark', isDark);
  applyChartDefaults();
  Object.values(charts).forEach(c => {
    if (!c) return;
    const tt = tooltipStyle();
    c.options.plugins.tooltip.backgroundColor = tt.backgroundColor;
    c.options.plugins.tooltip.titleColor      = tt.titleColor;
    c.options.plugins.tooltip.bodyColor       = tt.bodyColor;
    c.options.plugins.tooltip.borderColor     = tt.borderColor;
    c.update('none');
  });
}

// ─── INJECT ANIMATION KEYFRAME ───────────────────────────────
const ks = document.createElement('style');
ks.textContent = `
  @keyframes numPop {
    0%   { opacity:0; transform:scale(0.8) translateY(5px); }
    65%  { opacity:1; transform:scale(1.07) translateY(-1px); }
    100% { transform:scale(1) translateY(0); }
  }
`;
document.head.appendChild(ks);

// ─── EVENTS ──────────────────────────────────────────────────
countrySelect.addEventListener('change', e => {
  activeCountry = e.target.value;
  loadCountry(activeCountry);
});
compareBtn.addEventListener('click', loadComparison);
darkToggle.addEventListener('click', () => { isDark = !isDark; applyDark(); });

// ─── BOOT ────────────────────────────────────────────────────
(async function init() {
  if (isDark) document.body.classList.add('dark');
  applyChartDefaults();
  populateComparisonSelects();

  // Build GDP rankings section placeholder
  buildGdpRankingSection();

  // Load main country first
  await loadCountry(activeCountry);

  // Load GDP rankings table (parallel, non-blocking)
  loadGdpRankings().catch(e => console.warn('Rankings error:', e));

  // Hide loading overlay after initial data loads
  hideLoading();

  // Auto-load default comparison (with its own loading)
  setTimeout(() => loadComparison(), 1000);
})();
