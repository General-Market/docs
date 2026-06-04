#!/usr/bin/env node
/* eslint-env node */
/**
 * Fetch real candle + trade data for a trending Solana / pump.fun token from
 * GeckoTerminal (no API key) and bake it to a JSON file the pumpfun-screen
 * Remotion engine reads. Real backbone; the engine adds synthetic micro-motion.
 *
 *   node fetch.mjs                 # auto-pick the spiciest trending pump
 *   node fetch.mjs <poolAddress>   # force a specific Solana pool
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

async function gt(path) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(`${API}${path}`, { headers: HDR });
    if (res.status === 429) {
      await sleep(1500 * (attempt + 1));
      continue;
    }
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} on ${path}`);
    return res.json();
  }
  throw new Error(`rate-limited on ${path}`);
}

async function trendingPools() {
  const out = [];
  for (const page of [1, 2]) {
    const d = await gt(`/networks/solana/trending_pools?page=${page}`);
    out.push(...(d.data ?? []));
    await sleep(400);
  }
  return out;
}

async function ohlcv(pool) {
  // minute candles, up to 1000 back — enough to contain a multi-hour run-up
  const d = await gt(
    `/networks/solana/pools/${pool}/ohlcv/minute?aggregate=1&limit=1000&currency=usd`,
  );
  const list = d?.data?.attributes?.ohlcv_list ?? [];
  // GeckoTerminal returns newest-first; we want oldest-first
  return list
    .map(([t, o, h, l, c, v]) => ({ t, o, h, l, c, v }))
    .sort((a, b) => a.t - b.t);
}

async function trades(pool) {
  const d = await gt(
    `/networks/solana/pools/${pool}/trades?trade_volume_in_usd_greater_than=0`,
  );
  return (d?.data ?? [])
    .map((x) => {
      const a = x.attributes;
      return {
        t: Math.floor(new Date(a.block_timestamp).getTime() / 1000),
        kind: a.kind, // "buy" | "sell"
        usd: Number(a.volume_in_usd),
        trader: a.tx_from_address,
      };
    })
    .filter((x) => x.usd > 0 && Number.isFinite(x.t))
    .sort((a, b) => a.t - b.t);
}

// Score a candle series by its biggest clean run-up (peak / trough-before-peak).
function pumpScore(candles) {
  if (candles.length < 30) return 0;
  let minSoFar = candles[0].l;
  let best = 1;
  for (const c of candles) {
    minSoFar = Math.min(minSoFar, c.l);
    if (minSoFar > 0) best = Math.max(best, c.h / minSoFar);
  }
  return best;
}

async function downloadAvatar(url, destPath) {
  if (!url) return false;
  try {
    const res = await fetch(url, { headers: HDR });
    if (!res.ok) return false;
    const buf = Buffer.from(await res.arrayBuffer());
    writeFileSync(destPath, buf);
    return true;
  } catch {
    return false;
  }
}

async function tokenMeta(pool) {
  const d = await gt(`/networks/solana/pools/${pool}?include=base_token`);
  const attr = d?.data?.attributes ?? {};
  const baseId = d?.data?.relationships?.base_token?.data?.id;
  const inc = (d?.included ?? []).find((x) => x.id === baseId);
  const ta = inc?.attributes ?? {};
  return {
    name: ta.name ?? attr.name ?? "TOKEN",
    symbol: ta.symbol ?? "TOKEN",
    image: ta.image_url && ta.image_url !== "missing.png" ? ta.image_url : null,
    mcap: Number(attr.market_cap_usd ?? attr.fdv_usd ?? 0),
    poolName: attr.name,
    createdAt: attr.pool_created_at,
  };
}

async function main() {
  const forced = process.argv[2];
  let pool = forced;

  if (!pool) {
    console.log("fetching trending Solana pools…");
    const pools = await trendingPools();
    // rank candidates by pump magnitude over their candle window
    const scored = [];
    for (const p of pools.slice(0, 14)) {
      const addr = p.id.replace("solana_", "");
      try {
        const c = await ohlcv(addr);
        const score = pumpScore(c);
        scored.push({ addr, name: p.attributes.name, score, n: c.length });
        console.log(
          `  ${p.attributes.name.padEnd(22)} run=${score.toFixed(1)}x  candles=${c.length}`,
        );
        await sleep(400);
      } catch (e) {
        console.log(`  ${p.attributes.name}: skip (${e.message})`);
      }
    }
    scored.sort((a, b) => b.score - a.score);
    console.log("\ntop candidates:");
    scored.slice(0, 3).forEach((s, i) =>
      console.log(`  ${i + 1}. ${s.name}  ${s.score.toFixed(1)}x  (${s.addr})`),
    );
    pool = scored[0].addr;
    console.log(`\npicked: ${scored[0].name} (${pool})`);
  }

  const [meta, candles, tape] = await Promise.all([
    tokenMeta(pool),
    ohlcv(pool),
    trades(pool),
  ]);

  if (candles.length < 10) throw new Error("not enough candles");

  const ticker = (meta.symbol || "token")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase() || "token";

  mkdirSync(DATA_DIR, { recursive: true });
  mkdirSync(PUBLIC_DIR, { recursive: true });

  const last = candles[candles.length - 1];
  const mcapPerPrice = meta.mcap > 0 && last.c > 0 ? meta.mcap / last.c : 0;

  let avatarFile = null;
  if (await downloadAvatar(meta.image, resolve(PUBLIC_DIR, `${ticker}-avatar.png`))) {
    avatarFile = `pumpfun/${ticker}-avatar.png`;
  }

  const data = {
    token: {
      name: meta.name,
      symbol: meta.symbol,
      avatar: avatarFile,
      mcapPerPrice,
      poolCreatedAt: meta.createdAt,
    },
    candles,
    trades: tape,
    fetchedAt: new Date().toISOString(),
    source: `geckoterminal:solana:${pool}`,
  };

  const out = resolve(DATA_DIR, `${ticker}.json`);
  writeFileSync(out, JSON.stringify(data, null, 2));
  console.log(
    `\nwrote ${out}\n  ${candles.length} candles, ${tape.length} trades, mcap/price=${mcapPerPrice.toFixed(0)}, avatar=${avatarFile ?? "none"}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
