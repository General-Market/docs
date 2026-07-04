// Measured lattice phase-drift correction for the silk field. The fitted
// SILK_PHASE_X/Y curves track the halftone lattice well early but accumulate a
// slow sub-pixel drift (up to ~+3.5px by mid-late) against the reference. These
// arrays are the per-frame residual shift (background-region cross-correlation
// vs the reference, boundary-hit outliers rejected + smoothed + clipped ±3.5),
// added to the sprite stamp offset so the replica lattice tracks the reference.
// Measured at build time from the source; no source raster is mounted.
export const PHASE_CORR_T = [
  0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95,
  100, 105, 110, 115, 120, 125, 130, 135, 140, 145, 150, 155, 160, 165, 170,
  175, 180, 185, 190, 195, 200, 205, 210, 215, 220, 225, 230, 235, 240, 245,
  250, 255, 260, 265, 270, 275, 280, 285, 289,
];
export const PHASE_CORR_X = [
  -0.24, -0.28, -0.36, -0.44, -0.52, -0.56, -0.64, -0.68, -0.72, -0.8, -0.88,
  -0.92, -0.96, -1.0, -1.04, -0.88, -0.92, -1.16, -1.6, -2.16, -2.94, -3.0,
  -3.0, -3.0, -3.0, -3.0, -3.0, -3.0, -2.04, -1.0, -0.28, 0.72, 1.32, 1.52,
  1.72, 1.92, 1.92, 1.96, 2.04, 2.16, 2.32, 2.36, 2.4, 2.44, 2.44, 2.36, 2.32,
  2.28, 2.24, 2.16, 2.08, 2.0, 1.92, 2.0, 2.28, 2.8, 3.32, 3.5, 3.5,
];
export const PHASE_CORR_Y = [
  -0.8, -0.76, -0.72, -0.68, -0.64, -0.6, -0.64, -0.76, -0.88, -1.0, -1.12,
  -1.16, -1.08, -0.92, -0.68, -0.48, -0.4, -0.36, -0.48, -0.76, -0.92, -0.92,
  -0.92, -0.84, -0.68, -0.64, -0.72, -0.76, -0.8, -0.88, -0.68, -0.28, 0.16,
  0.72, 1.52, 2.0, 2.32, 2.6, 2.8, 2.84, 3.0, 3.2, 3.4, 3.5, 3.5, 3.5, 3.12,
  2.52, 1.8, 0.88, 0.04, -0.8, -1.72, -2.52, -3.0, -3.0, -3.0, -3.0, -3.0,
];
