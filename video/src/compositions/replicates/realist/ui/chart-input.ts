// ═══════════════════════════════════════════════════════════════════
// CHART INPUT — the data-first contract for the live chart lane.
// (r5, owner reframe: "something like TradingView that makes sense
//  rather than good SSIM; real-graph feeling when moving; can take as
//  input a real graph.")
//
// ── THE FORMAT ──────────────────────────────────────────────────────
// A dataset is an OHLC series plus optional trade markers and strategy
// lines. The engine consumes ONLY this format; swapping in any real
// market's candles is a data change (add a dataset below, point
// ACTIVE_DATASET at it) — zero code changes.
//
//   OhlcBar     { time?, open, high, low, close, volume?, ticks? }
//     time      unix seconds. Optional — bars are index-paced; when
//               present it only labels the time axis (secondsPerBar /
//               startClock are used otherwise).
//     volume    accepted for real-feed compatibility, not rendered
//               (the reference chart has no volume pane).
//     ticks     optional intra-bar close path (a real feed's trade
//               prints). When absent the forming candle wanders on a
//               DETERMINISTIC seeded path (hash-PRNG per bar index —
//               never Math.random) that respects the bar's true
//               O/H/L/C: opens at open, touches the exact high and
//               low, ends at close.
//
//   TradeMarker { at, price?, slotX?, side?, emoji?, color?, r?, ttl? }
//     at        bar-units time (float bar index) when the marker pops.
//     price     y anchor (defaults to the close of bar floor(at)).
//     slotX     horizontal position in bar units (defaults to `at`) —
//               lets markers rain in columns beside the candles.
//     side      "buy" | "sell" — default glyph (B/S) and color (g/r).
//     ttl       frames the marker stays on screen (default: forever).
//
//   PriceLineSpec { label, values: [barUnits, price][], color,
//                   badgeBg, badgeText?, dashW?, gap? }
//               dashed strategy line + right-scale badge; the price
//               steps through `values` as the session advances.
//
// Playback/presentation hints (ALL optional, ALL data):
//   startFrame/endFrame   video frames the live session runs between
//   preloadedBars         bars that already exist when the chart loads
//   barStartFrames        measured per-bar pacing (uniform if absent)
//   barSpacingPx          pitch between bar centers
//   liveEdgeX             pinned x of the forming candle (autoscroll
//                         slides history left underneath it)
//   secondsPerBar/startClock   market clock for the time axis
//   emptyRange            price range shown before the session starts
//   sessionLowSeed/HighSeed    pre-history extremes for the Low/High chips
//   seed                  wander seed
//
// ── THE DEFAULT DATASET ─────────────────────────────────────────────
// "pumpwheel" is a pure DATA CONVERSION of the measured reference:
// bars + real tick paths from the OCR'd OHLC readout (chart-timeline
// .ts — the price-TRUE source; the pixel candle tables in chart-data
// .ts are era-inconsistent), 4 launch bars reconstructed from the
// pre-load history (Low chip: launched at 2.56K), 2 dump/bounce tail
// bars read off plates f1630 (204K red, wicks to ~30K) / f1652 (278K
// green), markers converted from the 718 measured bubble tracks, and
// the measured exit/cost strategy lines. Same story: pump, chop, dump.
// ═══════════════════════════════════════════════════════════════════

import {
  CANDLE_ANCHOR,
  CANDLE_PITCH,
  BUBBLE_TRACKS,
  CHIP_EXIT,
  CHIP_COST,
} from "./chart-data";
import { eraMapAt, EXIT_LABEL, COST_LABEL, CHART_COLORS } from "./copy/chart";

export type OhlcBar = {
  time?: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  ticks?: number[];
};

export type MarkerColor = "g" | "r" | "y" | "w" | "p";

export type TradeMarker = {
  at: number;
  price?: number;
  slotX?: number;
  side?: "buy" | "sell";
  emoji?: string;
  label?: string;
  color?: MarkerColor;
  r?: number;
  ttl?: number;
};

