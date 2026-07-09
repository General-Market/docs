/**
 * fna-loop — measured data for the FNA settlement-frequency chart loop.
 *
 * Reference: public/fna-loop-original.mp4 (1280×720, 25fps, 1125 frames).
 * The video is ONE 375-frame build cycle played 3× identically (SSIM between
 * cycles ≥ 0.9995; frame 374→375 is a hard cut back to empty axes, and frame
 * 1124→0 wraps with exactly the same cut, so the loop is seamless by
 * construction).
 *
 * Every table below is MEASURED per frame off the reference (cv2 column/row
 * scans + crop reads; see .claude/rounds/work/fna-loop/trace*.py). Per-event
 * measured tables beat analytic curves (replicate-method lesson 14) — do not
 * replace them with easings.
 */

export const FPS = 25;
export const CYCLE = 375; // frames per build cycle
export const CYCLES = 3;
export const DURATION = CYCLE * CYCLES; // 1125
export const W = 1280;
export const H = 720;

// ─── Palette (probed off settled frame 300) ───
export interface ChartTheme {
  bg: string;
  navy: string; // connector-line + headline ink
  blue: string;
  slate: string;
  axisLine: string;
  axisText: string;
  circleFill: string;
  circleText: readonly [string, string, string];
  barColors: readonly [string, string, string];
  dotColors: readonly [string, string, string];
  calloutFills: readonly [string, string];
  calloutText: string;
  usdText: string;
  ringColor: string;
  fontFamily: string;
  textWeight: number; // axis labels, titles, regular runs
  boldWeight: number; // counters, amounts, circle + callout text
}

export const FNA_THEME: ChartTheme = {
  bg: "#FDFDFD",
  navy: "#002752", // bar1, dot1, connector line, headline text ink
  blue: "#4CA0D3", // bar2, dot2, callout2
  slate: "#4B6686", // bar3, dot3, callout3
  axisLine: "#6E7276", // 2px gray axis strokes (AA reads 119..154 gray)
  axisText: "#002752",
  circleFill: "#FFFFFF", // knockout circles inside bars
  circleText: ["#002752", "#4CA0D3", "#4B6686"] as const,
  barColors: ["#002752", "#4CA0D3", "#4B6686"] as const,
  dotColors: ["#002752", "#4CA0D3", "#4B6686"] as const,
  calloutFills: ["#4CA0D3", "#4B6686"] as const,
  calloutText: "#FFFFFF",
  usdText: "#FFFFFF",
  ringColor: "#FFFFFF", // dot3's white ring
  fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  textWeight: 300, // the reference face is a Light; 400 renders too much ink
  boldWeight: 500, // and its bold is a Medium
};

// ─── Copy (read off the reference frames, exact strings) ───
export const FNA_COPY = {
  leftLabels: ["250", "200", "150", "100", "50", "0"],
  rightLabels: ["100", "80", "60", "40", "20", "0"],
  ticks: ["1", "2", "3"] as const,
  xTitle: "Settlement frequency",
  leftTitle: "Liquidity needs (USD bn)",
  rightTitle: "Netting efficiency %",
  // per group: the in-bar amount label (regular/bold/regular runs) and the
  // knockout-circle lines
  groups: [
    { usdPre: "USD", usdBold: "178.9", usdPost: " bn", circleLines: ["Baseline"] },
    {
      usdPre: "USD",
      usdBold: "205.7",
      usdPost: " bn",
      circleLines: ["+26.8", "USD bn", "from", "baseline"],
    },
    {
      usdPre: "USD",
      usdBold: "227.2",
      usdPost: " bn",
      circleLines: ["+48.3", "USD bn", "from", "baseline"],
    },
  ],
  callouts: ["-0.6%", "-1.0%"] as const,
  title: null as null | { head: string; sub: string },
};

export type ChartCopy = typeof FNA_COPY;

