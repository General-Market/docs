// Pull the ENTIRE DefiLlama Derivatives (perps) universe, compute each
// protocol's peak→now TVL drawdown, and surface the ones that once held real
// liquidity and then collapsed — the failure candidates. No manual paste.
//
//   node scripts/scan-all-perps.mjs
//
// Writes src/compositions/perps-graveyard/all-perps-scan.json and prints a
// table of failures (peak ≥ $20M, drawdown ≥ 85%), sorted by peak.

import { writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = `${HERE}/../src/compositions/perps-graveyard`;

const fmtUSD = (n) =>
  n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B`
  : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M`
  : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}K`
  : `$${Math.round(n)}`;

const monthYear = (ms) => new Date(ms).toLocaleDateString("en-US", { month: "short", year: "numeric" });

async function main() {
  console.log("fetching /protocols …");
  const all = await (await fetch("https://api.llama.fi/protocols")).json();
  // Perps live under category "Derivatives" on DefiLlama (also captures options;
  // we filter those out later by name/known list when classifying).
  const derivs = all.filter((p) => p.category === "Derivatives");
  console.log(`${derivs.length} Derivatives protocols. fetching TVL history for each …`);

  const rows = [];
  for (const p of derivs) {
    try {
      const j = await (await fetch(`https://api.llama.fi/protocol/${p.slug}`)).json();
      const series = (Array.isArray(j.tvl) ? j.tvl : [])
        .map((d) => ({ t: d.date * 1000, v: d.totalLiquidityUSD }))
        .filter((d) => Number.isFinite(d.v) && d.v >= 0);
      if (series.length < 5) {
        rows.push({ name: p.name, slug: p.slug, chains: (p.chains || []).join("+"), peak: 0, latest: p.tvl ?? 0, drawdown: 0, note: "no history" });
      } else {
        let peak = series[0];
        for (const d of series) if (d.v > peak.v) peak = d;
        const latest = series[series.length - 1];
        rows.push({
          name: p.name, slug: p.slug, chains: (p.chains || []).join("+"),
          peak: peak.v, peakWhen: monthYear(peak.t),
          latest: latest.v, drawdown: peak.v > 0 ? 1 - latest.v / peak.v : 0,
        });
      }
    } catch (e) {
      rows.push({ name: p.name, slug: p.slug, peak: 0, latest: 0, drawdown: 0, note: `err ${String(e).slice(0, 40)}` });
    }
    await new Promise((r) => setTimeout(r, 120));
  }

  await writeFile(`${OUT}/all-perps-scan.json`, JSON.stringify(rows, null, 2));

  // Failure candidates: once had real liquidity (peak ≥ $20M) and lost ≥ 85% of it.
  const failures = rows
    .filter((r) => r.peak >= 20e6 && r.drawdown >= 0.85)
    .sort((a, b) => b.peak - a.peak);

  console.log(`\n=== FAILURE CANDIDATES — peak ≥ $20M, drawdown ≥ 85% (${failures.length}) ===`);
  for (const r of failures) {
    console.log(
      `${r.name.padEnd(24).slice(0, 24)} ${fmtUSD(r.peak).padStart(8)} ${(r.peakWhen || "").padEnd(9)} -> ${fmtUSD(r.latest).padStart(8)}  −${Math.round(r.drawdown * 100)}%  [${r.slug}]`,
    );
  }

  // Also list the survivors (peak ≥ $50M, drawdown < 50%) so we see the winners.
  const alive = rows.filter((r) => r.peak >= 50e6 && r.drawdown < 0.5).sort((a, b) => b.peak - a.peak);
  console.log(`\n=== STILL ALIVE — peak ≥ $50M, drawdown < 50% (${alive.length}) ===`);
  for (const r of alive) {
    console.log(`${r.name.padEnd(24).slice(0, 24)} ${fmtUSD(r.peak).padStart(8)} -> ${fmtUSD(r.latest).padStart(8)}  −${Math.round(r.drawdown * 100)}%  [${r.slug}]`);
  }

  console.log(`\nTotal Derivatives scanned: ${rows.length}. Full dump: all-perps-scan.json`);
}

main();
