#!/usr/bin/env node
/* eslint-env node */
/**
 * Fetch real candle + trade data for a Solana / pump.fun token from
 * GeckoTerminal (no API key) and bake it to a JSON file the pumpfun-screen
 * Remotion engine reads. Real backbone; the engine adds synthetic micro-motion.
 *
 *   node scripts/pumpfun/fetch.mjs                 # auto-pick the spiciest trending pump
 *   node scripts/pumpfun/fetch.mjs <poolAddress>   # force a specific Solana pool
 *   node scripts/pumpfun/fetch.mjs <mintAddress>   # resolve a token mint to its top pool
 *   node scripts/pumpfun/fetch.mjs <symbolOrName>  # search by symbol / name
 *
 * Writes:
 *   src/compositions/pumpfun-screen/data/<ticker>.json
 *   public/pumpfun/<ticker>-avatar.png
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const VIDEO_ROOT = resolve(__dirname, "../..");
const DATA_DIR = resolve(VIDEO_ROOT, "src/compositions/pumpfun-screen/data");
const PUBLIC_DIR = resolve(VIDEO_ROOT, "public/pumpfun");

const API = "https://api.geckoterminal.com/api/v2";
const HDR = { Accept: "application/json", "User-Agent": "pumpfun-screen/1.0" };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// GeckoTerminal free tier is ~30 req/min. Pace calls + back off hard on 429.
async function gt(path) {
  for (let attempt = 0; attempt < 6; attempt++) {
    let res;
    try {
      res = await fetch(`${API}${path}`, { headers: HDR });
    } catch {
      await sleep(1000 * (attempt + 1));
      continue;
    }
    if (res.status === 429) {
      await sleep(2500 * (attempt + 1));
      continue;
    }
    const body = await res.json().catch(() => null);
    // GeckoTerminal sometimes returns 200 with a {status:{error_code:429}} body.
    if (body?.status?.error_code === 429) {
      await sleep(2500 * (attempt + 1));
      continue;
    }
    if (!res.ok) {
      throw new Error(`${res.status} ${res.statusText} on ${path}`);
    }
    return body;
  }
  throw new Error(`rate-limited (gave up) on ${path}`);
}

const SOL = "So11111111111111111111111111111111111111112";
const looksLikeAddress = (s) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s);

async function trendingPools() {
  const out = [];
  for (const page of [1, 2]) {
    const d = await gt(`/networks/solana/trending_pools?page=${page}`);
    out.push(...(d.data ?? []));
    await sleep(2200);
  }
  return out;
}

// Resolve an arbitrary query (pool addr / mint addr / symbol / name) → pool address.
async function resolvePool(query) {
  // 1. Try treating it as a pool address directly.
  if (looksLikeAddress(query)) {
    try {
      const d = await gt(`/networks/solana/pools/${query}?include=base_token`);
      if (d?.data?.id) return query;
    } catch {
      /* not a pool address — fall through to search */
    }
    await sleep(2200);
  }
  // 2. Search (works for mint address, symbol, or name).
  const d = await gt(
    `/search/pools?query=${encodeURIComponent(query)}&network=solana`,
  );
  const hits = (d?.data ?? []).filter(
    (x) => x.type === "pool" && x.attributes?.address,
  );
  if (!hits.length) throw new Error(`no Solana pool found for "${query}"`);
  // Prefer the deepest-liquidity match.
  hits.sort(
    (a, b) =>
      Number(b.attributes.reserve_in_usd ?? 0) -
      Number(a.attributes.reserve_in_usd ?? 0),
  );
  return hits[0].attributes.address;
}

async function ohlcv(pool) {
  // minute candles, up to 1000 back — enough to contain a multi-hour run-up
  const d = await gt(
    `/networks/solana/pools/${pool}/ohlcv/minute?aggregate=1&limit=1000&currency=usd`,
  );
  const list = d?.data?.attributes?.ohlcv_list ?? [];
  // GeckoTerminal returns newest-first; we want oldest-first
  return list
    .map(([t, o, h, l, c, v]) => ({
      t: Number(t),
      o: Number(o),
      h: Number(h),
      l: Number(l),
      c: Number(c),
      v: Number(v),
    }))
    .filter((k) => [k.o, k.h, k.l, k.c].every(Number.isFinite))
    .sort((a, b) => a.t - b.t);
}

