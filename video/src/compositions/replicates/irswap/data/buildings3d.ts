// Solved 3D constants for the buildings scene (frames 1705-3587).
// Produced by an offline bundle adjustment (fit3d.mjs, scratchpad):
// building corner measurements at f1900/f2500/f2700 + apex tracks P1-P3
// jointly fit rigid buildings AND re-solve the camera path on corrected
// anchor depths (the old path assumed far-apex anchors at front-base
// depth; true 3D buildings exposed the ~12% depth error).
// World: units = ref px at the f2505 datum; floor y=-170; yaw about PIVOT.
// Key values pass a SG(5,2) key-series smoothing (solve jitter removal);
// real moves (resid>6u, ref-verified) + first/last two keys kept exact.

export const FLOOR_Y_3D = -170;
// Shared yaw pivot (xz of the old lender anchor W2) - must match Buildings.tsx.
export const PIVOT_XZ: [number, number] = [-194.415, 63.134];

// Camera key table: [frame, camX, camY, camZ, worldYaw(rad)]
export const CAM_KEYS_3D: [number, number, number, number, number][] = [
  [1725, -58.227, -53.419, 712.895, 0],
  [1740, -71.096, -38.975, 713.172, 0],
  [1755, -41.32, -37.611, 759.559, -0.1849],
  [1770, -37.511, -24.308, 760.406, -0.3323],
  [1785, -41.89, -14.483, 743.899, -0.461],
  [1800, -47.909, -7.292, 729.982, -0.5847],
  [1815, -52.194, -1.275, 717.838, -0.6849],
  [1830, -53.905, 2.381, 714.53, -0.7361],
  [1845, -53.368, 4.278, 717.013, -0.7567],
  [1860, -53.791, 4.147, 715.521, -0.7537],
  [1875, -53.194, 4.406, 711.645, -0.749],
  [1890, -53.798, 4.889, 711.431, -0.7467],
  [1905, -54.373, 4.704, 707.758, -0.7552],
  [1920, -53.354, 5.083, 702.925, -0.7691],
  [1935, -51.845, 5.881, 701.445, -0.7861],
  [1950, -52.047, 7.234, 707.251, -0.7952],
  [1965, -52.129, 8.629, 708.534, -0.8057],
  [1980, -51.708, 8.961, 703.406, -0.8121],
  [1995, -52.535, 8.852, 698.919, -0.8134],
  [2010, -53.271, 9.067, 695.972, -0.815],
  [2025, -52.896, 9.905, 693.3, -0.8193],
  [2040, -52.55, 10.341, 691.649, -0.8283],
  [2055, -53.645, 10.161, 691.963, -0.8391],
  [2070, -53.474, 10.436, 689.177, -0.8465],
  [2085, -52.793, 10.967, 685.675, -0.8567],
  [2100, -51.939, 12.023, 686.213, -0.8697],
  [2115, -51.732, 12.296, 687.888, -0.8867],
  [2130, -51.946, 12.352, 687.131, -0.8956],
  [2145, -53.201, 11.744, 682.089, -0.893],
  [2160, -53.607, 10.96, 676.784, -0.8756],
  [2175, -51.595, 10.921, 675.583, -0.8303],
  [2190, -48.784, 11.723, 681.368, -0.7556],
  [2205, -44.852, 12.571, 687.293, -0.6653],
  [2220, -40.131, 12.672, 695.334, -0.5664],
  [2235, -37.738, 11.963, 705.511, -0.4673],
  [2250, -34.114, 11.855, 724.528, -0.378],
  [2265, -28.211, 12.592, 742.228, -0.3172],
  [2280, -24.994, 11.894, 747.454, -0.2598],
  [2295, -30.652, 4.446, 745.944, -0.1965],
  [2310, -22.889, 10.008, 765.17, -0.1945],
  [2325, -15.034, 10.747, 765.872, -0.1968],
  [2340, -12.075, 8.739, 752.725, -0.1849],
  [2355, -12.561, 6.257, 735.211, -0.1606],
  [2370, -11.373, 5.26, 725.205, -0.1407],
  [2385, -8.259, 5.79, 719.826, -0.121],
  [2400, -4.836, 5.444, 711.168, -0.1032],
  [2415, -4.915, 3.933, 696.985, -0.0758],
  [2430, -5.739, 2.357, 686.12, -0.0489],
  [2445, -6.054, 1.011, 675.218, -0.0248],
  [2460, -4.334, 0.649, 670.282, -0.0119],
  [2475, -2.585, 0.443, 667.029, -0.0026],
  [2490, -0.862, 0.446, 664.52, 0.002],
  [2505, 0.905, -0.342, 661.616, -0.003],
  [2520, 0.43, -1.307, 659.007, -0.004],
  [2535, -0.312, -1.974, 657.715, -0.002],
  [2550, -0.245, -1.716, 658.211, -0.0009],
  [2565, 1.041, -1.441, 660.861, -0.0115],
  [2580, 4.232, -0.413, 663.87, -0.026],
  [2595, 5.107, 0.73, 661.833, -0.0284],
  [2610, 5.306, 1.689, 660.767, -0.0277],
  [2625, 4.103, 1.982, 659.547, -0.0264],
  [2640, 4.314, 2.092, 659.689, -0.0365],
  [2655, 4.531, 1.688, 654.486, -0.0397],
  [2670, 3.477, 1.818, 650.73, -0.0397],
  [2685, 2.577, 3.087, 650.567, -0.0376],
  [2700, 2.301, 3.8, 648.353, -0.0403],
  [2715, 2.158, 3.473, 643.091, -0.0466],
  [2730, 2.656, 3.727, 639.46, -0.0514],
  [2745, 2.171, 4.295, 635.734, -0.0525],
  [2760, 1.333, 4.797, 633.081, -0.0551],
  [2775, 0.378, 5.541, 632.309, -0.0532],
  [2790, -1.296, 6.248, 626.897, -0.0551],
  [2805, 0.311, 6.886, 625.572, -0.0628],
  [2820, 0.39, 7.138, 622.066, -0.0698],
  [2835, -2.286, 7.339, 613.425, -0.0663],
  [2850, -3.665, 8.371, 609.616, -0.0659],
  [2865, -1.892, 9.253, 608.23, -0.0754],
  [2880, -1.087, 9.675, 605.787, -0.0849],
  [2895, -2.885, 9.795, 599.683, -0.088],
  [2910, -5.268, 10.494, 592.405, -0.0831],
  [2925, -4.588, 11.599, 588.399, -0.0877],
  [2940, -4.649, 12.675, 585.363, -0.0923],
  [2955, -6.714, 13.071, 579.469, -0.0948],
  [2970, -7.86, 14.102, 574.812, -0.0952],
  [2985, -7.742, 14.984, 570.33, -0.1005],
  [3000, -9.171, 15.702, 563.178, -0.1008],
  [3015, -9.381, 16.029, 558.458, -0.1075],
  [3030, -9.808, 17.076, 556.882, -0.1111],
  [3045, -12.231, 17.881, 550.842, -0.1084],
  [3060, -13.721, 18.532, 543.706, -0.1057],
  [3075, -16.028, 19.333, 538.654, -0.1051],
  [3090, -15.846, 20.71, 539.694, -0.1145],
  [3105, -12.21, 20.15, 534.916, -0.1332],
  [3120, -7.88, 18.66, 524.411, -0.1389],
  [3135, 13.941, 16.202, 513.97, -0.1481],
  [3150, 15.172, 10.614, 473.273, 0.0348],
  [3165, 27.316, -2.434, 424.712, 0.166],
  [3180, 28.521, -8.923, 390.505, 0.2463],
  [3195, 19.525, -9.783, 373.678, 0.2963],
  [3210, 11.149, -8.848, 366.986, 0.3143],
  [3225, 7.14, -11.127, 363.498, 0.326],
  [3240, 8.021, -13.24, 363.259, 0.3276],
  [3255, 9.467, -10.292, 359.457, 0.3238],
  [3270, 11.738, -7.529, 356.397, 0.3171],
  [3285, 10.961, -7.226, 356.939, 0.3171],
  [3300, 12.44, -6.023, 360.28, 0.3152],
  [3315, 14.665, -7.83, 369.208, 0.3053],
  [3330, 16.98, -9.815, 379.808, 0.2945],
  [3345, 25.865, -15.365, 404.178, 0.2647],
  [3360, 34.565, -20.679, 426.516, 0.236],
  [3375, 38.761, -21.264, 438.265, 0.2204],
  [3390, 41.33, -22.075, 446.363, 0.2088],
  [3405, 40.377, -22.906, 455.32, 0.2076],
  [3420, 41.43, -23.635, 464.49, 0.2013],
  [3435, 40.955, -24.017, 472.507, 0.1986],
  [3450, 43.136, -25.014, 481.16, 0.188],
  [3465, 40.293, -24.715, 485.588, 0.2018],
  [3480, 42.028, -24.934, 491.259, 0.2017],
  [3495, 49.352, -24.617, 491.613, 0.1875],
  [3510, 65.96, -25.936, 500.207, 0.1403],
  [3525, 94.604, -36.226, 545.984, 0.0262],
  [3540, 135.707, -63.612, 639.905, -0.213],
  [3555, 192.247, -99.781, 693.105, -0.311],
];

