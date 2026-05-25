// Four DefiLlama categories, ranked by net dollar flow over the last 7 days.
//
// REAL snapshot, pulled live from the VPS 1 data-node (source "defi", which
// mirrors api.llama.fi/protocols), as of 2026-05-25 08:17 UTC. Each row holds
// TVL now and TVL ~7 days prior (the price point closest to 7 days back in the
// data-node's own history — the same series that drives the Vision markets).
// The rosters are the data-node's curated batches in
// data-node/src/config/dl-curated.json.

import { makeFlowMeta, type FlowDataset } from "./FlowReel";

const ASOF = "2026-05-25 08:17 UTC";
const EYEBROW = "LAST 7 DAYS";
const LOGOS = "defi-flows/logos";

const source = (category: string) =>
  `DefiLlama ${category}, read live from the generalmarket.io data-node (source “defi”). Bar = net flow over 7 days, in dollars, against the node’s own price history.`;

export const PERPS_FLOW: FlowDataset = {
  id: "PerpsFlowReel",
  eyebrow: EYEBROW,
  title: "Perps exchanges",
  subtitle: "Net dollars in or out over 7 days — the venues where leverage trades.",
  source: source("Derivatives"),
  asof: ASOF,
  logoBase: LOGOS,
  rows: [
    { id: "jupiter-perpetual-exchange", name: "Jupiter Perps", now: 669_930_921, prior: 675_335_787 },
    { id: "hyperliquid-hlp", name: "Hyperliquid HLP", now: 369_489_679, prior: 388_360_906 },
    { id: "gmx-v2-perps", name: "GMX V2", now: 199_133_601, prior: 201_185_312 },
    { id: "extended", name: "Extended", now: 151_136_974, prior: 153_238_150 },
    { id: "derive-v2", name: "Derive", now: 134_587_080, prior: 119_231_542 },
    { id: "dydx-v4", name: "dYdX", now: 99_696_504, prior: 99_434_021 },
    { id: "ostium", name: "Ostium", now: 42_155_951, prior: 49_178_856 },
    { id: "avantis", name: "Avantis", now: 45_603_604, prior: 46_190_178 },
    { id: "decibel", name: "Decibel", now: 42_098_277, prior: 42_962_554 },
    { id: "gmtrade", name: "GMTrade", now: 41_234_916, prior: 39_234_099 },
  ],
};

export const PREDICTION_FLOW: FlowDataset = {
  id: "PredictionMarketsFlowReel",
  eyebrow: EYEBROW,
  title: "Prediction markets",
  subtitle: "Net dollars in or out over 7 days — where the crowd bets on outcomes.",
  source: source("Prediction Markets"),
  asof: ASOF,
  logoBase: LOGOS,
  rows: [
    { id: "polymarket-international", name: "Polymarket", now: 454_183_234, prior: 447_863_841 },
    { id: "predict-fun", name: "Predict.fun", now: 14_104_503, prior: 14_399_222 },
    { id: "opinion", name: "Opinion", now: 7_274_738, prior: 7_771_598 },
    { id: "sport.fun", name: "Sport.fun", now: 3_701_451, prior: 3_642_736 },
    { id: "rain", name: "Rain", now: 3_427_628, prior: 3_339_313 },
    { id: "gnosis-protocol-v1", name: "Gnosis Protocol", now: 2_230_636, prior: 2_244_102 },
    { id: "augur", name: "Augur", now: 1_682_194, prior: 1_687_277 },
    { id: "seer", name: "Seer", now: 1_539_274, prior: 1_516_164 },
    { id: "overtime", name: "Overtime", now: 1_427_676, prior: 1_612_247 },
    { id: "liquidity-house", name: "Liquidity House", now: 1_431_499, prior: 1_298_822 },
  ],
};

export const PRIVACY_FLOW: FlowDataset = {
  id: "PrivacyFlowReel",
  eyebrow: EYEBROW,
  title: "Privacy protocols",
  subtitle: "Net dollars in or out over 7 days — the mixers and shielded pools.",
  source: source("Privacy"),
  asof: ASOF,
  logoBase: LOGOS,
  rows: [
    { id: "tornado-cash", name: "Tornado Cash", now: 521_515_520, prior: 513_158_776 },
    { id: "railgun", name: "Railgun", now: 94_303_875, prior: 94_907_819 },
    { id: "zama", name: "Zama", now: 32_351_714, prior: 32_308_678 },
    { id: "privacy-pools", name: "Privacy Pools", now: 6_660_179, prior: 6_750_113 },
    { id: "aztec-connect", name: "Aztec Connect", now: 5_367_276, prior: 5_385_994 },
    { id: "privacy-cash", name: "Privacy Cash", now: 2_841_326, prior: 2_393_817 },
    { id: "namada-shielded-pools", name: "Namada", now: 649_958, prior: 628_831 },
    { id: "hinkal", name: "Hinkal", now: 605_941, prior: 636_770 },
    { id: "zkbob", name: "zkBob", now: 246_126, prior: 252_946 },
    { id: "0x0.ai", name: "0x0.ai", now: 218_950, prior: 220_905 },
  ],
};

export const RWA_FLOW: FlowDataset = {
  id: "RwaFlowReel",
  eyebrow: EYEBROW,
  title: "Real-world assets",
  subtitle: "Net dollars in or out over 7 days — tokenized treasuries, gold and credit.",
  source: source("RWA"),
  asof: ASOF,
  logoBase: LOGOS,
  rows: [
    { id: "tether-gold", name: "Tether Gold", now: 3_235_779_408, prior: 3_238_764_543 },
    { id: "blackrock-buidl", name: "BlackRock BUIDL", now: 3_054_831_569, prior: 3_225_558_401 },
    { id: "circle-usyc", name: "Circle USYC", now: 2_985_476_933, prior: 2_974_535_529 },
    { id: "ondo-yield-assets", name: "Ondo Yield", now: 2_692_725_371, prior: 2_694_350_725 },
    { id: "paxos-gold", name: "Paxos Gold", now: 2_136_871_166, prior: 2_135_034_776 },
    { id: "centrifuge-protocol", name: "Centrifuge", now: 1_454_522_874, prior: 1_570_896_062 },
    { id: "spiko", name: "Spiko", now: 1_244_474_726, prior: 1_218_576_311 },
    { id: "ethena-usdtb", name: "Ethena USDtb", now: 1_088_088_486, prior: 1_076_610_464 },
    { id: "ondo-global-markets", name: "Ondo Global Markets", now: 1_076_065_284, prior: 1_013_690_663 },
    { id: "anemoy-capital", name: "Anemoy", now: 938_933_491, prior: 1_063_318_054 },
  ],
};

export const perpsFlowMeta = makeFlowMeta(PERPS_FLOW);
export const predictionMarketsFlowMeta = makeFlowMeta(PREDICTION_FLOW);
export const privacyFlowMeta = makeFlowMeta(PRIVACY_FLOW);
export const rwaFlowMeta = makeFlowMeta(RWA_FLOW);
