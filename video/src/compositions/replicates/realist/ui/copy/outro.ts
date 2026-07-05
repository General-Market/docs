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

// UI blur under the outro — measured law (r4: Laplacian-variance sweep
// of the plates on the rail crop 1520,300–1900,700 inverted through a
// synthetic-Gaussian LUT of the sharp f1652 plate): sharp through
// f1657, fast collapse to σ≈0.9 by f1661, slow creep to σ≈2.1 by
// f1728, hold to the fade-out. CSS blur px ≈ 2σ. The old linear ramp
// (1690→1725, 14px) started 32 frames late and landed ~3× too strong.
// [frame, cssBlurPx] — lerp between rows, clamp outside.
export const BLUR_TABLE: [number, number][] = [
  [1657, 0], [1658, 0.9], [1659, 1.4], [1660, 1.7], [1662, 1.8],
  [1664, 2.1], [1666, 2.4], [1668, 2.7], [1672, 2.9], [1676, 3.0],
  [1680, 3.5], [1690, 5.5], [1700, 7.5], [1710, 9.7], [1720, 11.9],
  [1730, 14],
];
