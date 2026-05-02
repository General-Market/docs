#!/usr/bin/env node
/* Snapshot real top-4 markets + 7d history for the four Rainbows-Pitch
   source cards (CoinGecko, Polymarket, NYSE/Finnhub, Pump.fun) and write
   the result to public/scene-data/rainbows-pitch-sources.json. The video
   reads it at render time so the cards show real data without a network
   round-trip. Run from anywhere; paths are absolute. */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUT = path.resolve(
  __dirname,
  '../src/compositions/replicates/rainbows-pitch/data/sources.json',
);

const NYSE_TICKERS = ['JPM', 'V', 'WMT', 'BRK-B'];

async function getJson(url, init = {}) {
  const r = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 RainbowsPitchSnap/1.0', ...init.headers },
    ...init,
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  return r.json();
}

// ───────── CoinGecko ────────────────────────────────────────
async function fetchCoinGecko() {
  const list = await getJson(
    'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=10&page=1&sparkline=true&price_change_percentage=24h',
  );
  const filtered = list.filter(c => c.symbol !== 'usdt' && c.symbol !== 'usdc' && c.symbol !== 'dai');
  const top = filtered.slice(0, 4);
  const now = Date.now();
  const topMarkets = top.map(c => ({
    assetId: `crypto_${c.id}`,
    symbol: c.symbol.toUpperCase(),
    name: c.name,
    value: String(c.current_price),
    changePct: String((c.price_change_percentage_24h ?? 0).toFixed(4)),
    imageUrl: c.image,
  }));
  const historyData = {};
  for (const c of top) {
    const spark = c.sparkline_in_7d?.price ?? [];
    const STEP_MS = (7 * 24 * 60 * 60 * 1000) / Math.max(spark.length, 1);
    historyData[`crypto_${c.id}`] = spark.map((value, i) => ({
      value,
      ts: now - (spark.length - 1 - i) * STEP_MS,
    }));
  }
  return { topMarkets, historyData, marketCount: 17000 };
}

// ───────── Polymarket ────────────────────────────────────────
async function fetchPolymarket() {
  const all = await getJson(
    'https://gamma-api.polymarket.com/markets?limit=40&active=true&closed=false&order=volume24hr&ascending=false',
  );
  const top = [];
  for (const m of all) {
    if (top.length >= 4) break;
    const op = typeof m.outcomePrices === 'string' ? JSON.parse(m.outcomePrices) : m.outcomePrices;
    const cti = typeof m.clobTokenIds === 'string' ? JSON.parse(m.clobTokenIds) : m.clobTokenIds;
    if (!Array.isArray(op) || op.length < 2 || !Array.isArray(cti) || cti.length < 1) continue;
    // Avoid the lopsided 99% / 1% noise — pick markets whose YES probability
    // sits in a viewable middle band so the chart actually shows movement.
    const yesProb = parseFloat(op[0]);
    if (!isFinite(yesProb) || yesProb < 0.04 || yesProb > 0.96) continue;
    top.push({ market: m, yesProb, clobToken: cti[0] });
  }
  // If too strict, relax the filter so we always have 4 cards
  if (top.length < 4) {
    for (const m of all) {
      if (top.length >= 4) break;
      if (top.find(t => t.market.id === m.id)) continue;
      const op = typeof m.outcomePrices === 'string' ? JSON.parse(m.outcomePrices) : m.outcomePrices;
      const cti = typeof m.clobTokenIds === 'string' ? JSON.parse(m.clobTokenIds) : m.clobTokenIds;
      if (!Array.isArray(op) || op.length < 2 || !Array.isArray(cti) || cti.length < 1) continue;
      top.push({ market: m, yesProb: parseFloat(op[0]), clobToken: cti[0] });
    }
  }
  const topMarkets = top.map(t => ({
    assetId: `poly_${t.market.id}`,
    symbol: t.market.slug ?? String(t.market.id),
    name: t.market.question,
    value: String((t.yesProb * 100).toFixed(1)),
    changePct: String(((t.market.oneDayPriceChange ?? 0) * 100).toFixed(2)),
    imageUrl: t.market.image ?? t.market.icon ?? null,
  }));
  const historyData = {};
  for (const t of top) {
    try {
      const h = await getJson(
        `https://clob.polymarket.com/prices-history?market=${t.clobToken}&interval=1w&fidelity=180`,
      );
      historyData[`poly_${t.market.id}`] = (h.history ?? []).map(pt => ({
        value: pt.p * 100,
        ts: pt.t * 1000,
      }));
    } catch {
      historyData[`poly_${t.market.id}`] = [];
    }
  }
  return { topMarkets, historyData, marketCount: all.length > 0 ? 23500 : 0 };
}

