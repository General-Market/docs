#!/usr/bin/env node
// Daily winners-reel data fetch.
//
// Pulls live TVL from DefiLlama's free /protocols endpoint for the five curated
// categories, writes the rows into live-data.generated.ts (the only file the
// pipeline touches — datasets.ts keeps its prose), fetches any missing logos,
// and picks the day's biggest mover into selection.json.
//
//   node scripts/winners-daily/fetch-flows.mjs
//
// Volume was the first choice for perps/prediction, but DefiLlama's volume
// dashboards are paywalled (HTTP 402) and the data-node's perp series is empty,
// so every category ranks by 7-day TVL change — the metric the shipped reels use.

import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const VIDEO = join(HERE, "..", "..");
const REPO = join(VIDEO, "..");
const CURATED = join(REPO, "data-node", "src", "config", "dl-curated.json");
const FLOWS_DIR = join(VIDEO, "src", "compositions", "defi-flows");
const GENERATED = join(FLOWS_DIR, "live-data.generated.ts");
const LOGO_DIR = join(VIDEO, "public", "defi-flows", "logos");
const SELECTION = join(HERE, "selection.json");

const MIN_LEVEL = 2_000_000; // a $2M TVL floor — dust can't become the headline
const MAX_PCT = 150; // a weekly TVL gain above this on these curated rosters is almost
                     // always a listing/methodology artifact (e.g. Rain $3.4M→$26M = +676%),
                     // not organic growth — dropped so a chart-breaking bar can't ship.
const UA = { "User-Agent": "Mozilla/5.0" };

// id -> friendly name, carried over from the hand-tuned datasets.ts so the reels
// keep their polished labels. Unlisted slugs fall back to DefiLlama's name.
const NAME = {
  "jupiter-perpetual-exchange": "Jupiter Perps", "hyperliquid-hlp": "Hyperliquid HLP",
  "gmx-v2-perps": "GMX V2", "extended": "Extended", "derive-v2": "Derive", "dydx-v4": "dYdX",
  "ostium": "Ostium", "avantis": "Avantis", "decibel": "Decibel", "gmtrade": "GMTrade",
  "polymarket-international": "Polymarket", "predict-fun": "Predict.fun", "opinion": "Opinion",
  "sport.fun": "Sport.fun", "rain": "Rain", "gnosis-protocol-v1": "Gnosis Protocol",
  "augur": "Augur", "seer": "Seer", "overtime": "Overtime", "liquidity-house": "Liquidity House",
  "tornado-cash": "Tornado Cash", "railgun": "Railgun", "zama": "Zama", "privacy-pools": "Privacy Pools",
  "aztec-connect": "Aztec Connect", "privacy-cash": "Privacy Cash", "namada-shielded-pools": "Namada",
  "hinkal": "Hinkal", "zkbob": "zkBob", "0x0.ai": "0x0.ai",
  "tether-gold": "Tether Gold", "blackrock-buidl": "BlackRock BUIDL", "circle-usyc": "Circle USYC",
  "ondo-yield-assets": "Ondo Yield", "paxos-gold": "Paxos Gold", "centrifuge-protocol": "Centrifuge",
  "spiko": "Spiko", "ethena-usdtb": "Ethena USDtb", "ondo-global-markets": "Ondo Global Markets",
  "anemoy-capital": "Anemoy",
  "aave-v3": "Aave V3", "morpho-blue": "Morpho", "justlend": "JustLend", "sparklend": "Spark",
  "maple": "Maple", "kamino-lend": "Kamino", "jupiter-lend": "Jupiter Lend", "compound-v3": "Compound V3",
  "venus-core-pool": "Venus", "fluid-lending": "Fluid",
};

const CATS = [
  { key: "defillama-derivatives",      datasetId: "PerpsFlowReel",             comp: "PerpsWinnersReel",             label: "Perps" },
  { key: "defillama-prediction-market", datasetId: "PredictionMarketsFlowReel", comp: "PredictionMarketsWinnersReel", label: "Prediction markets" },
  { key: "defillama-privacy",          datasetId: "PrivacyFlowReel",           comp: "PrivacyWinnersReel",           label: "Privacy" },
  { key: "defillama-rwa",              datasetId: "RwaFlowReel",               comp: "RwaWinnersReel",               label: "RWA" },
  { key: "defillama-lending",          datasetId: "LendingProtocolsFlowReel",  comp: "LendingProtocolsWinnersReel",  label: "Lending" },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const exists = async (p) => { try { await access(p); return true; } catch { return false; } };

const asofStamp = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} UTC`;
};

async function fetchLogo(slug) {
  const out = join(LOGO_DIR, `${slug}.jpg`);
  if (await exists(out)) return true;
  let logo = "";
  for (let i = 0; i < 4 && !logo; i++) {
    try {
      const r = await fetch(`https://api.llama.fi/protocol/${encodeURIComponent(slug)}`, { headers: UA });
      if (r.ok) logo = (await r.json()).logo || "";
    } catch { /* retry */ }
    if (!logo) await sleep(600);
  }
  if (!logo) { console.warn(`  ✗ no logo for ${slug}`); return false; }
  try {
    const img = await fetch(logo, { headers: UA });
    await writeFile(out, Buffer.from(await img.arrayBuffer()));
    console.log(`  ✓ logo ${slug}`);
    return true;
  } catch (e) { console.warn(`  ✗ logo download failed ${slug}: ${e.message}`); return false; }
}