// ─── Static geometry (settled frame 300, pixel-measured) ───
export const GEOM = {
  baselineY: 576, // x-axis line top edge (2px tall, over the bars)
  axisTopY: 264, // vertical axis lines run 264..578
  leftAxisX: 226.4, // left vertical line (2px)
  rightAxisX: 1067.4,
  axisStroke: 1.9,
  // bars: [x, width, settled top y]
  bars: [
    { x: 296.8, w: 172.9, top: 350 },
    { x: 559.8, w: 172.9, top: 315 },
    { x: 820.8, w: 173.6, top: 288 },
  ],
  barCenters: [383, 646.5, 907.75],
  // efficiency dots: center + radius (settled)
  dots: [
    { cx: 383, cy: 278, r: 15.2 },
    { cx: 646.5, cy: 281.5, r: 14.8 },
    { cx: 909, cy: 286, r: 15.0 },
  ],
  ringOuterR: 16.6, // dot3 white ring (stroke centered at this radius)
  ringStroke: 2.6,
  connectorWidth: 3.2,
  // callout bubbles above bars 2 and 3
  callouts: [
    { cx: 646.5, cy: 120.2, r: 50.7 },
    { cx: 909.5, cy: 120, r: 50.5 },
  ],
  calloutTextCY: 118.5,
  // knockout circles inside bars
  circles: [
    { cx: 383.5, cy: 493, r: 67 },
    { cx: 647, cy: 493, r: 67 },
    { cx: 909, cy: 493, r: 67 },
  ],
  // the 4-line blocks sit slightly above the circle center (measured ink)
  circleTextCY: [493, 490.9, 490.9],
  // % counter labels above the dots (ink center y)
  pctCY: 239.5,
  pctSize: 26,
  // in-bar USD labels (ink centers; revealed by the rising bar edge)
  usd: [
    { cx: 383.5, cy: 394.5 },
    { cx: 646, cy: 356.5 },
    { cx: 902.5, cy: 331.5 },
  ],
  usdSize: 24,
  // axis label columns
  leftLabelRight: 201.6, // right-aligned edge (ink lands at 200)
  rightLabelLeft: 1093, // left-aligned edge
  labelYs: [269, 330.4, 391.8, 453.2, 514.6, 576],
  tickXs: [379.5, 631, 883],
  tickCY: 602,
  xTitleC: { x: 623.5, y: 637.4 },
  leftTitleC: { x: 119, y: 423 }, // rotated -90°
  rightTitleC: { x: 1175, y: 423 }, // rotated -90°
  axisFontSize: 26,
  circleFontSize: 24,
  circleLineHeight: 23.4, // measured line pitch of the 4-line circle blocks
  calloutFontSize: 22,
  // Ink-box scaleX per label kind. The width gap that looked like a foreign
  // face was the WEIGHT: the reference sets axis text in Helvetica Neue Light
  // (300) and its 'bold' is Medium (500). At those weights natural widths
  // match; only tiny residuals and the narrow '%' remain.
  xTitleScaleX: 1,
  leftTitleScaleX: 0.99,
  rightTitleScaleX: 1,
  pctSignScaleX: 0.73, // scaleX on the '%' glyph alone; digits already match
  pctDX: 5.5, // counter ink sits right of the bar center in the ref
};

// ─── Measured per-frame tables (cycle frames) ───
// tab(): clamp-index into a table that starts at `start`.
export const tab = (
  arr: readonly number[],
  start: number,
  f: number,
  before: number = arr[0],
): number => (f < start ? before : arr[Math.min(f - start, arr.length - 1)]);

// Bar top y per frame (scan-up column trace; before start the bar is absent).
export const BAR_TOPS: { start: number; v: readonly number[] }[] = [
  {
    start: 20,
    v: [574, 570, 566, 561, 555, 548, 541, 533, 524, 514, 505, 495, 484, 474,
      463, 453, 442, 432, 422, 412, 403, 394, 385, 378, 371, 365, 360, 356,
      353, 351, 350],
  },
  {
    start: 120,
    v: [574, 571, 566, 561, 555, 548, 540, 531, 522, 512, 502, 491, 480, 469,
      457, 446, 434, 423, 411, 400, 390, 379, 370, 360, 352, 344, 336, 330,
      325, 321, 318, 316, 315],
  },
  {
    start: 227,
    v: [574, 571, 566, 560, 553, 545, 536, 527, 517, 506, 494, 482, 470, 458,
      445, 432, 420, 407, 394, 382, 370, 359, 348, 338, 328, 319, 311, 305,
      299, 294, 290, 288],
  },
];

// Netting-efficiency counters (read frame-by-frame off label crops).
export const COUNTERS: { start: number; v: readonly number[] }[] = [
  {
    start: 18,
    v: [0.0, 0.1, 0.2, 0.6, 1.0, 1.7, 2.6, 3.7, 5.2, 7.0, 9.3, 12.2, 16.0,
      20.9, 27.5, 36.5, 47.9, 59.3, 68.3, 74.9, 79.8, 83.6, 86.5, 88.8, 90.6,
      92.1, 93.2, 94.1, 94.8, 95.2, 95.6, 95.7, 95.8],
  },
  {
    start: 118,
    v: [0.0, 0.1, 0.2, 0.5, 0.9, 1.5, 2.2, 3.2, 4.4, 6.0, 7.9, 10.2, 13.2,
      16.9, 21.8, 28.3, 36.9, 47.6, 58.3, 66.9, 73.4, 78.3, 82.0, 85.0, 87.3,
      89.2, 90.8, 92.0, 93.0, 93.7, 94.3, 94.7, 95.0, 95.1, 95.2],
  },
  {
    start: 225,
    v: [0.0, 0.1, 0.2, 0.5, 0.9, 1.5, 2.2, 3.2, 4.4, 5.9, 7.8, 10.2, 13.1,
      16.9, 21.7, 28.1, 36.7, 47.4, 58.1, 66.7, 73.1, 77.9, 81.7, 84.6, 87.0,
      88.9, 90.4, 91.6, 92.6, 93.3, 93.9, 94.3, 94.6, 94.7, 94.8],
  },
];

