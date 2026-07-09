// CRX cut of the netting-growth loop: identical motion grammar, CRX
// brand, our own words. The count-up easing is the reference's measured
// curve; only the maxima change, so any owner-supplied numbers ride the
// same choreography.

import { VALUES_2026, type NetGrowthCopy } from "./data";

// ═══════════════════════════════════════════════════════════════
// EDITABLE — placeholder, owner fills real CRX numbers.
// Everything the loop announces lives in this block.
// ═══════════════════════════════════════════════════════════════
export const CRX_STATS = {
  metricName: "Average daily netted value*", // EDITABLE — placeholder, owner fills real CRX metric
  headlineTop: "CRX growth", // EDITABLE
  headlineBottom: "netted value QoQ", // EDITABLE — quarter-over-quarter frame
  currentQuarter: {
    label: "2026 Q2 average daily:", // EDITABLE — quarter label
    value: 8.4, // EDITABLE — placeholder, owner fills real CRX number
    legend: "Q2 2026 USD millions", // EDITABLE — unit lives here
  },
  priorQuarter: {
    label: "2026 Q1 average daily:", // EDITABLE
    value: 5.3, // EDITABLE — placeholder, owner fills real CRX number
    legend: "Q1 2026 USD millions", // EDITABLE
  },
  growthPct: "+58%", // EDITABLE — derived from the two values; shown nowhere yet, kept for owner cuts
  recordCallouts: ["Bilateral.", "Margined.", "Onchain."] as [string, string, string], // EDITABLE — the three tagline words
  footnote:
    "*Netted value refers to bilateral net payment amounts calculated by CRX", // EDITABLE
  logo: "CRX", // EDITABLE
};
// ═══════════════════════════════════════════════════════════════

// Reference count-up easing (both reference rows share one curve).
const EASE = VALUES_2026.map((v) => v / VALUES_2026[VALUES_2026.length - 1]);
const countTable = (max: number): number[] =>
  EASE.map((e) => Math.round(max * e * 10) / 10);

export const CRX_COLORS = {
  bg: "#0B1020",
  ink: "#F5F5F7",
  label: "#C7CFDC",
  electric: "#2D5BFF",
  steel: "#94A3B8",
  legendElectric: "#5B7CFF",
  legendSteel: "#A5B2C4",
  digitsOnElectric: "#F5F5F7",
  digitsOnSteel: "#0B1020",
  track: "#2A3348",
  footnote: "#9AA7B8",
  divider: "#E8ECF2",
};

export const CRX_COPY: NetGrowthCopy = {
  headlineSerif: CRX_STATS.headlineTop,
  headlineSans: CRX_STATS.headlineBottom,
  subtitle: CRX_STATS.metricName,
  rows: [
    {
      label: CRX_STATS.currentQuarter.label,
      values: countTable(CRX_STATS.currentQuarter.value),
      legendLabel: CRX_STATS.currentQuarter.legend,
      bubble: CRX_COLORS.electric,
      legendText: CRX_COLORS.legendElectric,
      digits: CRX_COLORS.digitsOnElectric,
    },
    {
      label: CRX_STATS.priorQuarter.label,
      values: countTable(CRX_STATS.priorQuarter.value),
      legendLabel: CRX_STATS.priorQuarter.legend,
      bubble: CRX_COLORS.steel,
      legendText: CRX_COLORS.legendSteel,
      digits: CRX_COLORS.digitsOnSteel,
    },
  ],
  footnote: CRX_STATS.footnote,
  logo: CRX_STATS.logo,
  taglineWords: CRX_STATS.recordCallouts,
};