// Rigid buildings. Local frame: X along the facade (Fb at x=eSign*Wf/2),
// Y up from the floor, depth along sd = sdSign*perp(fd); far apex at
// far = mid + sd*L. theta = atan2(fd.z, fd.x).
export type Building3DDef = {
  mid: [number, number]; // front-facade center, xz (floor)
  theta: number;
  Wf: number; // facade width
  L: number; // depth (ridge length)
  Hw: number; // wall height
  Ha: number; // apex height
  sdSign: 1 | -1;
  eSign: 1 | -1;
};
export const B3D: Record<"lender" | "bank" | "company", Building3DDef> = {
  lender: { mid: [-155.86, 0.631], theta: -1.05, Wf: 108.237, L: 87.172, Hw: 61.28, Ha: 104.462, sdSign: -1, eSign: -1 },
  bank: { mid: [192.351, -83.873], theta: -2.581, Wf: 115.68, L: 47.587, Hw: 65.066, Ha: 104.951, sdSign: 1, eSign: -1 },
  company: { mid: [-58.502, -193.305], theta: -0.451, Wf: 81.397, L: 57.003, Hw: 64.376, Ha: 105.094, sdSign: -1, eSign: -1 },
};

// Plaque world-center corrections (round 5): the legacy plaqueWorld
// unprojection guessed board depths off ground-contact rows; measured
// board centers (boardfind non-CLIP rows + hand-verified crops at
// f1900-f3410) Gauss-Newton-fit a per-board 3D center delta. Each fit
// cross-validates at held-out poses within ~3-7px (company f3410 is the
// reference redrawing the board lower at the D-pose — self-contradiction
// a rigid point cannot satisfy; the fit still moves halfway toward it).
export const PLQ_FIX: Record<"lender" | "company" | "bank", [number, number, number]> = {
  lender: [-9.76, -3.06, -44.52],
  company: [1.5, 12.76, 81.15],
  bank: [-3.68, 18.43, 47.55],
};

