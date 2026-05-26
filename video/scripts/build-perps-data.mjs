// Consolidate the curated 20-protocol roster + their real DefiLlama TVL series
// into one self-contained TS module the composition imports.
//
//   node scripts/build-perps-data.mjs
//
// Reads:  src/compositions/perps-graveyard/tvl-raw/<tvlSlug>.json
// Writes: src/compositions/perps-graveyard/data.ts

import { readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DIR = `${HERE}/../src/compositions/perps-graveyard`;

// id        — logo file at public/defi-flows/logos/<id>.jpg
// tvlSlug   — which tvl-raw series to use (defaults to id)
// raised    — disclosed USD (null = undisclosed / fair launch)
// raisedNote— shown in place of a dollar figure when raised is null
// cause     — one honest line; most about liquidity, a few are accurate variants
// fundSrc   — funding citation for the source line
const ROSTER = [
  { id: "dydx", name: "dYdX", raised: 87_000_000, cause: "Volume fell 90% the day the token rewards stopped.", fundSrc: "Seed–Series C · a16z, Paradigm, 3AC" },
  { id: "mango-markets", name: "Mango Markets", raised: 70_000_000, cause: "Liquidity so thin one trader pumped his own collateral and drained $114M.", fundSrc: "MNGO token sale, 2021" },
  { id: "vega-protocol", name: "Vega Protocol", raised: 53_000_000, cause: "Built a whole chain for markets — and almost nobody made one.", fundSrc: "Pantera · CoinList sale" },
  { id: "synthetix", name: "Synthetix", raised: 30_000_000, cause: "Every staker was the house; a 400% collateral ratio strangled the depth.", fundSrc: "ICO 2018 · Framework" },
  { id: "serum", name: "Serum", raised: 20_000_000, cause: "FTX held the upgrade keys — the liquidity backbone unplugged in a day.", fundSrc: "FTX · Alameda · Solana" },
  { id: "helix", name: "Injective · Helix", raised: 17_000_000, cause: "An order book that paid for makers — its DEX TVL still fell 96%.", fundSrc: "Binance Labs · Pantera · Cuban" },
  { id: "zeta", name: "Zeta Markets", raised: 13_500_000, cause: "The volume only showed up when the points did.", fundSrc: "Jump · Electric · Alameda" },
  { id: "futureswap", name: "Futureswap", raised: 12_400_000, cause: "The #1 DEX in three days — abandoned, then drained by its own zombie contracts.", fundSrc: "Framework · Ribbit" },
  { id: "rabbitx", name: "RabbitX", raised: 11_000_000, cause: "Hopped from chain to chain chasing whoever would rent it liquidity.", fundSrc: "Sequoia · Multicoin" },
  { id: "mcdex", name: "MCDEX → MUX", raised: 7_000_000, cause: "Couldn't bootstrap its own depth — so it became a router into everyone else's.", fundSrc: "Delphi · Alameda" },
  { id: "mycelium", name: "Mycelium", raised: 4_500_000, cause: "A GMX clone that never reached escape velocity.", fundSrc: "Framework · GSR (Tracer DAO)" },
  { id: "derivadex", name: "DerivaDEX", raised: 2_700_000, cause: "An order book with no market makers is an empty book.", fundSrc: "Polychain · Coinbase · Dragonfly" },
  { id: "vela-exchange", name: "Vela Exchange", raised: 2_100_000, cause: "Launched to #6 on Arbitrum — dead within a year.", fundSrc: "seed, 2023" },
  { id: "perpetual-protocol", name: "Perpetual Protocol", raised: 1_800_000, cause: "The vAMM held no real liquidity — just an insurance fund that drained.", fundSrc: "Multicoin seed" },
  { id: "level-finance", name: "Level Finance", raised: 500_000, cause: "Tranched its LP risk like a CDO — bled to −99.9% after a referral hack.", fundSrc: "strategic, 2022" },
  { id: "deri-protocol", name: "Deri Protocol", raised: null, raisedNote: "Binance Labs", cause: "$600M/day at the peak — now a $7M shadow of the 2021 boom.", fundSrc: "Binance Labs $1B fund" },
  { id: "pika-protocol", name: "Pika Protocol", raised: null, raisedNote: "VC-backed", cause: "Did $2B in volume, then quietly redeemed its own token for ETH.", fundSrc: "Primitive Ventures" },
];

const fmtUSD = (n) =>
  n >= 1e9 ? `$${(n / 1e9).toFixed(n >= 1e10 ? 0 : 2)}B`
  : n >= 1e6 ? `$${(n / 1e6).toFixed(n >= 1e8 ? 0 : 1)}M`
  : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}K`
  : `$${Math.round(n)}`;

const fmtRaise = (n) =>
  n >= 1e9 ? `$${(n / 1e9).toFixed(1)}B`
  : n >= 1e6 ? `$${(n / 1e6).toFixed(n % 1e6 === 0 ? 0 : 1)}M`
  : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}K`
  : `$${n}`;