// Dot scale-in: measured diameter / settled diameter.
const dotScale = (d: readonly number[], final: number) => d.map((x) => x / final);
export const DOT_SCALES: { start: number; v: readonly number[] }[] = [
  {
    start: 23,
    v: dotScale(
      [2, 3, 4, 5, 6, 8, 9, 10, 12, 12, 14, 16, 17, 18, 20, 22, 22, 24, 25,
        26, 27, 28, 29, 30, 30, 30, 31],
      31,
    ),
  },
  {
    start: 125,
    v: dotScale(
      [2, 3, 5, 5, 7, 7, 9, 11, 11, 13, 15, 16, 17, 19, 20, 21, 22, 23, 25,
        25, 27, 27, 28, 29, 29, 29, 30],
      30,
    ),
  },
  {
    start: 229,
    v: dotScale(
      [1, 1, 3, 3, 5, 5, 7, 7, 9, 9, 11, 13, 13, 15, 17, 17, 19, 21, 21, 23,
        25, 25, 27, 27, 29, 29],
      29,
    ),
  },
];

// Knockout-circle scale-in (white-chord width at the center row / settled).
const norm = (v: readonly number[]) => {
  const m = v[v.length - 1];
  return v.map((x) => Math.min(1, x / m));
};
export const CIRCLE_SCALES: { start: number; v: readonly number[] }[] = [
  { start: 36, v: norm([2, 4, 7, 15, 24, 35, 45, 48, 55, 58, 58, 59, 61, 61]) },
  {
    start: 135,
    v: norm([1, 3, 6, 13, 28, 41, 62, 86, 101, 109, 117, 121, 124, 127, 128,
      128, 130]),
  },
  {
    start: 243,
    v: norm([2, 7, 11, 26, 43, 64, 85, 100, 110, 117, 121, 124, 127, 127, 128,
      129]),
  },
];

// Callout bubble scale-in (chord width at the center row / settled).
export const CALLOUT_SCALES: { start: number; v: readonly number[] }[] = [
  {
    start: 121,
    v: norm([2, 4, 6, 8, 12, 14, 18, 22, 24, 29, 30, 34, 36, 37, 39, 43, 46,
      50, 54, 55, 57, 62, 64, 65, 67, 73, 73, 74, 75, 75, 76, 78]),
  },
  {
    start: 227,
    v: norm([1, 3, 5, 7, 9, 11, 15, 18, 22, 25, 30, 32, 36, 39, 42, 46, 48,
      51, 55, 58, 62, 65, 67, 68, 71, 74, 78, 79, 80, 81, 81, 81]),
  },
];

// Connector segments, drawn left→right (dark-ink mass / settled mass).
export const SEG_FRACS: { start: number; v: readonly number[] }[] = [
  {
    start: 127,
    v: norm([13, 27, 43, 66, 92, 118, 148, 178, 208, 233, 260, 289, 324, 354,
      396, 439, 484, 522, 555, 591, 627, 666, 702, 741, 763, 775]),
  },
  {
    start: 229,
    v: norm([20, 44, 71, 99, 123, 150, 178, 216, 255, 296, 339, 372, 407, 452,
      499, 541, 575, 609, 647, 687, 724, 752, 777]),
  },
];

// Callout text fade-in alphas (white-pixel mass rise, normalized).
export const CALLOUT_TEXT_ALPHAS: { start: number; v: readonly number[] }[] = [
  { start: 142, v: [0, 0.14, 0.3, 0.5, 0.57, 0.73, 0.76, 0.87, 0.93, 1, 1] },
  {
    start: 248,
    v: [0, 0.05, 0.2, 0.25, 0.4, 0.5, 0.65, 0.72, 0.8, 0.87, 0.95, 1],
  },
];

// Dot3 white ring fade (appears as bar3 reaches the dot).
export const RING_ALPHA = { start: 253, v: [0, 0.2, 0.4, 0.6, 0.8, 1] };