// NOTE (round 5, negative A/B — do not retry): keyed D-phase board slides
// toward the text-measured ref board positions at f3410/3450/3510 (the ref
// re-poses/redraws the boards narrower and ~-22deg tilted through the D
// hold) LOST SSIM at all three gates, all-plaques and lender-only alike —
// the silhouette mismatch dominates, and sliding the wide flat board onto
// the ref text center misregisters both border ends. The PLQ_FIX rigid
// world fit is the winner.

// Round 6 revision of the above: the r5 fit measured TEXT centers at 3
// sparse anchors. An edge-pair fit (plqedge.py: angle-swept projection
// histogram finds the two long border edges -> tilt + center + extent,
// self-validating — the attempt-side tilts reproduce the drawn tilts
// exactly) gives clean PER-FRAME tracks for company and bank: the ref
// redraws both boards 6-10 deg steeper than the f2505 pose and their
// center deltas swing from (0,-13) at 3305 through (0,+8..+13) mid-era
// to (+21,-15)/( +9,+3) in the exit whip. Rows below are screen-space
// deltas [frame, du, dv] (ref minus attempt) applied through the pitched
// camera at the board's depth, plus tilt deltas [frame, deg] in the
// canvas tilt convention. Zero at <=3300. LENDER IS EXCLUDED: its board
// clips the frame bottom and merges with the building base ink — the
// edge fit jumps (-5 to -26 deg tilt across 40f); no measurement-grade
// track exists for it (do not apply an invented one).
export const PLQ_D_FIX: Partial<Record<"lender" | "company" | "bank", [number, number, number][]>> = {
  company: [
    [3300, 0, 0], [3315, -3.2, -11.9], [3335, -4.2, -4.9], [3345, -4.3, 2.3],
    [3355, -3.6, 8.1], [3365, -3.6, 11.3], [3385, -4.0, 12.0], [3395, -4.8, 12.3],
    [3405, -4.8, 12.8], [3415, -5.5, 13.3], [3445, -6.5, 13.3], [3455, -6.5, 12.4],
    [3465, -5.5, 11.4], [3485, -4.8, 10.4], [3495, -2.2, 9.3], [3505, -1.2, 9.8],
    [3515, 3.9, 12.6], [3525, 9.4, 3.3],
  ],
  bank: [
    [3300, 0, 0], [3315, -1.2, -11.6], [3335, 0.1, -6.5], [3345, -0.1, -0.7],
    [3355, 0, 4.1], [3365, -1.3, 7.0], [3385, 0.8, 6.9], [3395, 0.7, 6.5],
    [3405, 0.6, 7.9], [3415, 1.6, 8.1], [3445, 2.7, 7.6], [3455, 3.7, 8.2],
    [3465, 2.8, 7.7], [3485, 5.6, 6.1], [3495, 7.0, 3.3], [3505, 11.1, 0.2],
    [3515, 15.8, 0.5], [3525, 21.2, -14.6],
  ],
};
export const PLQ_TILT_FIX: Partial<Record<"lender" | "company" | "bank", [number, number][]>> = {
  company: [[3300, 0], [3315, -10], [3415, -9], [3495, -8], [3525, -6]],
  bank: [[3300, 0], [3315, 6], [3495, 7]],
};

