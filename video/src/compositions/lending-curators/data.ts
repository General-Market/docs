// DefiLlama "Risk Curators" — the desks that run the lending vaults on Morpho,
// Euler and Spark. A curator sets a vault's risk parameters and earns a cut of
// the yield; their "AUM" is the total deposited into the vaults they manage.
//
// REAL snapshot, pulled live from the VPS 1 data-node (source "defi", which
// mirrors api.llama.fi/protocols), as of 2026-05-25 04:59 UTC. Each curator
// carries its AUM now and its AUM ~24h prior (the price point closest to 24h
// back in the data-node's own history). The roster is the data-node's
// `defillama-risk-curators` batch (data-node/src/config/dl-curated.json).

export type Curator = {
  id: string; // logo file stem under public/lending-curators/logos/
  name: string;
  aum: number; // assets under curation now, USD
  aum24hAgo: number; // assets under curation ~24h ago, USD
  morpho?: boolean; // a flagship Morpho curator (Steakhouse + Gauntlet run Morpho's two largest vaults)
};

export const CURATORS_ASOF = "2026-05-25 04:59 UTC";

export const CURATORS_SOURCE =
  "DefiLlama Risk Curators, read live from the generalmarket.io data-node (source “defi”). Bar = net flow over 24h, in dollars, against the node’s own price history.";

export const CURATORS: Curator[] = [
  { id: "sentora", name: "Sentora", aum: 1_656_115_968, aum24hAgo: 1_648_903_200, morpho: true },
  { id: "steakhouse", name: "Steakhouse", aum: 2_139_949_232, aum24hAgo: 2_134_341_001, morpho: true },
  { id: "vault-bridge", name: "Vault Bridge", aum: 135_911_333, aum24hAgo: 134_783_973 },
  { id: "rockawayx", name: "RockawayX", aum: 107_046_900, aum24hAgo: 106_790_198 },
  { id: "telos", name: "Telos Consilium", aum: 138_207_656, aum24hAgo: 138_231_206 },
  { id: "k3-capital", name: "K3 Capital", aum: 201_602_034, aum24hAgo: 202_561_501, morpho: true },
  { id: "clearstar", name: "Clearstar", aum: 110_608_939, aum24hAgo: 111_929_029 },
  { id: "sky", name: "Sky", aum: 145_314_932, aum24hAgo: 146_663_634 },
  { id: "kpk", name: "kpk", aum: 170_325_477, aum24hAgo: 171_675_836, morpho: true },
  { id: "gauntlet", name: "Gauntlet", aum: 1_443_896_192, aum24hAgo: 1_459_343_069, morpho: true },
];