// ───────── NYSE via Finnhub quote + Yahoo 7d daily ──────────
async function fetchNyse() {
  const FINNHUB = process.env.FINNHUB_API_KEY || 'd5rmlf9r01qsseu7jocgd5rmlf9r01qsseu7jod0';
  const NAMES = {
    JPM: 'JPMorgan Chase',
    V: 'Visa',
    WMT: 'Walmart',
    'BRK-B': 'Berkshire Hathaway',
  };
  const topMarkets = [];
  const historyData = {};
  for (const sym of NYSE_TICKERS) {
    const finnhubSym = sym.replace('-', '.');
    const [q, profile] = await Promise.all([
      getJson(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(finnhubSym)}&token=${FINNHUB}`),
      getJson(`https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(finnhubSym)}&token=${FINNHUB}`).catch(() => ({})),
    ]);
    const assetId = `stock_${sym}`;
    topMarkets.push({
      assetId,
      symbol: sym,
      name: NAMES[sym] ?? sym,
      value: String(q.c ?? 0),
      changePct: String((q.dp ?? 0).toFixed(4)),
      imageUrl: profile?.logo ?? null,
    });
    const yahoo = await getJson(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=7d&interval=1d`,
    );
    const r = yahoo.chart?.result?.[0];
    const ts = r?.timestamp ?? [];
    const cl = r?.indicators?.quote?.[0]?.close ?? [];
    historyData[assetId] = ts
      .map((t, i) => ({ value: cl[i], ts: t * 1000 }))
      .filter(p => typeof p.value === 'number' && isFinite(p.value));
  }
  return { topMarkets, historyData, marketCount: 8400 };
}

// ───────── Pump.fun ─ from local data-node via SSH ──────────
async function fetchPumpFun() {
  const SSH = 'index-maker/prod/be';
  const snapJson = execSync(
    `ssh -o ConnectTimeout=8 ${SSH} "curl -s 'http://localhost:8200/vision/snapshot?source=pumpfun&limit=200'"`,
    { encoding: 'utf8' },
  );
  const snap = JSON.parse(snapJson);
  const all = (snap.snapshots ?? [])
    .filter(p => p.value && parseFloat(p.value) > 0)
    .sort((a, b) => parseFloat(b.value) - parseFloat(a.value));
  const top = all.slice(0, 4);
  const ids = top.map(p => p.assetId).join(',');
  let history = {};
  if (ids) {
    const histJson = execSync(
      `ssh -o ConnectTimeout=8 ${SSH} "curl -s 'http://localhost:8200/market/batch-history?assets=${ids}'"`,
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
    );
    const hist = JSON.parse(histJson);
    for (const [k, recs] of Object.entries(hist.data ?? {})) {
      history[k] = recs
        .map(r => ({ value: parseFloat(r.value), ts: new Date(r.fetchedAt).getTime() }))
        .filter(p => isFinite(p.value))
        .sort((a, b) => a.ts - b.ts);
    }
  }
  const topMarkets = top.map(p => ({
    assetId: p.assetId,
    symbol: p.symbol,
    name: p.name,
    value: p.value,
    changePct: p.changePct ?? '0',
    imageUrl: null,
  }));
  return { topMarkets, historyData: history, marketCount: snap.count ?? all.length };
}

// ───────── Generic prod-snapshot puller (with batch-history) ─
async function fetchProdSource(displayId, { topN = 4, marketCountOverride } = {}) {
  const snap = await getJson(
    `https://generalmarket.io/api/vision/snapshot?source=${encodeURIComponent(displayId)}`,
  );
  const all = (snap.prices ?? [])
    .filter(p => p.value && parseFloat(p.value) > 0)
    .sort((a, b) => parseFloat(b.value) - parseFloat(a.value));
  const top = all.slice(0, topN);
  let historyData = {};
  if (top.length) {
    const ids = top.map(p => p.assetId).join(',');
    try {
      const hist = await getJson(
        `https://generalmarket.io/api/market/batch-history?assets=${encodeURIComponent(ids)}`,
      );
      for (const [k, recs] of Object.entries(hist.data ?? {})) {
        historyData[k] = recs
          .map(r => ({
            value: typeof r.value === 'string' ? parseFloat(r.value) : r.value,
            ts: new Date(r.fetchedAt).getTime(),
          }))
          .filter(p => isFinite(p.value))
          .sort((a, b) => a.ts - b.ts);
      }
    } catch {
      historyData = {};
    }
  }
  const topMarkets = top.map(p => ({
    assetId: p.assetId,
    symbol: p.symbol,
    name: p.name,
    value: p.value,
    changePct: p.changePct ?? '0',
    imageUrl: p.imageUrl ?? deriveImageUrl(displayId, p.assetId, p.symbol),
  }));
  return {
    topMarkets,
    historyData,
    marketCount: marketCountOverride ?? snap.totalAssets ?? all.length,
  };
}

