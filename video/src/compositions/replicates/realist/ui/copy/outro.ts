// ═══════════════════════════════════════════════════════════════
// OUTRO copy — the PnL share-card that flies over the blurred UI.
// The X-logo + "RREALIST" lockup lives in RealistComposition.tsx
// (frame-locked to the measured track in ../data.ts).
// ═══════════════════════════════════════════════════════════════

export const PNL_CARD = {
  token: "Pumpwheel",
  pnl: "+$39.2K",
  rows: [
    { label: "Invested", value: "$877.8" },
    { label: "Position", value: "$40.1K" },
  ],
  handle: "@touched",
  footerLeft: "axiom.trade",
  footerRight: "Save 10% off fees",
  brand: "AXIOM",
  brandSuffix: "Pro",
} as const;

// Measured card motion (minAreaRect track over plates f1678-1876).
// [frame, cx, cy, scale, rotationDeg] — card art is 809×498.
export const CARD_TRACK: [number, number, number, number, number][] = [
  [1678, 1063, 549, 0.2, 9],
  [1686, 991, 543, 0.51, 5],
  [1698, 994, 547, 0.71, 4],
  [1710, 995, 550, 0.82, 4],
  [1722, 995, 551, 0.89, 4],
  [1740, 992, 551, 0.958, 4],
  [1764, 986, 548, 0.999, 4],
  [1788, 981, 557, 1.006, 4],
  [1800, 979, 580, 1.0, 4],
  [1812, 980, 621, 0.986, 4],
  [1824, 979, 684, 0.964, 4],
  [1836, 979, 773, 0.931, 4],
  [1848, 967, 870, 0.884, 4],
  [1860, 967, 970, 0.79, 4],
  [1876, 968, 1110, 0.72, 4],
];

// UI blur ramp under the outro (measured off plates: sharp at f1685,
// fully blurred by ~f1725).
export const BLUR_FROM = 1690;
export const BLUR_FULL = 1725;
export const BLUR_PX = 14;