/**
 * Per-trade USD price of the BASE token.
 *
 * GeckoTerminal trade attributes describe a from→to swap with both sides priced
 * in USD (`price_from_in_usd`, `price_to_in_usd`). For a BUY of the base token
 * the base sits on the `to` side; for a SELL it sits on the `from` side. We
 * pick the field whose token address equals the pool's base-token mint — robust
 * regardless of buy/sell labelling. `volume_in_usd` is the trade's USD size.
 */
async function trades(pool, baseMint) {
  const d = await gt(
    `/networks/solana/pools/${pool}/trades?trade_volume_in_usd_greater_than=0`,
  );
  return (d?.data ?? [])
    .map((x) => {
      const a = x.attributes;
      let price;
      if (baseMint && a.to_token_address === baseMint) {
        price = Number(a.price_to_in_usd);
      } else if (baseMint && a.from_token_address === baseMint) {
        price = Number(a.price_from_in_usd);
      } else {
        // Fallback when the base mint is unknown: buy receives base (to),
        // sell sends base (from).
        price =
          a.kind === "sell"
            ? Number(a.price_from_in_usd)
            : Number(a.price_to_in_usd);
      }
      return {
        t: Math.floor(new Date(a.block_timestamp).getTime() / 1000),
        price,
        usd: Number(a.volume_in_usd),
        kind: a.kind === "sell" ? "sell" : "buy",
      };
    })
    .filter(
      (x) =>
        Number.isFinite(x.t) &&
        Number.isFinite(x.price) &&
        x.price > 0 &&
        Number.isFinite(x.usd) &&
        x.usd > 0,
    )
    .sort((a, b) => a.t - b.t);
}

/**
 * Largest clean run-up in a price series: max over j>i of price[j]/price[i]
 * where price[i] is the running minimum. Returns the multiple and the
 * (lowIndex, peakIndex) that produced it.
 */
function bestRunUp(prices) {
  if (prices.length < 2) return { mult: 1, lowIdx: 0, peakIdx: 0 };
  let minIdx = 0;
  let best = 1;
  let bestLow = 0;
  let bestPeak = 0;
  for (let j = 0; j < prices.length; j++) {
    if (prices[j] < prices[minIdx]) minIdx = j;
    if (prices[minIdx] > 0) {
      const m = prices[j] / prices[minIdx];
      if (m > best) {
        best = m;
        bestLow = minIdx;
        bestPeak = j;
      }
    }
  }
  return { mult: best, lowIdx: bestLow, peakIdx: bestPeak };
}

function pumpWindowFromTicks(ticks) {
  const prices = ticks.map((t) => t.price);
  const { mult, lowIdx, peakIdx } = bestRunUp(prices);
  return {
    mult,
    window: {
      startT: ticks[lowIdx]?.t ?? 0,
      endT: ticks[peakIdx]?.t ?? 0,
      basePrice: prices[lowIdx] ?? 0,
      peakPrice: prices[peakIdx] ?? 0,
    },
  };
}

async function downloadAvatar(url, destPath) {
  if (!url || url.includes("missing.png")) return false;
  try {
    const res = await fetch(url, { headers: HDR });
    if (!res.ok) return false;
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length) return false;
    writeFileSync(destPath, buf);
    return true;
  } catch {
    return false;
  }
}

async function poolMeta(pool) {
  const d = await gt(`/networks/solana/pools/${pool}?include=base_token`);
  const attr = d?.data?.attributes ?? {};
  const baseRel = d?.data?.relationships?.base_token?.data?.id;
  const inc = (d?.included ?? []).find((x) => x.id === baseRel);
  const ta = inc?.attributes ?? {};
  const baseMint = ta.address ?? null;
  return {
    name: ta.name ?? attr.name ?? "TOKEN",
    symbol: ta.symbol ?? "TOKEN",
    image: ta.image_url ?? null,
    mcap: Number(attr.market_cap_usd ?? attr.fdv_usd ?? 0),
    liquidityUsd: Number(attr.reserve_in_usd ?? 0),
    baseMint,
    poolName: attr.name,
  };
}

