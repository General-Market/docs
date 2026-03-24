#!/usr/bin/env node
/**
 * Fetch 30-day price history from CoinGecko for crypto tokens.
 * Outputs a ready-to-paste TypeScript `pricePath` array (30 daily data points).
 *
 * Usage:
 *   node scripts/fetch-coingecko-prices.mjs <coingecko-id> [decimals]
 *   node scripts/fetch-coingecko-prices.mjs zama-2 4
 *   node scripts/fetch-coingecko-prices.mjs bitlayer 4
 *
 * To find the CoinGecko ID:
 *   node scripts/fetch-coingecko-prices.mjs --search "token name"
 *
 * Examples:
 *   node scripts/fetch-coingecko-prices.mjs --search "bitlayer"
 *   node scripts/fetch-coingecko-prices.mjs bitlayer 4
 *   node scripts/fetch-coingecko-prices.mjs zama-2 4
 *   node scripts/fetch-coingecko-prices.mjs aztec-protocol 4
 */

const API_BASE = "https://api.coingecko.com/api/v3";
const TARGET_POINTS = 30;

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

async function searchCoin(query) {
  const data = await fetchJson(`${API_BASE}/search?query=${encodeURIComponent(query)}`);
  if (!data.coins?.length) {
    console.error(`No coins found for "${query}"`);
    process.exit(1);
  }
  console.log("\nSearch results:");
  console.log("─".repeat(60));
  data.coins.slice(0, 10).forEach((c, i) => {
    console.log(`  ${i + 1}. ${c.name} (${c.symbol}) → ID: "${c.id}"  #${c.market_cap_rank ?? "unranked"}`);
  });
  console.log("\nUsage: node scripts/fetch-coingecko-prices.mjs <id> [decimals]");
}

function downsample(prices, targetLen) {
  const result = [];
  const step = (prices.length - 1) / (targetLen - 1);
  for (let i = 0; i < targetLen; i++) {
    const idx = Math.round(i * step);
    result.push(prices[idx]);
  }
  return result;
}

function suggestDecimals(prices) {
  const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
  if (avg >= 100) return 2;
  if (avg >= 1) return 2;
  if (avg >= 0.01) return 4;
  if (avg >= 0.0001) return 6;
  return 8;
}

async function fetchPrices(coinId, decimals) {
  console.log(`\nFetching 30-day price history for "${coinId}"...`);

  const data = await fetchJson(
    `${API_BASE}/coins/${coinId}/market_chart?vs_currency=usd&days=30`
  );

  if (!data.prices?.length) {
    console.error("No price data returned.");
    process.exit(1);
  }

  // Extract price values (CoinGecko returns [timestamp, price] pairs)
  const rawPrices = data.prices.map((p) => p[1]);

  // Filter out obvious outlier spikes (>5x median = probably bad data)
  const sorted = [...rawPrices].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const filtered = rawPrices.map((p) =>
    p > median * 5 || p < median / 5 ? null : p
  );
  // Fill gaps with neighbors
  for (let i = 0; i < filtered.length; i++) {
    if (filtered[i] === null) {
      filtered[i] = filtered[i - 1] ?? filtered[i + 1] ?? median;
    }
  }

  console.log(`  Raw data points: ${rawPrices.length}`);
  console.log(`  Price range: $${Math.min(...filtered).toFixed(6)} – $${Math.max(...filtered).toFixed(6)}`);

  // Downsample to 30 daily points
  const daily = downsample(filtered, TARGET_POINTS);

  const dec = decimals ?? suggestDecimals(daily);
  const formatted = daily.map((v) => parseFloat(v.toFixed(dec)));

  const first = formatted[0];
  const last = formatted[formatted.length - 1];
  const change = (((last - first) / first) * 100).toFixed(2);
  const trend = last >= first ? "+" : "";

  console.log(`  30d change: ${trend}${change}%`);
  console.log(`  Decimals: ${dec}`);
  console.log("");
  console.log("// Ready-to-paste pricePath:");
  console.log(`pricePath: [${formatted.join(", ")}],`);
  console.log(`priceDecimals: ${dec},`);
}

// ── CLI ─────────────────────────────────────────────────────
const args = process.argv.slice(2);

if (args.length === 0 || args[0] === "--help") {
  console.log(`
Usage:
  node scripts/fetch-coingecko-prices.mjs --search "token name"
  node scripts/fetch-coingecko-prices.mjs <coingecko-id> [decimals]

Examples:
  node scripts/fetch-coingecko-prices.mjs --search "bitlayer"
  node scripts/fetch-coingecko-prices.mjs bitlayer 4
`);
  process.exit(0);
}

if (args[0] === "--search") {
  searchCoin(args.slice(1).join(" ")).catch((e) => {
    console.error("Error:", e.message);
    process.exit(1);
  });
} else {
  const coinId = args[0];
  const decimals = args[1] ? parseInt(args[1], 10) : undefined;
  fetchPrices(coinId, decimals).catch((e) => {
    console.error("Error:", e.message);
    process.exit(1);
  });
}