export type PriceLineSpec = {
  label: string;
  values: [number, number][];
  color: string;
  labelColor?: string; // right-edge label ink (defaults to color)
  badgeBg: string;
  badgeText?: string;
  dashW?: number;
  gap?: number;
};

export type ChartDataset = {
  id: string;
  bars: OhlcBar[];
  markers?: TradeMarker[];
  lines?: PriceLineSpec[];
  startFrame?: number;
  endFrame?: number;
  preloadedBars?: number;
  barStartFrames?: number[];
  barSpacingPx?: number;
  liveEdgeX?: number;
  secondsPerBar?: number;
  startClock?: string;
  emptyRange?: [number, number];
  sessionLowSeed?: number;
  sessionHighSeed?: number;
  seed?: number;
};

// ── deterministic PRNG (hash-seeded, render-safe) ───────────────────
const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// ── tick-path builder ───────────────────────────────────────────────
// path[0] = open, path[last] = close, max(path) = high, min(path) = low.
// Real ticks are used when the bar carries them; otherwise a seeded
// wander. Exact H/L touches are inserted at seeded interior positions.
const pathCache = new Map<string, number[]>();
const tickPathOf = (ds: ChartDataset, i: number): number[] => {
  const key = `${ds.id}:${i}`;
  const hit = pathCache.get(key);
  if (hit) return hit;
  const b = ds.bars[i];
  const rng = mulberry32(((ds.seed ?? 7) * 2654435761 + i * 40503 + 1013904223) >>> 0);
  let path: number[];
  if (b.ticks && b.ticks.length > 0) {
    path = [b.open, ...b.ticks, b.close];
  } else {
    const M = 9;
    path = [b.open];
    for (let k = 1; k < M; k++) {
      const base = b.open + ((b.close - b.open) * k) / M;
      const v = base + (rng() - 0.5) * 2 * (b.high - b.low) * 0.4;
      path.push(Math.min(b.high, Math.max(b.low, v)));
    }
    path.push(b.close);
  }
  if (Math.max(...path) < b.high) {
    const at = 1 + Math.floor(rng() * (path.length - 1));
    path.splice(at, 0, b.high);
  }
  if (Math.min(...path) > b.low) {
    const at = 1 + Math.floor(rng() * (path.length - 1));
    path.splice(at, 0, b.low);
  }
  pathCache.set(key, path);
  return path;
};

// ── playback derivation ─────────────────────────────────────────────
const START_DEFAULT = 460;
const END_DEFAULT = 1656;

export const playbackOf = (ds: ChartDataset) => {
  const start = ds.startFrame ?? START_DEFAULT;
  const end = ds.endFrame ?? END_DEFAULT;
  const pre = ds.preloadedBars ?? 0;
  const live = ds.bars.length - pre;
  return { start, end, pre, live };
};

// continuous bars-formed count at a video frame: 0 before the session
// loads; pre..bars.length while live bars form (piecewise through the
// measured barStartFrames when present, uniform otherwise).
export const barsFormedAt = (ds: ChartDataset, frame: number): number => {
  const { start, end, pre, live } = playbackOf(ds);
  const f = Math.min(frame, end);
  if (f < start) return 0;
  if (live <= 0) return ds.bars.length;
  const starts = ds.barStartFrames;
  if (starts && starts.length === live) {
    for (let i = live - 1; i >= 0; i--) {
      if (f >= starts[i]) {
        const next = i + 1 < live ? starts[i + 1] : end;
        const u = next > starts[i] ? Math.min(1, (f - starts[i]) / (next - starts[i])) : 1;
        return Math.min(pre + i + u, ds.bars.length);
      }
    }
    return pre;
  }
  const fpb = (end - start) / live;
  return Math.min(pre + (f - start) / fpb, ds.bars.length);
};

