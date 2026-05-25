// Lending's risk curators, ranked by 24h dollar flow. Same diverging-bar reel
// as the DefiLlama category set — see ../defi-flows/FlowReel — fed the curator
// roster with the Morpho lockup and per-row Morpho tags.

import { makeFlowMeta, type FlowDataset } from "../defi-flows/FlowReel";
import { CURATORS, CURATORS_ASOF, CURATORS_SOURCE } from "./data";

const LENDING_FLOW: FlowDataset = {
  id: "LendingCuratorsReel",
  eyebrow: "LAST 24 HOURS",
  title: "Lending’s risk curators",
  subtitle: "Net dollars in or out over 24h — the desks running the Morpho, Euler & Spark lending vaults.",
  source: CURATORS_SOURCE,
  asof: CURATORS_ASOF,
  logoBase: "lending-curators/logos",
  metricNoun: "AUM",
  brand: { logoFile: "lending-curators/logos/morpho.png", label: "MORPHO CURATORS", caption: "marked below" },
  tagLabel: "MORPHO",
  tagColor: "#5B7CFA",
  rows: CURATORS.map((c) => ({ id: c.id, name: c.name, now: c.aum, prior: c.aum24hAgo, tag: c.morpho })),
};

export const lendingCuratorsReelMeta = makeFlowMeta(LENDING_FLOW);
