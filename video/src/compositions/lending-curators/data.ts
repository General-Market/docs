// DefiLlama "Risk Curators" — the desks that run the lending vaults on Morpho,
// Euler and Spark. A curator sets a vault's risk parameters and earns a cut of
// the yield; their "AUM" is the total deposited into the vaults they manage.
//
// REAL snapshot, pulled live from the VPS 1 data-node (source "defi", which
// mirrors api.llama.fi/protocols), as of 2026-05-25 04:59 UTC. The 24h figure
// is the change in AUM vs the price point closest to 24h prior in the
// data-node's own history — the same series that drives the Vision markets.
//
// The curated roster is the data-node's `defillama-risk-curators` batch
// (data-node/src/config/dl-curated.json). Sorted here by 24h change, descending.

export type Curator = {
  id: string; // logo file stem under public/lending-curators/logos/
  name: string;
  aum: number; // assets under curation, USD
  change24h: number; // percent
  morpho?: boolean; // a flagship Morpho curator (Steakhouse + Gauntlet run Morpho's two largest vaults)
};

export const CURATORS_ASOF = "2026-05-25 04:59 UTC";

export const CURATORS_SOURCE =
  "DefiLlama Risk Curators, read live from the generalmarket.io data-node (source “defi”). Bar = 24h change in assets under curation, against the node’s own price history.";

// The headline: lending's top 24h gainer is the smallest of the big books.
export const TOP_GAINER_ID = "vault-bridge";

export const CURATORS: Curator[] = [
  { id: "vault-bridge", name: "Vault Bridge", aum: 135_911_333, change24h: 0.84 },
  { id: "sentora", name: "Sentora", aum: 1_656_115_968, change24h: 0.44, morpho: true },
  { id: "steakhouse", name: "Steakhouse", aum: 2_139_949_232, change24h: 0.26, morpho: true },
  { id: "rockawayx", name: "RockawayX", aum: 107_046_900, change24h: 0.24 },
  { id: "telos", name: "Telos Consilium", aum: 138_207_656, change24h: -0.02 },
  { id: "k3-capital", name: "K3 Capital", aum: 201_602_034, change24h: -0.47, morpho: true },
  { id: "kpk", name: "kpk", aum: 170_325_477, change24h: -0.79, morpho: true },
  { id: "sky", name: "Sky", aum: 145_314_932, change24h: -0.92 },
  { id: "gauntlet", name: "Gauntlet", aum: 1_443_896_192, change24h: -1.06, morpho: true },
  { id: "clearstar", name: "Clearstar", aum: 110_608_939, change24h: -1.18 },
];

export const fmtUSD = (v: number): string => {
  if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(2)}B`;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(0)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
};

export const fmtPct = (v: number): string => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(2)}%`;