// inverse: video frame at which bar-units time t is reached
export const frameOfBarUnits = (ds: ChartDataset, t: number): number => {
  const { start, end, pre, live } = playbackOf(ds);
  if (t <= pre) return start;
  if (t >= ds.bars.length) return end;
  const starts = ds.barStartFrames;
  const i = Math.floor(t - pre);
  const u = t - pre - i;
  if (starts && starts.length === live) {
    const s = starts[Math.min(i, live - 1)];
    const next = i + 1 < live ? starts[i + 1] : end;
    return s + u * (next - s);
  }
  const fpb = (end - start) / live;
  return start + (t - pre) * fpb;
};

export type RenderBar = {
  open: number;
  high: number;
  low: number;
  close: number;
  green: boolean;
};

export type BarState = {
  barsFormed: number;
  bars: RenderBar[]; // printed: completed prefix + forming partial (last)
  formingIndex: number | null;
  sessionHigh: number;
  sessionLow: number;
};

export const barStateAt = (ds: ChartDataset, frame: number): BarState => {
  const bf = barsFormedAt(ds, frame);
  const seedHigh = ds.sessionHighSeed ?? -Infinity;
  const seedLow = ds.sessionLowSeed ?? Infinity;
  if (bf <= 0) {
    return { barsFormed: 0, bars: [], formingIndex: null, sessionHigh: seedHigh, sessionLow: seedLow };
  }
  const n = ds.bars.length;
  const full = Math.min(Math.floor(bf), n);
  const out: RenderBar[] = [];
  let hi = seedHigh;
  let lo = seedLow;
  for (let i = 0; i < full; i++) {
    const b = ds.bars[i];
    out.push({ open: b.open, high: b.high, low: b.low, close: b.close, green: b.close >= b.open });
    hi = Math.max(hi, b.high);
    lo = Math.min(lo, b.low);
  }
  let formingIndex: number | null = null;
  if (full < n) {
    formingIndex = full;
    const u = bf - full;
    const path = tickPathOf(ds, full);
    const pos = u * (path.length - 1);
    const idx = Math.min(Math.floor(pos), path.length - 2);
    const frac = pos - idx;
    const cNow = path[idx] + (path[idx + 1] - path[idx]) * frac;
    let hNow = cNow;
    let lNow = cNow;
    for (let k = 0; k <= idx; k++) {
      hNow = Math.max(hNow, path[k]);
      lNow = Math.min(lNow, path[k]);
    }
    const open = ds.bars[full].open;
    out.push({ open, high: hNow, low: lNow, close: cNow, green: cNow >= open });
    hi = Math.max(hi, hNow);
    lo = Math.min(lo, lNow);
  }
  return { barsFormed: bf, bars: out, formingIndex, sessionHigh: hi, sessionLow: lo };
};

// per-frame autoscale over the printed data (the real live-TV grammar:
// the scale expands as new extremes print — era rescales emerge from
// the data instead of being replayed).
export const rangeAt = (ds: ChartDataset, frame: number): { min: number; max: number } => {
  const st = barStateAt(ds, frame);
  if (st.bars.length === 0) {
    const [lo, hi] = ds.emptyRange ?? [0, 1];
    return { min: lo, max: hi };
  }
  let hi = -Infinity;
  let lo = Infinity;
  for (const b of st.bars) {
    hi = Math.max(hi, b.high);
    lo = Math.min(lo, b.low);
  }
  const span = Math.max(hi - lo, Math.abs(hi) * 0.02, 1e-9);
  const pad = span * 0.07;
  return { min: lo - pad, max: hi + pad };
};

// strategy-line price at a bar-units time (step-hold; null before row 0)
export const linePriceAt = (spec: PriceLineSpec, barUnits: number): number | null => {
  if (spec.values.length === 0 || barUnits < spec.values[0][0]) return null;
  let v = spec.values[0][1];
  for (const [t, p] of spec.values) {
    if (t <= barUnits) v = p;
    else break;
  }
  return v;
};

