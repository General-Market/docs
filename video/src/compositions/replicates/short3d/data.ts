// ═══════════════════════════════════════════════════════════════
// short3d replica — world data, camera path, event timings.
// All numbers measured from the reference (see agent report):
// support-bar tracks at 10fps + 30fps fast windows, digitized
// candle frames (t0, t2.5, t3.5, t7.5, t10.5, t25, t30.5, t32.4),
// landmark anchors (dome apex, breakout circle, target line).
// World units: 1 unit = 1 candle pitch. Support-zone top edge = y 0.
// Screen mapping: px-per-unit p ↔ camera z = F_PX / p.
// ═══════════════════════════════════════════════════════════════

export const FPS = 60;
export const DURATION = 1962;
export const W = 1080;
export const H = 1920;

// Vertical FOV chosen so focal length in px matches measured
// pixel-per-unit ↔ zoom ratios: f = (H/2)/tan(vfov/2) = 3044.7px.
export const VFOV = 35.02;
export const F_PX = 3044.7;

// ─── Palette (sampled from native frames) ───
export const COL = {
  bg: "#14181f",
  bgGrid: "#171c26",
  grid: "#3c4356",
  candleRed: "#ef1830",
  candleRedBright: "#fe1b32",
  candleTeal: "#0fae90",
  candleTealBright: "#0cbda0",
  barBorder: "#3f9e14",
  barBorderBright: "#4cbd18",
  barHatchBg: "#12200d",
  barHatchLine: "#1d3a12",
  purple: "#9316f0",
  purpleGlow: "#8a10e8",
  domeFillTop: "#7a2fbf",
  domeFillBot: "#8a7a3a",
  orange: "#f07514",
  orangeDeep: "#e85f04",
  yellow: "#f5b90d",
  redLine: "#e01020",
  white: "#ffffff",
} as const;

// ─── Support bar ───
export const BAR = {
  x0: 0,
  x1: 240,
  top: 0,
  thickness: 4.72, // measured 109-110px at pitch ~23.2 across frames
  border: 0.55,
};

// Bar right-edge growth (draws left→right during the opening).
export const BAR_GROWTH: [number, number][] = [
  // [frame, right edge in world x]
  [0, 11.3],
  [30, 14],
  [60, 21],
  [90, 45],
  [108, 62],
  [132, 240],
];

