import { Easing, interpolate } from "remotion";
import type {
  Candle,
  ChartData,
  EngineConfig,
  FrameView,
  TapeRow,
  ViewCandle,
} from "./types";

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/* ------------------------------------------------------------------ *
 * Pick the god candle: the biggest single-candle up-move that is recent
 * and well-traded, sitting on a flat-ish base (so the chart reads flat→boom).
 * ------------------------------------------------------------------ */
export function chooseGodCandle(candles: Candle[]): number {
  const vols = candles.map((c) => c.v).sort((a, b) => a - b);
  const volFloor = vols[Math.floor(vols.length * 0.6)] ?? 0;
  let best = -1;
  let bestScore = 0;
  for (let i = Math.floor(candles.length * 0.5); i < candles.length; i++) {
    const c = candles[i];
    if (c.o <= 0 || c.v < volFloor) continue;
    const gain = c.c / c.o; // close/open
    const range = c.h / Math.max(1e-12, c.l);
    const score = gain * 1.6 + range; // favour a strong close + a tall wick
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best < 0 ? candles.length - 2 : best;
}

/* ------------------------------------------------------------------ *
 * Deterministic RNG + nice ladder.
 * ------------------------------------------------------------------ */
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function niceStep(range: number): number {
  const raw = range / 6;
  const mag = Math.pow(10, Math.floor(Math.log10(Math.max(1, raw))));
  const norm = raw / mag;
  const step = norm >= 5 ? 5 : norm >= 2.5 ? 2.5 : norm >= 2 ? 2 : norm >= 1 ? 1 : 0.5;
  return step * mag;
}

function buildLadder(min: number, max: number): number[] {
  const step = niceStep(max - min);
  if (!Number.isFinite(step) || step <= 0) return [];
  const first = Math.ceil(min / step) * step;
  const out: number[] = [];
  for (let v = first; v <= max + step * 0.001; v += step) out.push(v);
  return out;
}

/* ------------------------------------------------------------------ *
 * Discrete camera — TradingView gestures: hold, dezoom, hold, zoom, hold,
 * one slight side-scroll, settle. Equal consecutive values = a hold.
 * ------------------------------------------------------------------ */
type Key = { t: number; v: number };
const EASE = Easing.bezier(0.4, 0, 0.2, 1);

function keyed(p: number, keys: Key[]): number {
  if (p <= keys[0].t) return keys[0].v;
  for (let i = 1; i < keys.length; i++) {
    if (p <= keys[i].t) {
      const a = keys[i - 1];
      const b = keys[i];
      if (a.v === b.v) return a.v; // hold
      const local = clamp01((p - a.t) / (b.t - a.t));
      return interpolate(EASE(local), [0, 1], [a.v, b.v]);
    }
  }
  return keys[keys.length - 1].v;
}

// visible candle count (zoom). Lower = zoomed in.
const ZOOM: Key[] = [
  { t: 0, v: 30 },
  { t: 0.12, v: 30 },
  { t: 0.24, v: 50 }, // dezoom out
  { t: 0.42, v: 50 },
  { t: 0.54, v: 26 }, // zoom in
  { t: 0.7, v: 26 },
  { t: 0.78, v: 32 }, // tiny breath
  { t: 1, v: 27 },
];
// horizontal nudge in candle-units (one slight side-scroll and back).
const PAN: Key[] = [
  { t: 0, v: 0 },
  { t: 0.6, v: 0 },
  { t: 0.7, v: 7 },
  { t: 0.86, v: 7 },
  { t: 0.95, v: 0 },
  { t: 1, v: 0 },
];

/* ------------------------------------------------------------------ *
 * Real-time god-candle price path: flat base, exponential boom, wick pullback
 * to the real close. No time compression — one candle, formed live.
 * ------------------------------------------------------------------ */
function godPrice(q: number, o: number, h: number, c: number): number {
  if (q < 0.3) {
    return o * (1 + 0.015 * Math.sin(q * 33)); // flat chop around the open
  }
  if (q < 0.85) {
    const r = (q - 0.3) / 0.55;
    const e = Math.pow(r, 2.3); // slow, then vertical — exponential
    return o + (h - o) * e;
  }
  const r = (q - 0.85) / 0.15;
  return h + (c - h) * Easing.out(Easing.ease)(r); // settle to close
}

const fmtTrader = (a: string) =>
  a && a.length > 9 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a || "—";

/* ------------------------------------------------------------------ */
export function buildTimeline(data: ChartData, cfg: EngineConfig): FrameView[] {
  const { candles } = data;
  const mp = data.token.mcapPerPrice || 1;
  const g = cfg.godIdx;
  const god = candles[g];

  // launch = lowest mcap before the god candle; peak = highest reached up to
  // and including it. Both use only past/present data, so Peak ≥ the live top.
  let launchLow = candles[0].l;
  let peakHigh = candles[0].h;
  for (let i = 0; i <= g; i++) {
    launchLow = Math.min(launchLow, candles[i].l);
    peakHigh = Math.max(peakHigh, candles[i].h);
  }
  const launchMcap = launchLow * mp;
  const peakMultiple = (peakHigh * mp) / launchMcap;

  const rng = lcg(0x9e3779b1);
  const traderPool = data.trades.map((t) => t.trader).filter(Boolean);
  let tp = 0;
  const pickTrader = () => {
    const a = traderPool.length
      ? traderPool[(tp = (tp + Math.floor(rng() * 7) + 1) % traderPool.length)]
      : "So1ana";
    return fmtTrader(a);
  };

  const RIGHT_PAD = 3;
  const frames: FrameView[] = [];

  // forming-candle running extents + eased axis state
  let liveHi = god.o;
  let liveLo = god.o;
  let prevPrice = god.o;
  let dispMin = Math.min(god.l, candles[g - 1]?.l ?? god.l) * mp;
  let dispMax = god.o * mp;

  const tape: (TapeRow & { birthFrame: number })[] = [];
  let lastFillFrame = -999;
  let fillSeq = 0;

  for (let f = 0; f < cfg.totalFrames; f++) {
    const p = f / (cfg.totalFrames - 1);

    // live price of the one forming candle (+ small real-time tick jitter)
    const base = godPrice(p, god.o, god.h, god.c);
    const vol = p > 0.3 && p < 0.85 ? 0.02 : 0.006;
    const jitter = 1 + vol * Math.sin(f * 0.9) * (0.5 + rng() * 0.5);
    const price = Math.max(god.l * 0.6, base * jitter);
    liveHi = Math.max(liveHi, price);
    liveLo = Math.min(liveLo, price);
    const liveMcap = price * mp;
    const tickUp = price >= prevPrice;
    prevPrice = price;

    // camera
    const viewCount = keyed(p, ZOOM);
    const pan = keyed(p, PAN);
    const viewRight = g + RIGHT_PAD - pan;

    // visible candles (history static, god candle forming at index g)
    const viewCandles: ViewCandle[] = [];
    const lo = Math.max(0, Math.ceil(viewRight - viewCount) - 1);
    let tMin = Infinity;
    let tMax = -Infinity;
    let liveX: number | null = null;
    for (let i = lo; i <= g; i++) {
      const x = viewRight - i;
      if (x < -0.5 || x > viewCount + 1) continue;
      const forming = i === g;
      const o = candles[i].o * mp;
      const c = (forming ? price : candles[i].c) * mp;
      const h = (forming ? liveHi : candles[i].h) * mp;
      const l = (forming ? liveLo : candles[i].l) * mp;
      viewCandles.push({ o, h, l, c, x, forming });
      tMin = Math.min(tMin, l);
      tMax = Math.max(tMax, h);
      if (forming) liveX = x;
    }
    if (!Number.isFinite(tMin)) {
      tMin = liveLo * mp;
      tMax = liveHi * mp;
    }

    // autoscale: ease toward padded bounds (tight on the base, expands on boom)
    const pad = (tMax - tMin) * 0.16 + tMax * 0.001;
    const targetMax = tMax + pad;
    const targetMin = Math.max(0, tMin - pad * 0.5);
    const k = 0.12;
    dispMax += (targetMax - dispMax) * k;
    dispMin += (targetMin - dispMin) * k;

    // tape: dense during the boom, sparse on the flat
    const booming = p > 0.3 && p < 0.92;
    const fillGap = booming ? 5 + Math.floor(rng() * 6) : 22 + Math.floor(rng() * 18);
    if (f - lastFillFrame >= fillGap) {
      lastFillFrame = f;
      const buy = booming ? rng() > 0.12 : rng() > 0.5;
      const big = rng() > 0.88;
      const usd = (big ? 150 + rng() * 1200 : 6 + rng() * 220) * (booming ? 1.6 : 1);
      tape.unshift({
        key: `f${fillSeq++}`,
        kind: buy ? "buy" : "sell",
        usd,
        mcap: liveMcap,
        trader: pickTrader(),
        ageSec: 0,
        birthFrame: f,
      });
      if (tape.length > 7) tape.pop();
    }
    const rows: TapeRow[] = tape.map((r) => ({
      key: r.key,
      kind: r.kind,
      usd: r.usd,
      mcap: r.mcap,
      trader: r.trader,
      ageSec: Math.round((f - r.birthFrame) / cfg.fps),
    }));

    // scrolling time ticks
    const xToTime = (vx: number) => {
      const idx = Math.round(viewRight - vx);
      const t = candles[Math.max(0, Math.min(candles.length - 1, idx))].t;
      const d = new Date(t * 1000);
      return `${String(d.getHours()).padStart(2, "0")}:${String(
        d.getMinutes(),
      ).padStart(2, "0")}`;
    };
    const axisTimes = [0.15, 0.5, 0.85].map((fr) => ({
      label: xToTime(fr * viewCount),
      vx: fr * viewCount,
    }));

    frames.push({
      mcap: liveMcap,
      multiple: liveMcap / launchMcap,
      peakMultiple,
      scaleMin: dispMin,
      scaleMax: dispMax,
      ladder: buildLadder(dispMin, dispMax),
      candles: viewCandles,
      viewCount,
      liveMcap,
      liveUp: tickUp,
      liveX,
      tfLabel: "1m",
      axisTimes,
      tape: rows,
    });
  }

  return frames;
}

export function mcapLabel(v: number): string {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(v >= 1e7 ? 1 : 2)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(v >= 1e5 ? 0 : 1)}K`;
  return `$${v.toFixed(0)}`;
}

export function ladderLabel(v: number): string {
  if (v >= 1e6) return `$${(v / 1e6).toFixed(v >= 1e7 ? 0 : 1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}
