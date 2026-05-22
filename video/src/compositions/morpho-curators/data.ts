// Morpho Risk Curators — weekly TVL change snapshot.
// Source: DefiLlama "Risk Curators" category (same upstream our
// data-node's defillama_protocols collector mirrors). Snapshot taken
// 2026-05-22; refresh by running `scripts/snapshot-curators.sh`.

import raw from "./curators.json";

export type Curator = {
  slug: string;
  name: string;
  tvl: number;            // USD
  change_1d: number | null;
  change_7d: number | null;
};

export const CURATORS: Curator[] = (raw as Curator[]).filter(
  (c) => c.tvl != null && c.tvl > 0,
);

const TOTAL_TVL = CURATORS.reduce((s, c) => s + c.tvl, 0);
const WINNERS = CURATORS.filter((c) => (c.change_7d ?? 0) > 0).length;
const LOSERS = CURATORS.filter((c) => (c.change_7d ?? 0) < 0).length;

function formatTvl(usd: number): string {
  if (usd >= 1e9) return `$${(usd / 1e9).toFixed(2)}B`;
  if (usd >= 1e6) return `$${(usd / 1e6).toFixed(0)}M`;
  return `$${usd.toFixed(0)}`;
}

export const HEADLINE = {
  eyebrow: "Morpho · Risk Curators",
  date: "Last 7 days",
  hookLine: formatTvl(TOTAL_TVL),
  underLine: `${WINNERS} up · ${LOSERS} down · 7-day TVL change`,
};