// ─── Candles ───
// Segment anchor rows: [idx, close]. Piecewise-linear between anchors,
// then per-candle deterministic detail. Measured against digitized frames.
const ENVELOPE: [number, number][] = [
  // opening wiggle (t0 view)
  [0, 5.8], [2, 7.2], [4, 8.0], [6, 7.4], [8, 6.0], [10, 6.6], [12, 8.2], [14, 8.8],
  // rally 1 (t0.4-0.7)
  [16, 13], [18, 22], [20, 30], [22, 35],
  // decline to V1 (t0.7-1.05)
  [24, 30], [26, 22], [28, 12], [30, 3.5], [31, 1.2],
  // rally 2 to +20 (t1.05-1.25)
  [33, 6], [35, 12], [37, 17], [39, 19.8], [40, 19.2],
  // long decline to V-touch (t1.3-2.05)
  [42, 17], [44, 14], [46, 11], [48, 8], [50, 4.5], [52, 0.6],
  // burst rally into the high band (t2.05-2.2)
  [53, 5], [54, 12], [55, 19], [56, 25], [57, 29], [58, 31.5], [60, 32.5],
  // high consolidation band, W-wiggles, drifting down at the end
  [63, 34.5], [66, 30.5], [69, 28], [72, 31], [75, 34], [78, 32.5], [81, 29],
  [84, 27.5], [87, 30], [90, 33], [93, 31], [95, 26], [97, 23], [99, 20.5],
  // dive to cup start (t3.3-3.45)
  [101, 15], [103, 8.5], [105, 3], [106, 0.7],
  // cup left wall (steep at base, rounding into apex 148)
  [108, 4], [110, 9], [112, 14], [114, 18.5], [116, 22.5], [118, 26], [120, 29],
  [122, 31.5], [124, 33.6], [126, 35.4], [128, 36.9], [130, 38.1], [133, 39.6],
  [136, 40.7], [139, 41.4], [142, 41.85], [145, 42.05], [148, 42.15],
  // dome right side, wigglier, back to support
  [151, 41.9], [154, 41.4], [157, 40.6], [160, 39.5], [163, 38.1], [166, 36.4],
  [169, 34.3], [172, 31.8], [175, 28.9], [178, 25.5], [181, 21.4], [183, 17.8],
  [185, 13.2], [187, 8.0], [189, 3.0], [190, 0.5],
  // handle: rising channel zigzag (t6.1-6.9)
  [191, 2.2], [192, 4.6], [193, 7.0], [194, 9.5], [195, 8.0], [196, 10.5],
  [197, 13.0], [198, 15.5], [199, 13.8], [200, 16.0], [201, 15.0],
  // handle decline (drawn later, t9.6-10.4)
  [202, 12.2], [203, 8.4], [204, 4.4], [205, 0.6],
  // breakout pierce (t12.3)
  [206, -2.4],
  // the fall (t28.5-31.4)
  [207, -5.2], [208, -8.6], [209, -12.2], [210, -15.6], [211, -19.2], [212, -22.4],
  [213, -18.6], [214, -16.2], [215, -20.4], [216, -24.6], [217, -28.6], [218, -32.4],
  [219, -35.6], [220, -38.6], [221, -41.0], [222, -42.3],
  // settle: green recovery candles rising along the target line
  [223, -40.4], [224, -39.6], [225, -38.9], [226, -39.4], [227, -38.6],
];

export const N_CANDLES = 228;

// Deterministic per-candle detail (mulberry32) — wick lengths + noise.
function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Candle = {
  i: number;
  o: number;
  c: number;
  h: number;
  l: number;
  up: boolean;
  spawn: number; // comp frame at which this candle starts growing
  grow: number; // frames to reach final shape
};

function envClose(i: number): number {
  for (let k = 0; k < ENVELOPE.length - 1; k++) {
    const [i0, v0] = ENVELOPE[k];
    const [i1, v1] = ENVELOPE[k + 1];
    if (i >= i0 && i <= i1) return v0 + ((v1 - v0) * (i - i0)) / (i1 - i0);
  }
  return ENVELOPE[ENVELOPE.length - 1][1];
}

// Spawn schedule: [idxFrom, idxTo, tFrom, tTo] (seconds, reference clock).
// Bursts are real — measured against the 0.5s stills.
const SPAWN: [number, number, number, number][] = [
  [15, 22, 0.35, 0.7],
  [23, 31, 0.7, 1.05],
  [32, 40, 1.05, 1.28],
  [41, 52, 1.3, 2.05],
  [53, 99, 2.02, 2.75],
  [100, 106, 3.28, 3.46],
  [107, 148, 3.46, 4.6],
  [149, 190, 4.6, 5.35],
  [191, 201, 5.45, 6.25],
  [202, 204, 9.6, 10.35],
  [205, 205, 10.4, 10.6],
  [206, 206, 12.15, 12.4],
  [207, 212, 28.55, 29.85],
  [213, 214, 29.85, 30.15],
  [215, 222, 30.15, 31.15],
  [223, 227, 31.25, 32.2],
];