// ── formatting (compact TradingView-style, 3 significant figures) ───
export const fmtCompact = (v: number): string => {
  if (v === 0) return "0";
  const sig3 = (x: number) => (x >= 100 ? `${Math.round(x)}` : x >= 10 ? `${x.toFixed(1)}` : `${x.toFixed(2)}`);
  const a = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (a >= 1e6) return `${sign}${sig3(a / 1e6)}M`;
  if (a >= 1e3) return `${sign}${sig3(a / 1e3)}K`;
  return `${sign}${sig3(a)}`;
};

// nice grid step for a price span: {1, 2, 2.5, 5}·10^n, ~18-24 lines
// (dense TradingView-style scale; the reference runs 25K rows ≈ 31px)
export const niceStep = (span: number): number => {
  const target = span / 22;
  const mag = 10 ** Math.floor(Math.log10(Math.max(target, 1e-12)));
  for (const m of [1, 2, 2.5, 5, 10]) {
    if (m * mag >= target) return m * mag;
  }
  return 10 * mag;
};

// time-axis tick interval (seconds) so labels sit ≥68px apart
const TICK_SECONDS = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 14400];
export const timeTickSeconds = (ds: ChartDataset): number => {
  const pitch = ds.barSpacingPx ?? CANDLE_PITCH;
  const spb = ds.secondsPerBar ?? 1;
  for (const t of TICK_SECONDS) {
    if ((t / spb) * pitch >= 68) return t;
  }
  return TICK_SECONDS[TICK_SECONDS.length - 1];
};

export const startClockSec = (ds: ChartDataset): number => {
  const [h, m, s] = (ds.startClock ?? "15:03:00").split(":").map(Number);
  return h * 3600 + m * 60 + (s ?? 0);
};

export const fmtClock = (sec: number): string => {
  const t = ((Math.round(sec) % 86400) + 86400) % 86400;
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const p = (x: number) => `${x}`.padStart(2, "0");
  return s === 0 ? `${p(h)}:${p(m)}` : `${p(h)}:${p(m)}:${p(s)}`;
};

// ═══════════════════════════════════════════════════════════════════
// DEFAULT DATASET — "pumpwheel" (converted measured reference)
// ═══════════════════════════════════════════════════════════════════

// 4 launch bars: pre-load history reconstruction (token launched at
// 2.56K — the Low chip — and the first readout bar opens at 230K).
const LAUNCH_BARS: OhlcBar[] = [
  { open: 2560, high: 34200, low: 2560, close: 30000 },
  { open: 30000, high: 96000, low: 26000, close: 88000 },
  { open: 88000, high: 158000, low: 74000, close: 152000 },
  { open: 152000, high: 236000, low: 141000, close: 230000 },
];