const monthYear = (iso) => {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
};

async function main() {
  const out = [];
  for (const r of ROSTER) {
    const tvlSlug = r.tvlSlug ?? r.id;
    const raw = JSON.parse(await readFile(`${DIR}/tvl-raw/${tvlSlug}.json`, "utf8"));
    const series = raw.series; // [{t,v}]
    let peak = series[0], peakIdx = 0;
    series.forEach((p, i) => { if (p.v > peak.v) { peak = p; peakIdx = i; } });
    const latest = series[series.length - 1];
    const drawdown = peak.v > 0 ? 1 - latest.v / peak.v : 0;

    out.push({
      id: r.id,
      name: r.name,
      raised: r.raised,
      raisedNote: r.raisedNote ?? null,
      raisedLabel: r.raised != null ? fmtRaise(r.raised) : (r.raisedNote ?? ""),
      cause: r.cause,
      fundSrc: r.fundSrc,
      peakUSD: Math.round(peak.v),
      peakLabel: fmtUSD(peak.v),
      peakWhen: monthYear(new Date(peak.t * 1000).toISOString()),
      peakIdx,
      latestUSD: Math.round(latest.v),
      latestLabel: latest.v >= 1000 ? fmtUSD(latest.v) : `$${Math.round(latest.v).toLocaleString("en-US")}`,
      drawdownPct: Math.round(drawdown * 100),
      // store v values only (x = index); normalized later in the component
      spark: series.map((p) => Math.max(0, p.v)),
    });
  }

  const totalRaised = ROSTER.reduce((s, r) => s + (r.raised ?? 0), 0);

  const banner = `// AUTO-GENERATED by scripts/build-perps-data.mjs — do not edit by hand.\n// TVL series are real, pulled from the DefiLlama API and downsampled (bucketed max).\n// Re-run the fetch + build scripts to refresh.\n`;
  const body =
    `${banner}\nexport type Protocol = {\n` +
    `  id: string;\n  name: string;\n  raised: number | null;\n  raisedNote: string | null;\n` +
    `  raisedLabel: string;\n  cause: string;\n  fundSrc: string;\n` +
    `  peakUSD: number;\n  peakLabel: string;\n  peakWhen: string;\n  peakIdx: number;\n` +
    `  latestUSD: number;\n  latestLabel: string;\n  drawdownPct: number;\n  spark: number[];\n};\n\n` +
    `export const TOTAL_RAISED_USD = ${totalRaised};\n` +
    `export const TOTAL_RAISED_LABEL = ${JSON.stringify(fmtRaise(totalRaised))};\n\n` +
    `export const PROTOCOLS: Protocol[] = ${JSON.stringify(out, null, 2)};\n`;

  await writeFile(`${DIR}/data.ts`, body);
  console.log(`wrote data.ts — ${out.length} protocols, total disclosed raise ${fmtRaise(totalRaised)}`);
  out.forEach((p, i) =>
    console.log(`  ${String(i + 1).padStart(2)}. ${p.name.padEnd(20)} ${p.raisedLabel.padStart(10)}  peak ${p.peakLabel.padStart(8)} ${p.peakWhen} -> ${p.latestLabel.padStart(9)}  −${p.drawdownPct}%  (${p.spark.length} pts)`),
  );
}

main();