export function buildCandles(): Candle[] {
  const rng = mulberry32(1337);
  const out: Candle[] = [];
  for (let i = 0; i < N_CANDLES; i++) {
    const c = envClose(i);
    const prev = i === 0 ? c + (rng() - 0.5) * 1.4 : envClose(i - 1);
    // fatten thin bodies — reference bodies run 0.8-2.5u even in consolidations
    const minBody = 0.85 + rng() * 0.8;
    const delta = c - prev;
    const o = Math.abs(delta) >= minBody ? prev : c - Math.sign(delta || (rng() > 0.5 ? 1 : -1)) * minBody;
    const up = c >= o;
    const body = Math.abs(c - o);
    const wickTop = 0.35 + rng() * (0.5 + body * 0.35);
    const wickBot = 0.35 + rng() * (0.5 + body * 0.35);
    const h = Math.max(o, c) + wickTop;
    const l = Math.min(o, c) - wickBot;
    let spawn = -10;
    let grow = 8;
    for (const [i0, i1, t0, t1] of SPAWN) {
      if (i >= i0 && i <= i1) {
        const f0 = t0 * FPS;
        const f1 = t1 * FPS;
        spawn = f0 + ((f1 - f0) * (i - i0)) / Math.max(1, i1 - i0);
        grow = Math.min(12, Math.max(3, ((f1 - f0) / (i1 - i0 + 1)) * 1.6));
        break;
      }
    }
    out.push({ i, o, c, h, l, up, spawn, grow });
  }
  return out;
}

export const CANDLES = buildCandles();

// Landmarks
export const CUP_START = 106;
export const APEX = 148;
export const CUP_END = 190;
export const BREAKOUT_X = 205;
export const DOME_H = 42.15;
export const TARGET_Y = -DOME_H; // measured equal within error
export const STOP_Y = 16.8;
export const HANDLE_TOP = 201;

// ─── Dome arc (purple) ───
// Smooth arc over the cup, ~2u above closes at the apex, anchored at
// (CUP_START,0) and (CUP_END,0). Asymmetric-capable via cubic hermite.
export function arcY(x: number): number {
  const t = (x - CUP_START) / (CUP_END - CUP_START);
  if (t < 0 || t > 1) return 0;
  // half-sine raised to 0.85 → slightly flattened top like reference
  return (DOME_H + 2.2) * Math.pow(Math.sin(Math.PI * t), 0.85);
}

export function arcPoints(n = 140): [number, number][] {
  const pts: [number, number][] = [];
  for (let k = 0; k <= n; k++) {
    const x = CUP_START + ((CUP_END - CUP_START) * k) / n;
    pts.push([x, arcY(x)]);
  }
  return pts;
}

// Arc draw-on: measured from 30fps window + 0.5s stills.
// Left wall follows the rally upward (t3.95→4.8 up to apex), then
// chases the decline down the right wall (t4.8→6.25).
export const ARC_DRAW = { tStart: 3.95, tApex: 4.8, tEnd: 6.25 };

// ─── Handle channel (purple, straight) ───
export const CHANNEL = {
  lower: { x0: CUP_END - 0.5, y0: -0.6, x1: CUP_END + 12.2, y1: 14.2 },
  upper: { x0: CUP_END + 1.2, y0: 5.4, x1: CUP_END + 13.6, y1: 20.2 },
  drawLower: { t0: 6.25, t1: 6.75 },
  drawUpper: { t0: 6.65, t1: 7.05 },
};

// ─── White dashed trace path ───
// Sharp zigzag through candle pivots (reference traces swing highs/lows,
// not the smooth envelope), then the forecast zigzag to target (t25 frame).
export function dashPathPoints(): [number, number][] {
  const pts: [number, number][] = [];
  const rng = mulberry32(77);
  let k = 0;
  for (let i = CUP_START; i <= BREAKOUT_X; i += 3) {
    const up = k % 2 === 0;
    const amp = 1.2 + rng() * 1.3;
    pts.push([i, envClose(i) + (up ? amp : -amp * 0.7) + 0.5]);
    k++;
  }
  pts.push([BREAKOUT_X + 0.6, -1.8]);
  pts.push([BREAKOUT_X + 9.5, -24.4]);
  pts.push([BREAKOUT_X + 13.2, -16.5]);
  pts.push([BREAKOUT_X + 21.7, -42.4]);
  return pts;
}