// 26 bars from OHLC_TIMELINE (o-change segmentation; gen script in
// .claude/rounds/work/r5/chartlive/gen-default-dataset.ts). `ticks`
// are the REAL readout close prints inside each bar.
const READOUT_BARS: OhlcBar[] = [
  { open: 230000, high: 358000, low: 217000, close: 358000, ticks: [253000, 280000, 357000] }, // f460
  { open: 364000, high: 377000, low: 154000, close: 154000, ticks: [367000, 346000, 241000] }, // f500
  { open: 154000, high: 348000, low: 154000, close: 322000 }, // f575
  { open: 126000, high: 127000, low: 96900, close: 98400 }, // f598
  { open: 97200, high: 138000, low: 90700, close: 138000, ticks: [106000] }, // f658
  { open: 226000, high: 339000, low: 177000, close: 319000, ticks: [202000, 189000] }, // f700
  { open: 455000, high: 455000, low: 294000, close: 294000, ticks: [412000, 426000, 405000, 392000, 362000, 380000, 357000, 356000] }, // f744
  { open: 268000, high: 425000, low: 268000, close: 397000, ticks: [290000, 291000, 284000, 308000, 425000, 396000, 406000] }, // f791
  { open: 397000, high: 443000, low: 311000, close: 359000, ticks: [351000, 339000, 388000, 424000, 376000, 372000, 334000, 321000] }, // f833
  { open: 376000, high: 379000, low: 268000, close: 297000, ticks: [343000, 330000, 330000, 325000, 277000, 311000] }, // f874
  { open: 289000, high: 360000, low: 209000, close: 247000, ticks: [315000, 246000, 216000, 232000] }, // f917
  { open: 254000, high: 300000, low: 206000, close: 216000, ticks: [260000, 256000] }, // f958
  { open: 216000, high: 337000, low: 215000, close: 306000, ticks: [286000, 309000, 321000, 299000] }, // f994
  { open: 306000, high: 414000, low: 306000, close: 366000, ticks: [382000, 396000, 397000] }, // f1040
  { open: 365000, high: 509000, low: 355000, close: 453000, ticks: [368000, 376000, 382000, 394000] }, // f1058
  { open: 453000, high: 493000, low: 373000, close: 397000, ticks: [458000, 459000, 467000, 493000, 392000, 402000] }, // f1130
  { open: 397000, high: 459000, low: 363000, close: 427000, ticks: [382000, 385000, 382000, 383000, 393000, 392000] }, // f1178
  { open: 427000, high: 477000, low: 310000, close: 344000, ticks: [454000, 390000] }, // f1230
  { open: 344000, high: 354000, low: 263000, close: 284000, ticks: [307000, 312000, 318000] }, // f1251
  { open: 292000, high: 342000, low: 292000, close: 335000, ticks: [303000, 324000, 297000, 325000] }, // f1279
  { open: 370000, high: 397000, low: 261000, close: 277000, ticks: [352000, 356000, 283000, 264000] }, // f1337
  { open: 277000, high: 312000, low: 241000, close: 242000, ticks: [302000, 300000, 287000, 296000, 281000, 269000] }, // f1390
  { open: 242000, high: 295000, low: 220000, close: 220000, ticks: [246000, 268000, 278000, 265000, 250000, 241000, 226000] }, // f1433
  { open: 220000, high: 247000, low: 192000, close: 212000, ticks: [233000, 223000, 220000, 207000, 235000, 243000, 220000, 206000] }, // f1481
  { open: 212000, high: 222000, low: 173000, close: 177000, ticks: [205000, 207000, 209000, 181000, 182000] }, // f1519
  { open: 171000, high: 210000, low: 134000, close: 209000, ticks: [167000, 166000, 161000, 160000, 178000] }, // f1558
];

// dump + bounce tail (plate-read: f1630 chip 204K red with wicks to
// ~30K; f1652 chip 278K green)
const TAIL_BARS: OhlcBar[] = [
  { open: 209000, high: 212000, low: 30000, close: 204000, ticks: [176000, 92000, 41000, 30000, 68000, 155000, 198000] }, // f1592 dump
  { open: 204000, high: 280000, low: 128000, close: 278000, ticks: [152000, 128000, 187000, 241000] }, // f1634 bounce
];

// live-bar pacing: readout group starts + the two tail bars
const PUMPWHEEL_BAR_STARTS = [
  460, 500, 575, 598, 658, 700, 744, 791, 833, 874, 917, 958, 994, 1040, 1058, 1130, 1178, 1230,
  1251, 1279, 1337, 1390, 1433, 1481, 1519, 1558, 1592, 1634,
];

const PUMPWHEEL_BARS: OhlcBar[] = [...LAUNCH_BARS, ...READOUT_BARS, ...TAIL_BARS];

// ── markers: the 718 measured bubble tracks, converted ──────────────
// birth x → slotX via the measured pan anchor; y (at birth+15f,
// settled after the pop) → price via the era map at that frame;
// pop time = birth frame → bar-units via the pacing above.
const lerpPairs = (k: number[], f: number): number => {
  if (f <= k[0]) return k[1];
  for (let i = 0; i + 3 < k.length; i += 2) {
    if (f >= k[i] && f <= k[i + 2]) {
      const t = k[i + 2] === k[i] ? 0 : (f - k[i]) / (k[i + 2] - k[i]);
      return k[i + 1] + (k[i + 3] - k[i + 1]) * t;
    }
  }
  return k[k.length - 1];
};

