// Impressions → trading-volume scatter, plotted on log axes so a positive
// power-law relationship reads as a straight, direct line. Points are in
// normalized plot space (0 = left/bottom, 1 = right/top). Hand-authored to
// rise cleanly with a little scatter — deterministic, no RNG at render time.
export const POINTS: ReadonlyArray<readonly [number, number]> = [
  [0.03, 0.10],
  [0.09, 0.18],
  [0.14, 0.12],
  [0.19, 0.25],
  [0.25, 0.20],
  [0.31, 0.31],
  [0.37, 0.27],
  [0.43, 0.40],
  [0.50, 0.45],
  [0.56, 0.41],
  [0.62, 0.53],
  [0.69, 0.59],
  [0.75, 0.55],
  [0.82, 0.69],
  [0.89, 0.75],
  [0.96, 0.87],
];

// Best-fit line endpoints (normalized) — the orange line that draws on.
export const FIT_FROM: readonly [number, number] = [0.0, 0.11];
export const FIT_TO: readonly [number, number] = [1.0, 0.86];

// Axis ticks (normalized position → label)
export const X_TICKS: ReadonlyArray<readonly [number, string]> = [
  [0.0, "10K"],
  [0.33, "100K"],
  [0.66, "1M"],
  [1.0, "10M"],
];
export const Y_TICKS: ReadonlyArray<readonly [number, string]> = [
  [0.0, "$1M"],
  [0.33, "$10M"],
  [0.66, "$100M"],
  [1.0, "$1B"],
];