// Dash draw schedule: [t, worldX up to which the path is drawn].
// From dashtip tracking (10fps).
export const DASH_SCHEDULE: [number, number][] = [
  [7.3, CUP_START + 0.1],
  [7.75, CUP_START + 6],
  [8.5, APEX - 10],
  [8.95, APEX],
  [9.3, APEX + 7],
  [9.8, CUP_END],
  [10.1, CUP_END + 11],
  [10.9, BREAKOUT_X - 2],
  [11.3, BREAKOUT_X + 0.6],
  [19.35, BREAKOUT_X + 0.6],
  [19.9, BREAKOUT_X + 9.5],
  [20.15, BREAKOUT_X + 13.2],
  [21.2, BREAKOUT_X + 21.7],
];

// ─── Measures ───
export const MEASURE_DOME = {
  x: APEX,
  yTop: DOME_H + 2.2,
  yBot: 0,
  t0: 13.55,
  t1: 14.9,
};
// measured counter: ~44% at t14 → gentle ease-out (power 1.5)
export function measureEase(t: number): number {
  return 1 - Math.pow(1 - clamp01(t), 1.5);
}
export const MEASURE_DROP = {
  x: BREAKOUT_X + 0.6,
  yTop: 0,
  yBot: TARGET_Y,
  t0: 15.85,
  t1: 17.0,
};

// ─── Lines ───
export const TARGET_LINE = {
  y: TARGET_Y,
  x0: BREAKOUT_X - 12,
  x1: BREAKOUT_X + 41,
  t0: 17.3,
  t1: 18.5,
};
export const STOP_LINE = {
  y: STOP_Y,
  x0: BREAKOUT_X - 3,
  x1: BREAKOUT_X + 41,
  t0: 22.6,
  t1: 23.6,
};

// ─── Labels ───
export const LABELS = {
  // "SUPPORT ZONE" repeats along the bar (~55u pitch), typed once at
  // t2.35-3.15 and persistent — sightings at t2.5/7/9.5/14/24.5/25 all fit.
  supportZone: [33, 88, 143, 198, 253].map((x) => ({
    x,
    typeT0: 2.35,
    typeT1: 3.15,
  })),
  target: { x: BREAKOUT_X + 18, y: TARGET_Y - 3.4, t0: 20.75, t1: 21.35 },
  stopLoss: { x: BREAKOUT_X + 8.5, y: STOP_Y + 1.7, t0: 23.55, t1: 24.05 },
};

export const PILL = {
  // world-anchored at breakout point; circle pops first, pill slides out
  cx: BREAKOUT_X + 0.4,
  cy: 0.3,
  circleR: 2.1,
  pillX0: BREAKOUT_X + 3.6,
  pillW: 13.8,
  pillH: 4.4,
  pillCy: 1.5,
  tCircle: 11.25,
  tPill: 11.55,
};

// ─── Card & hand overlay (2D) ───
export const CARD = {
  // native px rect measured: x 161-919, y 426-1489 (static once landed)
  x: 161, y: 426, w: 758, h: 1063,
  tIn0: 25.05, tIn1: 25.5,
  tOut0: 28.35, tOut1: 28.75,
};

// Pen-tip track (native px, from 10fps diff matting), t = frame/10 - 0.1
export const HAND_TRACK: [number, number, number][] = [
  // [t, tipX, tipY]
  [25.7, 1005, 1590],
  [25.9, 610, 1400],
  [26.0, 330, 1195],
  [26.1, 285, 1180],
  [26.3, 375, 1090],
  [26.5, 475, 1055],
  [26.7, 645, 1140],
  [26.9, 735, 1195],
  [27.1, 795, 1145],
  [27.3, 845, 1195],
  [27.5, 865, 1245],
  [27.7, 885, 1290],
  [27.9, 950, 1330],
  [28.1, 950, 1360],
  [28.3, 925, 1380],
];

