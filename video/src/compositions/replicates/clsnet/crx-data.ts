// CRX Netting — the publishable variant. Same choreography as the CLSNet
// replica, CRX story in our own words. Every name, number, and line here.
//
// Mapping: trade submission → RFQ fills through custody wallets;
// netting calculation → bilateral netting with zk-proved margin (zk-SIMM);
// reports/advices → on-chain events (anyone can rebuild the tree);
// settlement → atomic on-chain settlement.
import type { CopyShape } from "./data";

export const CRX_COPY: CopyShape = {
  brand: "CRX",
  tagline: "on-chain FX clearing",
  supporting: "Bilateral netting, proved on-chain:",
  p35: { kicker: "Pillar", num: "01", strip: "zk-proved margin" },
  p50: { kicker: "Pillar", num: "02", strip: "Atomic on-chain\nsettlement" },
  currencies120: "Any G20 pair, one margin rail",
  tradeExecuted: "Fill locked",
  unmatched: "Open",
  matched: "Filled",
  paymentComplete: "Settled atomically",
  disclaimer: "Every state transition is an event.\nAnyone can rebuild the tree.",
  url: "dev.crxfx.com",
  detail: [
    ["Counterparty", "Desk B"],
    ["RFQ Identifier", "0x7E2B-C923-EY6"],
    ["Currency", "USDC"],
    ["Value Date", "2026/07/09"],
    ["Netted Position", "-8, 242, 547"],
  ],
  ganttIds: [
    "RFQ-7E2B-USDCNH-01",
    "RFQ-7E2B-EURPLN-02",
    "RFQ-C923-USDTRY-03",
    "RFQ-C923-EURCZK-04",
    "RFQ-7E2B-USDBRL-05",
    "RFQ-C923-EURHUF-06",
    "RFQ-7E2B-USDINR-07",
    "RFQ-C923-USDMXN-08",
    "RFQ-7E2B-USDKRW-09",
  ],
  gantt2nd: "RFQ-C923-USDTRY-03",
  pairSchedule: [
    { top: "USD", bottom: "CNH", from: 1040 },
    { top: "USD", bottom: "TRY", from: 1140 },
    { top: "EUR", bottom: "PLN", from: 1195 },
    { top: "EUR", bottom: "CZK", from: 1250 },
  ],
  docLabels: ["T+1", "NDF", "Same\nday", "Spot", "Fwd"],
};