async function main() {
  const curated = JSON.parse(await readFile(CURATED, "utf8"));
  await mkdir(LOGO_DIR, { recursive: true });

  console.log("Fetching DefiLlama /protocols …");
  const res = await fetch("https://api.llama.fi/protocols", { headers: UA });
  if (!res.ok) throw new Error(`/protocols HTTP ${res.status}`);
  const all = await res.json();
  const bySlug = new Map(all.map((p) => [p.slug, p]));

  const asof = asofStamp();
  const live = {};   // datasetId -> { asof, rows }
  const ranking = []; // per category summary for selection

  for (const cat of CATS) {
    const slugs = curated[cat.key];
    if (!slugs) { console.warn(`! missing curated key ${cat.key}`); continue; }
    const rows = [];
    for (const slug of slugs) {
      const p = bySlug.get(slug);
      if (!p || p.tvl == null || p.change_7d == null) {
        console.warn(`  · ${cat.label}: ${slug} absent or no change_7d — skipped`);
        continue;
      }
      const now = Math.round(p.tvl);
      const prior = Math.round(p.tvl / (1 + p.change_7d / 100));
      // Drop positive artifacts (an 8x in a week) so a chart-breaking bar never ships.
      if (now > prior && prior > 0 && ((now - prior) / prior) * 100 > MAX_PCT) {
        console.warn(`  · ${cat.label}: ${slug} +${(((now - prior) / prior) * 100).toFixed(0)}% — artifact, dropped`);
        continue;
      }
      rows.push({ id: slug, name: NAME[slug] ?? p.name, now, prior });
    }
    live[cat.datasetId] = { asof, rows };

    // Qualifying winners: real organic growth — established both weeks, no artifacts.
    const winners = rows
      .filter((r) => r.now > r.prior && r.now >= MIN_LEVEL && r.prior >= MIN_LEVEL)
      .map((r) => ({ ...r, pct: ((r.now - r.prior) / r.prior) * 100 }))
      .sort((a, b) => b.pct - a.pct);
    ranking.push({
      category: cat.label, datasetId: cat.datasetId, comp: cat.comp,
      winnerCount: winners.length,
      top: winners[0] ?? null,
    });
    const topStr = winners[0] ? `${winners[0].name} +${winners[0].pct.toFixed(1)}%` : "— no winners";
    console.log(`${cat.label.padEnd(20)} winners=${String(winners.length).padStart(2)}  top: ${topStr}`);
  }

  // Fetch any logos still missing for rows that could appear.
  console.log("Checking logos …");
  const allSlugs = [...new Set(Object.values(live).flatMap((c) => c.rows.map((r) => r.id)))];
  for (const slug of allSlugs) { if (!(await exists(join(LOGO_DIR, `${slug}.jpg`)))) await fetchLogo(slug); }

  // Pick the day's biggest mover.
  const eligible = ranking.filter((r) => r.top);
  eligible.sort((a, b) => b.top.pct - a.top.pct);
  if (eligible.length === 0) throw new Error("No category has a qualifying winner today — nothing to render.");
  const winner = eligible[0];

  // Write generated data module.
  const body =
`// AUTO-GENERATED by scripts/winners-daily/fetch-flows.mjs — do not edit by hand.
// ${asof}  ·  source: DefiLlama /protocols (free), 7-day TVL change.
import type { FlowRow } from "./FlowReel";

export const ASOF = ${JSON.stringify(asof)};

export const LIVE: Record<string, { asof: string; rows: FlowRow[] }> = {
${Object.entries(live).map(([id, c]) =>
`  ${id}: {
    asof: ASOF,
    rows: [
${c.rows.map((r) => `      { id: ${JSON.stringify(r.id)}, name: ${JSON.stringify(r.name)}, now: ${r.now}, prior: ${r.prior} },`).join("\n")}
    ],
  },`).join("\n")}
};
`;
  await writeFile(GENERATED, body);
  console.log(`\nWrote ${GENERATED}`);

  const selection = {
    asof,
    winner: { category: winner.category, datasetId: winner.datasetId, compositionId: winner.comp, top: winner.top },
    ranking: eligible.map((r) => ({ category: r.category, compositionId: r.comp, topName: r.top.name, topPct: +r.top.pct.toFixed(2), winnerCount: r.winnerCount })),
  };
  await writeFile(SELECTION, JSON.stringify(selection, null, 2));
  console.log(`Wrote ${SELECTION}`);
  console.log(`\n▶ Day's pick: ${winner.category} — ${winner.top.name} +${winner.top.pct.toFixed(1)}%  (render ${winner.comp})`);
}

main().catch((e) => { console.error("fetch-flows failed:", e.message); process.exit(1); });