// ─── Camera keyframes ───
// [frame, worldX, worldY, pxPerUnit, rollDeg]
// From bar tracks (y, zoom, roll) + landmark x-anchors. Roll sign:
// positive = reference bar sloping down-left (slope>0 in tracks).
export const CAM_KF: [number, number, number, number, number][] = [
  [0, 10.4, -2.07, 43.5, 0],
  [30, 21.0, -2.44, 32.8, 0],
  [45, 25.0, -2.4, 27.5, 0],
  [60, 34.0, -2.33, 24.0, 0],
  [75, 68.0, -2.3, 24.5, 0],
  [90, 68.0, -2.26, 24.8, 0.7],
  [105, 66.0, -2.3, 24.5, 0.5],
  [120, 64.0, -2.41, 23.2, 0.2],
  [135, 72.0, -3.6, 22.5, 1.8],
  [150, 78.0, -2.6, 23.2, 2.0],
  [165, 84.0, -2.6, 23.2, 2.0],
  [180, 90.0, -2.8, 23.2, 2.0],
  [195, 97.0, -2.8, 22.8, 1.0],
  [203, 112.0, -3.5, 22.5, 0.3],
  [210, 127.5, -2.51, 22.3, -0.4],
  [225, 131.0, -1.5, 22.3, 0],
  [240, 134.0, 3.0, 21.9, 0.8],
  [270, 146.0, 36.3, 21.9, 5.8],
  [300, 155.0, 22.0, 22.5, 3.0],
  [330, 176.0, 7.93, 23.2, -0.5],
  [360, 184.0, 0.53, 22.7, -0.1],
  [396, 178.0, 17.3, 23.2, -5.6],
  [408, 172.0, 15.8, 23.2, -3.1],
  [414, 166.0, 14.0, 23.2, -1.9],
  [420, 154.0, 10.4, 23.2, -1.2],
  [426, 137.0, 6.1, 23.2, -0.7],
  [432, 122.0, 3.6, 23.2, -0.3],
  [438, 112.0, 1.7, 23.2, 0],
  [444, 107.5, 0.03, 23.2, 0],
  [452, 106.5, 0.4, 23.2, 0],
  [458, 108.0, 1.5, 23.2, 0.3],
  [466, 112.0, 5.0, 23.2, 1.2],
  [480, 121.0, 16.5, 22.7, 3.2],
  [510, 135.0, 35.8, 22.7, 4.0],
  [540, 161.0, 35.2, 22.7, 0.9],
  [555, 168.0, 20.0, 23.0, 0.3],
  [570, 171.0, 7.1, 23.2, -0.3],
  [600, 192.0, -0.47, 23.2, 0],
  [630, 197.7, -0.43, 23.2, 0],
  [660, 198.2, -0.5, 23.2, 0],
  [690, 198.8, -0.5, 23.2, 0],
  [720, 206.0, 0.95, 21.1, -0.75],
  [750, 212.9, 1.72, 19.8, -0.9],
  [780, 178.0, 16.0, 20.0, 0],
  [810, 156.0, 27.0, 18.5, 0],
  [840, 148.0, 18.2, 19.0, 0],
  [870, 148.0, 9.0, 20.0, 0],
  [900, 148.5, 0.5, 21.8, 0],
  [930, 211.0, 2.0, 25.1, 3.0],
  [960, 208.0, -14.9, 23.2, 3.0],
  [990, 209.0, -37.3, 21.9, -2.5],
  [1020, 210.0, -41.0, 21.9, -3.0],
  [1050, 216.0, -41.0, 22.0, -3.2],
  [1080, 226.0, -41.0, 22.0, -3.4],
  [1110, 227.0, -37.5, 22.0, -3.0],
  [1140, 216.0, -2.0, 21.1, 2.0],
  [1170, 220.0, -18.4, 22.4, -1.0],
  [1200, 221.0, -26.0, 22.4, 0],
  [1230, 222.0, -32.0, 22.4, 0],
  [1260, 223.5, -38.0, 22.4, 0],
  [1290, 224.0, -42.5, 23.2, 0],
  [1320, 224.0, 16.8, 21.1, 2.5],
  [1350, 226.0, 15.5, 22.7, -2.5],
  [1380, 227.5, 16.5, 24.0, -2.0],
  [1410, 224.0, 16.4, 23.2, -3.0],
  [1440, 223.5, 16.3, 23.2, -3.0],
  [1466, 218.0, 11.2, 21.9, 0],
  [1472, 204.0, 9.7, 19.8, 0],
  [1476, 197.0, 8.1, 16.8, 0],
  [1480, 189.0, 6.0, 13.9, 0],
  [1484, 184.0, 3.3, 11.4, 0],
  [1488, 181.2, 0.45, 8.8, 0],
  [1494, 181.0, -1.9, 8.0, 0],
  [1704, 181.0, -1.9, 8.0, 0],
  [1730, 193.0, 3.0, 11.0, 0],
  [1760, 207.0, 10.0, 18.0, 0],
  [1770, 209.5, 14.3, 25.0, 3.7],
  [1800, 211.0, -0.5, 24.8, 4.4],
  [1830, 214.0, -26.4, 27.0, -3.0],
  [1860, 217.5, -37.0, 28.5, 0],
  [1890, 219.0, -42.0, 30.0, 0],
  [1930, 219.8, -41.5, 30.0, 0],
  [1962, 220.0, -41.6, 30.0, 0],
];