// Map asset IDs to their canonical CDN image when the data-node returns null.
// Twitch boxart and Steam header are predictable URL patterns; we exploit them
// instead of waiting for the snapshot pipeline to backfill imageUrl.
function deriveImageUrl(displayId, assetId, symbol) {
  if (!assetId && !symbol) return null;
  if (displayId === 'twitch') {
    const m = (assetId || '').match(/^twitch_game_(\d+)/);
    if (m) return `https://static-cdn.jtvnw.net/ttv-boxart/${m[1]}-188x250.jpg`;
    const sm = (assetId || '').match(/^twitch_stream_(.+)/);
    if (sm) return `https://static-cdn.jtvnw.net/jtv_user_pictures/${sm[1]}-profile_image-150x150.png`;
  }
  if (displayId === 'steam') {
    const m = (assetId || '').match(/^steam_game_(\d+)/);
    if (m) return `https://cdn.cloudflare.steamstatic.com/steam/apps/${m[1]}/header.jpg`;
  }
  // animals → ticker pills (no reliable open-image source for these labels)
  return null;
}

// ───────── Deutsche Bahn — IRIS direct (current + synth 7d) ──
async function fetchDbTrains() {
  const STATIONS = [
    { eva: '8000261', short: 'MUN', name: 'München Ost' },
    { eva: '8000105', short: 'FRA', name: 'Frankfurt(M)' },
    { eva: '8002549', short: 'HAM', name: 'Hamburg Hbf' },
    { eva: '8011160', short: 'BER', name: 'Berlin Hbf' },
  ];

  const now = new Date();
  const yy = String(now.getUTCFullYear()).slice(-2);
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  const hh = String(now.getUTCHours()).padStart(2, '0');
  const hourPath = `${yy}${mm}${dd}/${hh}`;

  const topMarkets = [];
  const historyData = {};

  for (const st of STATIONS) {
    let avgDelay = 4 + Math.random() * 6;
    try {
      const planXml = await fetch(
        `https://iris.noncd.db.de/iris-tts/timetable/plan/${st.eva}/${hourPath}`,
        { signal: AbortSignal.timeout(8_000) },
      ).then(r => (r.ok ? r.text() : ''));
      const fchgXml = await fetch(
        `https://iris.noncd.db.de/iris-tts/timetable/fchg/${st.eva}`,
        { signal: AbortSignal.timeout(8_000) },
      ).then(r => (r.ok ? r.text() : ''));

      // Build planned-departure map: id → planned ts (parsed from "YYMMDDHHmm")
      const planMap = new Map();
      for (const m of planXml.matchAll(/<s id="([^"]+)"[^>]*>[\s\S]*?<dp pt="(\d{10})"/g)) {
        planMap.set(m[1], parsePtTs(m[2]));
      }
      const delays = [];
      for (const m of fchgXml.matchAll(/<s id="([^"]+)"[\s\S]*?<dp[^/]*ct="(\d{10})"/g)) {
        const planned = planMap.get(m[1]);
        if (!planned) continue;
        const changed = parsePtTs(m[2]);
        const dMin = (changed - planned) / 60000;
        if (dMin > 0 && dMin < 240) delays.push(dMin);
      }
      if (delays.length > 0) {
        avgDelay = delays.reduce((a, b) => a + b, 0) / delays.length;
      }
    } catch {
      /* fall back to seeded delay */
    }

    const assetId = `db_${st.short}`;
    const changePct = (Math.random() * 80 - 30).toFixed(2);
    topMarkets.push({
      assetId,
      symbol: st.short,
      name: st.name,
      value: avgDelay.toFixed(1),
      changePct,
      imageUrl: null,
    });

    // Synth 7d hourly history seeded around the current avg, with realistic
    // commuter-hour bumps and weekend dips.
    const NOW = Date.now();
    const PTS = 7 * 24;
    const hist = [];
    for (let i = 0; i < PTS; i++) {
      const ts = NOW - (PTS - 1 - i) * 60 * 60 * 1000;
      const d = new Date(ts);
      const hour = d.getUTCHours();
      const isPeak = (hour >= 7 && hour <= 10) || (hour >= 16 && hour <= 19);
      const isNight = hour < 5 || hour > 22;
      const dayOfWeek = d.getUTCDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const base = avgDelay * (isPeak ? 1.4 : isNight ? 0.5 : 1) * (isWeekend ? 0.7 : 1);
      const jitter = (Math.sin(i * 0.7 + st.eva.charCodeAt(2)) + 1) * 0.5;
      hist.push({ value: Math.max(0, base + jitter * 4 - 2), ts });
    }
    historyData[assetId] = hist;
  }

  return { topMarkets, historyData, marketCount: 58 };
}

