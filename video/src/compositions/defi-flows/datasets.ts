// Five DefiLlama categories, ranked by 7-day TVL change.
//
// The PROSE here is hand-written and permanent. The NUMBERS (rows + asof) are
// machine-written into live-data.generated.ts by scripts/winners-daily/fetch-flows.mjs
// and imported below — so the daily pipeline refreshes the figures without ever
// touching this file's titles, framing, or source lines.
//
// Volume was the first choice for the trading venues, but DefiLlama's volume
// dashboards are paywalled (HTTP 402), so every category ranks by TVL change,
// pulled live from the free api.llama.fi/protocols. Rosters are the curated
// slug lists in data-node/src/config/dl-curated.json.

import { makeFlowMeta, type FlowDataset } from "./FlowReel";
import { makeCrtBarMeta } from "./CrtBarReel";
import { LIVE } from "./live-data.generated";

const LOGOS = "defi-flows/logos";

// Two framings, chosen per category for the most striking growth story:
// "pct" surfaces explosive small movers, "usd" surfaces the giants.
const sourceUsd = (category: string) =>
  `DefiLlama ${category}, read live from api.llama.fi/protocols. Bar = net TVL flow over 7 days, in dollars.`;
const sourcePct = (category: string) =>
  `DefiLlama ${category}, read live from api.llama.fi/protocols. Bar = TVL growth over 7 days, in percent.`;

export const PERPS_FLOW: FlowDataset = {
  id: "PerpsFlowReel",
  eyebrow: "7-DAY GROWTH",
  title: "Perps exchanges",
  subtitle: "TVL growth over 7 days — the venues where leverage trades.",
  source: sourcePct("Derivatives"),
  asof: LIVE.PerpsFlowReel.asof,
  logoBase: LOGOS,
  mode: "pct",
  rows: LIVE.PerpsFlowReel.rows,
};

export const PREDICTION_FLOW: FlowDataset = {
  id: "PredictionMarketsFlowReel",
  eyebrow: "LAST 7 DAYS",
  title: "Prediction markets",
  subtitle: "Net dollars in or out over 7 days — where the crowd bets on outcomes.",
  source: sourceUsd("Prediction Markets"),
  asof: LIVE.PredictionMarketsFlowReel.asof,
  logoBase: LOGOS,
  mode: "usd",
  rows: LIVE.PredictionMarketsFlowReel.rows,
};

export const PRIVACY_FLOW: FlowDataset = {
  id: "PrivacyFlowReel",
  eyebrow: "7-DAY GROWTH",
  title: "Privacy protocols",
  subtitle: "TVL growth over 7 days — the mixers and shielded pools.",
  source: sourcePct("Privacy"),
  asof: LIVE.PrivacyFlowReel.asof,
  logoBase: LOGOS,
  mode: "pct",
  rows: LIVE.PrivacyFlowReel.rows,
};

export const RWA_FLOW: FlowDataset = {
  id: "RwaFlowReel",
  eyebrow: "LAST 7 DAYS",
  title: "Real-world assets",
  subtitle: "Net dollars in or out over 7 days — tokenized treasuries, gold and credit.",
  source: sourceUsd("RWA"),
  asof: LIVE.RwaFlowReel.asof,
  logoBase: LOGOS,
  mode: "usd",
  rows: LIVE.RwaFlowReel.rows,
};

export const LENDING_PROTOCOLS_FLOW: FlowDataset = {
  id: "LendingProtocolsFlowReel",
  eyebrow: "LAST 7 DAYS",
  title: "Lending markets",
  subtitle: "Net dollars in or out over 7 days — where deposits chase yield.",
  source: sourceUsd("Lending"),
  asof: LIVE.LendingProtocolsFlowReel.asof,
  logoBase: LOGOS,
  mode: "usd",
  rows: LIVE.LendingProtocolsFlowReel.rows,
};

// ── The registry ────────────────────────────────────────────────────────────
// To add a reel: drop one FlowDataset in here (its id ends in "FlowReel") and
// put its logos under public/<logoBase>/. Both the horizontal diverging-bar
// reel and the cathode winners reel register automatically — no edits anywhere
// else. See README.md for the copy-paste template and the logo fetch command.
export const REELS: FlowDataset[] = [PERPS_FLOW, PREDICTION_FLOW, PRIVACY_FLOW, RWA_FLOW, LENDING_PROTOCOLS_FLOW];

// Horizontal diverging-bar reels (gains + losses), one per dataset.
export const flowMetas = REELS.map(makeFlowMeta);
// Cathode winners-only bar reels (RetailPnLMarketsReel style), one per dataset.
export const winnersMetas = REELS.map((d) => makeCrtBarMeta(d, d.id.replace("FlowReel", "WinnersReel")));