// ─── Monotone cubic (Fritsch–Carlson) over irregular keyframes ───
function monotoneSlopes(xs: number[], ys: number[]): number[] {
  const n = xs.length;
  const d: number[] = [];
  const m: number[] = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) {
    m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  }
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
    } else {
      const a = m[i] / d[i];
      const b = m[i + 1] / d[i];
      const s = a * a + b * b;
      if (s > 9) {
        const t = 3 / Math.sqrt(s);
        m[i] = t * a * d[i];
        m[i + 1] = t * b * d[i];
      }
    }
  }
  return m;
}

export function makeSpline(xs: number[], ys: number[]) {
  const ms = monotoneSlopes(xs, ys);
  return (x: number): number => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[xs.length - 1]) return ys[ys.length - 1];
    let i = 0;
    while (i < xs.length - 2 && x > xs[i + 1]) i++;
    const hSeg = xs[i + 1] - xs[i];
    const t = (x - xs[i]) / hSeg;
    const t2 = t * t;
    const t3 = t2 * t;
    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;
    return h00 * ys[i] + h10 * hSeg * ms[i] + h01 * ys[i + 1] + h11 * hSeg * ms[i + 1];
  };
}

const kfF = CAM_KF.map((k) => k[0]);
const splX = makeSpline(kfF, CAM_KF.map((k) => k[1]));
const splY = makeSpline(kfF, CAM_KF.map((k) => k[2]));
const splLogP = makeSpline(kfF, CAM_KF.map((k) => Math.log(k[3])));
const splRoll = makeSpline(kfF, CAM_KF.map((k) => k[4]));

export type CamPose = { x: number; y: number; z: number; p: number; roll: number };

export function camAt(frame: number): CamPose {
  const p = Math.exp(splLogP(frame));
  return {
    x: splX(frame),
    y: splY(frame),
    z: F_PX / p,
    p,
    roll: (splRoll(frame) * Math.PI) / 180,
  };
}

// linear interp over [t,v] tables (time in seconds)
export function lerpTable(table: [number, number][], t: number): number {
  if (t <= table[0][0]) return table[0][1];
  for (let i = 0; i < table.length - 1; i++) {
    const [t0, v0] = table[i];
    const [t1, v1] = table[i + 1];
    if (t >= t0 && t <= t1) return v0 + ((v1 - v0) * (t - t0)) / (t1 - t0);
  }
  return table[table.length - 1][1];
}

export function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// Grid plane: measured parallax → plane ~388u behind chart, cell ~46.6u
export const GRID = { z: -388, cellX: 46.6, cellY: 40.0 };