// Facade decor, fractions of Wf (u along Fb->Fo) / Hw (heights above base).
export const B3D_DECOR = {
  lender: {
    fill: "#4CB3CB",
    outline: "rgba(80,96,101,0.95)",
    cols: { n: 5, c0: 0.196, pitch: 0.1565, w: 0.072, fill: "#D3F3FA", top: 0.985, bot: 0.24 },
    strip: { u0: 0.06, u1: 0.945, y0: 0.05, y1: 0.22, fill: "#CDF0F6" },
  },
  bank: {
    fill: "#DF6B77",
    outline: "rgba(104,100,99,0.9)",
    cols: { n: 5, c0: 0.167, pitch: 0.1567, w: 0.066, fill: "#FFFFFF", top: 0.92, bot: 0.21 },
    strip: { u0: 0.055, u1: 0.951, y0: 0.0, y1: 0.19, fill: "#F4F1EF" },
    cornerBand: { w: 5, fill: "rgba(181,114,123,0.85)" },
  },
  company: {
    fill: "#4CB3CB",
    outline: "rgba(85,96,101,0.95)",
    door: { u0: 0.4, u1: 0.575, top: 0.345, fill: "#CCF0F7" },
    chimney: { w: 8.5, top: 96.5, dLat: 27.9, dFr: 1, bottom: 74 },
  },
  roof: { lift: 2, ovE: 3, ovF: 4.5, ovB: 4 },
} as const;

// ── arrow columns: two vertical world planes over the streets ────
// Both planes pass through the company far apex xz; s = in-plane
// horizontal coordinate along dir from that anchor; y = world y.
// Measured mutual angle leftTeal vs rightRed: 99.05 deg (~90 in 3D).
export const PLANE_ANCHOR: [number, number] = [-86.192, -265.585];
export const PLANES = {
  leftTeal: { dir: [-0.409, 0.913] as [number, number], yaw: -1.99196 },
  rightRed: { dir: [-0.837, -0.547] as [number, number], yaw: 2.56274 },
} as const;

// Arrow geometry (in-plane): [tailS, tipS, centerY, thickness, headLen, headHalf]
export const ARR3D = {
  phaseA: { tail: 69.39, tip: 212.33, cy: 42.21, T: 17.2, headLen: 24.1, headHalf: 16.3 },
  leftTeal: { tail: 48.1, tip: 211.42, cy: 44.43, T: 19.8, headLen: 31.97, headHalf: 15.4 },
  rightRed: { tail: -260.16, tip: -113.5, cy: 41.76, T: 18.6, headLen: 28.36, headHalf: 14.6 },
  fixed: { tail: -111.54, tip: -257.93, cy: -6.14, T: 17.5, headLen: 28.11, headHalf: 15.2 },
} as const;

// Label anchors (in-plane s,y) + world font sizes (world units;
// = measured screen size x depth/DCAM at the anchor frame).
// Titles carry a fixed cap-derived world size plus letter-spacing out to
// the measured span (the reference face tracks wider than Titillium) and
// the measured in-plane baseline tilt (rot, radians, canvas frame).
export const LBL3D = {
  // phase A (plane leftTeal, anchors unprojected at the corrected f1900 pose)
  aVbrTitle: { p: [137.99, 127.76], size: 26.4 },
  aVbrValue: { p: [137.99, 89.13], size: 41.7 },
  aLmTitle: { p: [137.99, -14.71], size: 25.35 },
  aLmValue: { p: [129.99, -46.27], size: 38.3 },
  // phase B fixed-rate labels (plane rightRed)
  fixTitle: { p: [-185.33, -48.71], size: 27.57 },
  fixValue: { p: [-182.48, -81.44], size: 32.64 },
  // phase C left column (plane leftTeal)
  cLeftTitle: { p: [121.11, 131.85], size: 23.4, span: 239.7, rot: -0.02304 },
  cLeftValue: { p: [122, 93.5], size: 38.5, rot: 0 },
  // phase B->C right column label (plane rightRed): slides B->C 2585-2660
  cRightTitleB: { p: [-215, 112] },
  cRightTitleC: { p: [-176.16, 125.99], size: 23.5, span: 216.6, rot: 0.01588 },
  cRightValueB: { p: [-218, 74] },
  cRightValueC: { p: [-185.15, 90.44], size: 37, rot: 0.0499 },
} as const;