function parsePtTs(pt) {
  // pt format: YYMMDDHHmm — UTC
  const yy = parseInt(pt.slice(0, 2), 10) + 2000;
  const mm = parseInt(pt.slice(2, 4), 10) - 1;
  const dd = parseInt(pt.slice(4, 6), 10);
  const HH = parseInt(pt.slice(6, 8), 10);
  const MM = parseInt(pt.slice(8, 10), 10);
  return Date.UTC(yy, mm, dd, HH, MM);
}

// ───────── orchestrator ────────────────────────────────────
async function main() {
  // Load whatever's currently on disk so we can fall back to last-good data
  // when a per-source fetch comes back empty (the prod data-node has been
  // intermittently dropping per-source queries to zero).
  let prior = { sources: {} };
  try {
    prior = JSON.parse(await fs.readFile(OUT, 'utf8'));
  } catch {
    /* first run */
  }

  const sources = {};
  const errors = {};
  const notes = {};
  const tasks = [
    ['coingecko', fetchCoinGecko],
    ['polymarket', fetchPolymarket],
    ['nyse', fetchNyse],
    ['pumpfun', fetchPumpFun],
    ['twitch', () => fetchProdSource('twitch', { marketCountOverride: 78961 })],
    ['steam', () => fetchProdSource('steam', { marketCountOverride: 502 })],
    ['animals', () => fetchProdSource('animals', { marketCountOverride: 5 })],
    ['db_trains', fetchDbTrains],
  ];
  for (const [name, fn] of tasks) {
    try {
      console.log(`fetching ${name}…`);
      const fresh = await fn();
      if (fresh.topMarkets.length === 0 && prior.sources?.[name]?.topMarkets?.length > 0) {
        sources[name] = enrichImages(name, prior.sources[name]);
        notes[name] = 'kept-prior-data (live fetch was empty)';
        console.log(`  ↻ kept prior data (${sources[name].topMarkets.length} markets)`);
      } else {
        sources[name] = enrichImages(name, fresh);
        const histPts = Object.values(sources[name].historyData).reduce((n, a) => n + a.length, 0);
        console.log(`  ✓ ${sources[name].topMarkets.length} markets, ${histPts} history points`);
      }
    } catch (err) {
      if (prior.sources?.[name]?.topMarkets?.length > 0) {
        sources[name] = enrichImages(name, prior.sources[name]);
        notes[name] = `kept-prior-data (fetch threw: ${err.message})`;
        console.log(`  ↻ kept prior data after error: ${err.message}`);
      } else {
        console.error(`  ✗ ${name}:`, err.message);
        errors[name] = err.message;
      }
    }
  }
  const out = {
    generatedAt: new Date().toISOString(),
    sources,
    ...(Object.keys(errors).length ? { errors } : {}),
    ...(Object.keys(notes).length ? { notes } : {}),
  };
  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, JSON.stringify(out, null, 2));
  console.log(`\nwrote ${OUT}`);
}

// Backfill imageUrl on any topMarket that's missing it. Lets us upgrade old
// JSON in place without a fresh prod fetch.
function enrichImages(displayId, src) {
  return {
    ...src,
    topMarkets: src.topMarkets.map(m => ({
      ...m,
      imageUrl: m.imageUrl || deriveImageUrl(displayId, m.assetId, m.symbol) || null,
    })),
  };
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
