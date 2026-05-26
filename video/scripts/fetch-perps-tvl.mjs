// Fetch real DefiLlama TVL series for perps protocols, downsample to a compact
// sparkline, and report peak → latest so we can pick the clearest collapses.
//
//   node scripts/fetch-perps-tvl.mjs
//
// Writes:
//   src/compositions/perps-graveyard/tvl-raw/<slug>.json   (full {t,v} series)
//   src/compositions/perps-graveyard/tvl-summary.json       (peak/latest/drawdown)

import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = `${HERE}/../src/compositions/perps-graveyard`;

// Candidate roster — more than 20 on purpose; we cut to the clearest collapses.
// Each: defillama slug (best guess), display name, disclosed raise (USD, null = undisclosed/fair-launch).
const CANDIDATES = [
  { slug: "dydx", name: "dYdX", raised: 87_000_000 },
  { slug: "dydx-v4", name: "dYdX v4", raised: 87_000_000 },
  { slug: "perpetual-protocol", name: "Perpetual Protocol", raised: 1_800_000 },
  { slug: "mcdex", name: "MCDEX", raised: 7_000_000 },
  { slug: "mux-protocol", name: "MUX Protocol", raised: 7_000_000 },
  { slug: "futureswap", name: "Futureswap", raised: 12_400_000 },
  { slug: "derivadex", name: "DerivaDEX", raised: 2_700_000 },
  { slug: "vega-protocol", name: "Vega Protocol", raised: 53_000_000 },
  { slug: "injective", name: "Injective", raised: 17_000_000 },
  { slug: "helix", name: "Helix (Injective)", raised: 17_000_000 },
  { slug: "mango-markets", name: "Mango Markets", raised: 70_000_000 },
  { slug: "drift", name: "Drift Protocol", raised: 52_500_000 },
  { slug: "drift-trade", name: "Drift", raised: 52_500_000 },
  { slug: "zeta", name: "Zeta Markets", raised: 13_500_000 },
  { slug: "serum", name: "Serum", raised: 20_000_000 },
  { slug: "project-serum", name: "Serum", raised: 20_000_000 },
  { slug: "apollox", name: "ApolloX", raised: null },
  { slug: "apx-finance", name: "ApolloX", raised: null },
  { slug: "vertex-protocol", name: "Vertex Protocol", raised: 8_500_000 },
  { slug: "vertex-perps", name: "Vertex Protocol", raised: 8_500_000 },
  { slug: "satori-finance", name: "Satori Finance", raised: 10_000_000 },
  { slug: "aevo", name: "Aevo", raised: 10_600_000 },
  { slug: "rabbitx", name: "RabbitX", raised: 11_000_000 },
  { slug: "gmx", name: "GMX", raised: 0 },
  { slug: "gains-network", name: "Gains Network", raised: 250_000 },
  { slug: "level-finance", name: "Level Finance", raised: 500_000 },
  { slug: "synthetix", name: "Synthetix", raised: 30_000_000 },
  { slug: "kwenta", name: "Kwenta", raised: 30_000_000 },
  { slug: "vela-exchange", name: "Vela Exchange", raised: 2_100_000 },
  { slug: "deri-protocol", name: "Deri Protocol", raised: null },
  { slug: "deri-v4", name: "Deri Protocol", raised: null },
  { slug: "cap-finance", name: "Cap Finance", raised: 0 },
  { slug: "pika-protocol", name: "Pika Protocol", raised: null },
  { slug: "mycelium-perpetual-swaps", name: "Mycelium", raised: 4_500_000 },
  { slug: "mycelium", name: "Mycelium", raised: 4_500_000 },
];

const fmtUSD = (n) =>
  n == null ? "n/a"
  : n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B`
  : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M`
  : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}K`
  : `$${n.toFixed(0)}`;

// Downsample a series to ~target points by bucketed max (keeps the peak visible).
function downsample(series, target = 90) {
  if (series.length <= target) return series;
  const step = series.length / target;
  const out = [];
  for (let i = 0; i < target; i++) {
    const a = Math.floor(i * step);
    const b = Math.floor((i + 1) * step);
    let best = series[a];
    for (let j = a; j < b && j < series.length; j++) {
      if (series[j].v > best.v) best = series[j];
    }
    out.push(best);
  }
  // Pin true endpoints so peak/latest/drawdown are honest (bucketed max can
  // otherwise overstate "now" when current TVL is volatile, e.g. Helix/Aevo).
  out[0] = series[0];
  out[out.length - 1] = series[series.length - 1];
  return out;
}

async function fetchOne(c) {
  const url = `https://api.llama.fi/protocol/${c.slug}`;
  try {
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) return { ...c, ok: false, err: `HTTP ${res.status}` };
    const j = await res.json();
    const tvlArr = Array.isArray(j.tvl) ? j.tvl : [];
    const series = tvlArr
      .map((p) => ({ t: p.date, v: p.totalLiquidityUSD }))
      .filter((p) => Number.isFinite(p.v) && p.v >= 0);
    if (series.length < 8) return { ...c, ok: false, err: `only ${series.length} pts` };

    let peak = series[0], peakIdx = 0;
    series.forEach((p, i) => { if (p.v > peak.v) { peak = p; peakIdx = i; } });
    const latest = series[series.length - 1];
    const drawdown = peak.v > 0 ? 1 - latest.v / peak.v : 0;

    return {
      ...c,
      ok: true,
      points: series.length,
      peakUSD: peak.v,
      peakDate: new Date(peak.t * 1000).toISOString().slice(0, 10),
      latestUSD: latest.v,
      latestDate: new Date(latest.t * 1000).toISOString().slice(0, 10),
      drawdown,
      series: downsample(series, 90),
    };
  } catch (e) {
    return { ...c, ok: false, err: String(e).slice(0, 80) };
  }
}

async function main() {
  await mkdir(`${OUT}/tvl-raw`, { recursive: true });
  const results = [];
  for (const c of CANDIDATES) {
    const r = await fetchOne(c);
    results.push(r);
    if (r.ok) {
      await writeFile(`${OUT}/tvl-raw/${c.slug}.json`, JSON.stringify({ slug: c.slug, name: c.name, series: r.series }));
    }
    await new Promise((res) => setTimeout(res, 250)); // be polite
  }

  const ok = results.filter((r) => r.ok).sort((a, b) => b.peakUSD - a.peakUSD);
  const bad = results.filter((r) => !r.ok);

  console.log("\n=== GOT DATA (sorted by peak TVL) ===");
  for (const r of ok) {
    console.log(
      `${r.slug.padEnd(26)} peak ${fmtUSD(r.peakUSD).padStart(8)} @${r.peakDate}` +
      ` -> now ${fmtUSD(r.latestUSD).padStart(8)} @${r.latestDate}` +
      `  drawdown ${(r.drawdown * 100).toFixed(0)}%  (${r.points} pts, raise ${fmtUSD(r.raised)})`,
    );
  }
  console.log("\n=== NO USABLE DATA ===");
  for (const r of bad) console.log(`${r.slug.padEnd(26)} ${r.err}`);

  await writeFile(
    `${OUT}/tvl-summary.json`,
    JSON.stringify(ok.map(({ series, ...rest }) => rest), null, 2),
  );
  console.log(`\nwrote ${ok.length} raw series + tvl-summary.json to ${OUT}`);
}

main();