async function main() {
  const arg = process.argv[2];
  let pool;

  if (arg) {
    console.log(`resolving "${arg}" …`);
    pool = await resolvePool(arg);
    console.log(`resolved → ${pool}`);
    await sleep(2200);
  } else {
    console.log("fetching trending Solana pools …");
    const pools = await trendingPools();
    const MIN_TICKS = 40;
    const MIN_RUNUP = 1.8;
    const scored = [];
    // Probe a handful of trending pools by their REAL trade stream.
    for (const p of pools.slice(0, 10)) {
      const addr = p.attributes?.address ?? p.id.replace("solana_", "");
      const baseMint =
        p.relationships?.base_token?.data?.id?.replace("solana_", "") ?? null;
      try {
        const tape = await trades(addr, baseMint);
        await sleep(2200);
        const { mult } = pumpWindowFromTicks(tape);
        scored.push({
          addr,
          name: p.attributes?.name ?? addr,
          runup: mult,
          n: tape.length,
          ok: tape.length >= MIN_TICKS && mult >= MIN_RUNUP,
        });
        console.log(
          `  ${(p.attributes?.name ?? addr).padEnd(24)} run=${mult.toFixed(2)}x  ticks=${tape.length}${tape.length >= MIN_TICKS && mult >= MIN_RUNUP ? "  ✓" : ""}`,
        );
      } catch (e) {
        console.log(`  ${p.attributes?.name ?? addr}: skip (${e.message})`);
      }
    }
    const eligible = scored.filter((s) => s.ok);
    const pickFrom = (eligible.length ? eligible : scored).sort(
      (a, b) => b.runup - a.runup,
    );
    if (!pickFrom.length) throw new Error("no usable trending pools");
    console.log("\ntop candidates:");
    pickFrom
      .slice(0, 3)
      .forEach((s, i) =>
        console.log(
          `  ${i + 1}. ${s.name}  ${s.runup.toFixed(2)}x  ticks=${s.n}  (${s.addr})`,
        ),
      );
    pool = pickFrom[0].addr;
    console.log(`\npicked: ${pickFrom[0].name} (${pool})`);
    await sleep(2200);
  }

  const meta = await poolMeta(pool);
  await sleep(2200);
  const candles = await ohlcv(pool);
  await sleep(2200);
  const ticks = await trades(pool, meta.baseMint);

  if (!ticks.length) throw new Error("no usable trades for this pool");

  const ticker =
    (meta.symbol || "token").replace(/[^a-zA-Z0-9]/g, "").toLowerCase() ||
    "token";

  mkdirSync(DATA_DIR, { recursive: true });
  mkdirSync(PUBLIC_DIR, { recursive: true });

  const lastPrice = ticks[ticks.length - 1].price;
  const mcapPerPrice = meta.mcap > 0 && lastPrice > 0 ? meta.mcap / lastPrice : 0;

  let avatarFile = null;
  if (
    await downloadAvatar(meta.image, resolve(PUBLIC_DIR, `${ticker}-avatar.png`))
  ) {
    avatarFile = `pumpfun/${ticker}-avatar.png`;
  }

  const { mult: runup, window: pumpWindow } = pumpWindowFromTicks(ticks);

  const data = {
    token: {
      name: meta.name,
      symbol: meta.symbol,
      avatar: avatarFile,
      mcapPerPrice,
    },
    pool: {
      liquidityUsd: meta.liquidityUsd,
      reserveBase: null,
      reserveQuote: null,
    },
    candles,
    ticks,
    pumpWindow,
    fetchedAt: new Date().toISOString(),
    source: `geckoterminal:solana:${pool}`,
  };

  const out = resolve(DATA_DIR, `${ticker}.json`);
  writeFileSync(out, JSON.stringify(data, null, 2));

  console.log(`\nwrote ${out}`);
  console.log(`  token        ${meta.name} (${meta.symbol})`);
  console.log(`  candles      ${candles.length}`);
  console.log(`  ticks        ${ticks.length}`);
  console.log(`  pump run-up  ${runup.toFixed(2)}x`);
  console.log(`  liquidityUsd ${meta.liquidityUsd.toFixed(0)}`);
  console.log(`  mcapPerPrice ${mcapPerPrice.toFixed(0)}`);
  console.log(`  avatar       ${avatarFile ?? "none"}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