const lerpTriples = (k: number[], f: number): [number, number] => {
  if (f <= k[0]) return [k[1], k[2]];
  for (let i = 0; i + 5 < k.length; i += 3) {
    if (f >= k[i] && f <= k[i + 3]) {
      const t = k[i + 3] === k[i] ? 0 : (f - k[i]) / (k[i + 3] - k[i]);
      return [k[i + 1] + (k[i + 4] - k[i + 1]) * t, k[i + 2] + (k[i + 5] - k[i + 2]) * t];
    }
  }
  return [k[k.length - 2], k[k.length - 1]];
};

const buildPumpwheelMarkers = (pacing: ChartDataset): TradeMarker[] => {
  const out: TradeMarker[] = [];
  for (const t of BUBBLE_TRACKS) {
    const f0 = t.k[0];
    const fLast = t.k[t.k.length - 3];
    const anchor = lerpPairs(CANDLE_ANCHOR, f0);
    const slotX = (t.k[1] - anchor) / CANDLE_PITCH;
    const fSettle = Math.min(f0 + 15, fLast);
    const [, y] = lerpTriples(t.k, fSettle);
    const { A, K } = eraMapAt(fSettle);
    const price = ((A - y) / K) * 1000; // era map is in thousands
    out.push({
      at: barsFormedAt(pacing, f0),
      slotX,
      price,
      emoji: t.g,
      color: t.c,
      r: t.r,
      ttl: Math.max(fLast - f0, 20),
    });
  }
  return out;
};

// ── strategy lines: measured exit/cost tracks → [barUnits, price] ───
const buildLineRows = (pairs: number[], pacing: ChartDataset): [number, number][] => {
  const rows: [number, number][] = [];
  for (let i = 0; i + 1 < pairs.length; i += 2) {
    const f = pairs[i];
    const y = pairs[i + 1];
    const { A, K } = eraMapAt(f);
    rows.push([barsFormedAt(pacing, f), ((A - y) / K) * 1000]);
  }
  return rows;
};

const pumpwheelBase: ChartDataset = {
  id: "pumpwheel",
  bars: PUMPWHEEL_BARS,
  startFrame: 460,
  endFrame: 1656,
  preloadedBars: LAUNCH_BARS.length,
  barStartFrames: PUMPWHEEL_BAR_STARTS,
  barSpacingPx: CANDLE_PITCH,
  liveEdgeX: 840,
  secondsPerBar: 1,
  startClock: "15:03:00",
  emptyRange: [-2000, 36000],
  sessionLowSeed: 2560,
  sessionHighSeed: 34200,
  seed: 7,
};

const DATASET_PUMPWHEEL: ChartDataset = {
  ...pumpwheelBase,
  markers: buildPumpwheelMarkers(pumpwheelBase),
  lines: [
    {
      label: EXIT_LABEL,
      values: buildLineRows(CHIP_EXIT, pumpwheelBase),
      color: CHART_COLORS.exitLine,
      labelColor: "#c9535e",
      badgeBg: CHART_COLORS.exitBadgeBg,
      dashW: 14,
      gap: 10,
    },
    {
      label: COST_LABEL,
      values: buildLineRows(CHIP_COST, pumpwheelBase),
      color: CHART_COLORS.costLine,
      labelColor: "#dfe4ee",
      badgeBg: CHART_COLORS.costBadgeBg,
      badgeText: CHART_COLORS.costBadgeText,
      dashW: 9,
      gap: 7,
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════
// REGISTRY — add datasets here; switching is a data change.
// ═══════════════════════════════════════════════════════════════════
export const DATASETS: Record<string, ChartDataset> = {
  pumpwheel: DATASET_PUMPWHEEL,
};

export const ACTIVE_DATASET = "pumpwheel";

export const activeDataset = (): ChartDataset => DATASETS[ACTIVE_DATASET];
