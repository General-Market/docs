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
// Verified roster: ORDER-BOOK perps DEXs that raised >$10M (relaxed to ≥$8.5M
// for Vertex) and failed/faded on the cost of liquidity. Pool/AMM models and
// living protocols were cut. Ordered by raise, descending. Cause lines are
// honest per protocol — dYdX is the survivor that still bled; Mango's killer
// was an exploit; Aevo and Helix faded rather than died.
const ROSTER = [
  { id: "dydx", name: "dYdX", raised: 87_000_000, cause: "The deepest book of its era — yet still bled 88% as the flow left for Hyperliquid.", fundSrc: "Seed–Series C · a16z, Paradigm, 3AC" },
  { id: "mango-markets", name: "Mango Markets", raised: 70_000_000, cause: "A $114M oracle exploit on a book too thin to defend — then the regulator finished it.", fundSrc: "MNGO token sale, 2021" },
  { id: "vega-protocol", name: "Vega Protocol", raised: 53_000_000, cause: "Built a whole chain for markets — and almost nobody made one.", fundSrc: "Pantera · CoinList sale" },
  { id: "serum", name: "Serum", raised: 20_000_000, cause: "Solana's order book — owned by FTX, killed by FTX. Keys and market maker gone in a week.", fundSrc: "FTX · Alameda · Solana" },
  { id: "helix", name: "Injective · Helix", raised: 17_000_000, cause: "A fully on-chain book with no resident market makers — it emptied, TVL fell 96%.", fundSrc: "Binance Labs · Pantera · Cuban" },
  { id: "rabbitx", name: "RabbitX", raised: 15_600_000, cause: "Hopped from chain to chain chasing whoever would rent it liquidity.", fundSrc: "Multicoin · Sequoia (Seed+A+IDO)" },
  { id: "zeta", name: "Zeta Markets", raised: 13_500_000, cause: "Its book sat on Serum — when FTX fell, the liquidity went with it.", fundSrc: "Jump · Electric · Alameda" },
  { id: "aevo", name: "Aevo", raised: 10_600_000, cause: "Token-launch liquidity rushed in, then bled 84% as the incentives wore off.", fundSrc: "Paradigm · Dragonfly (Ribbon)" },
  { id: "satori-finance", name: "Satori Finance", raised: 10_000_000, cause: "Pitched for Polkadot, pivoted to zk-rollups, never found the market makers.", fundSrc: "Polychain · Blockchange" },
  { id: "vertex-perps", name: "Vertex Protocol", raised: 8_500_000, cause: "Lost the liquidity war to Hyperliquid, then folded the whole stack into another chain.", fundSrc: "Hack VC · Wintermute" },
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
