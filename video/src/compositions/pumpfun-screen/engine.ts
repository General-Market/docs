import { Easing, interpolate } from "remotion";
import { buildCamera } from "./camera";
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
 * Find the parabola: the global peak, then walk back to the foot of the run
 * (~1/9 of the peak) and frame the whole flat-base → vertical-blow-off shape.
 * ------------------------------------------------------------------ */
export function chooseParabola(candles: Candle[]): {
  startIdx: number;
  peakIdx: number;
  endIdx: number;
} {
  const lim = Math.floor(candles.length * 0.92);
  let peakIdx = 1;
  for (let i = 1; i < lim; i++) if (candles[i].h > candles[peakIdx].h) peakIdx = i;
  // Frame the WHOLE parabola: a long flat base running far to the left, then
  // the vertical blow-off into the peak near the right edge. End AT the peak
  // so the live edge dwells at the all-time high (no long post-peak decline).
  const startIdx = Math.max(0, peakIdx - 150);
  const endIdx = Math.min(candles.length - 1, peakIdx + 1);
  return { startIdx, peakIdx, endIdx };
}

/* ---- deterministic RNG + nice ladder -------------------------------- */
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
  const n = raw / mag;
  const step = n >= 5 ? 5 : n >= 2.5 ? 2.5 : n >= 2 ? 2 : n >= 1 ? 1 : 0.5;
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

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function fakeTrader(rng: () => number): string {
  const ch = () => B58[Math.floor(rng() * B58.length)];
  return `${ch()}${ch()}${ch()}${ch()}…${ch()}${ch()}${ch()}${ch()}`;
}

/* ------------------------------------------------------------------ */
export function buildTimeline(data: ChartData, cfg: EngineConfig): FrameView[] {
  const { candles, ticks } = data;
  const mp = data.token.mcapPerPrice || 1;
  const { startIdx, peakIdx, endIdx } = chooseParabola(candles);

  // The whole parabola must already be on screen at frame 0. The flat base
  // (startIdx → foot of the blow-off) is present from the start; only the
  // final few candles of the vertical part PRINT in over the first ~40% of
  // the clip, after which the live edge dwells at the peak and chops.
  const H0 = Math.max(startIdx + 1, peakIdx - 6);

  // prefix max-high (mcap) over the slice → dynamic Peak as the blow-off prints
  const prefMaxHigh: number[] = [];
  let run = 0;
  for (let i = startIdx; i <= endIdx; i++) {
    run = Math.max(run, candles[i].h);
    prefMaxHigh[i] = run;
  }

  const launchMcap = candles[startIdx].l * mp;
  const entryIdx = startIdx + 12;
  const entryMcap = candles[entryIdx].l * mp;

  // Fill the plot width: viewCount ≈ slice length + a small right-edge gap, so
  // the whole parabola spans the plot. The camera's parasite zoom only breathes
  // gently around "the whole parabola fits".
  const sliceLen = endIdx - startIdx + 1;
  const rightGap = 6;
  const fitView = sliceLen + rightGap;
  const camera = buildCamera({
    totalFrames: cfg.totalFrames,
    fps: cfg.fps,
    viewCountRange: [fitView * 0.98, fitView * 1.12],
  });

  const rng = lcg(0x9e3779b1);
  const frames: FrameView[] = [];

  // live edge + eased axis state
  let price = candles[H0].o;
  let lastStep = 0;
  let volEnv = 1;
  let formingInt = -1;
  let fHi = price;
  let fLo = price;
  let prevPrice = price;
  let dispMin = candles[startIdx].l * mp;
  let dispMax = candles[H0].h * mp;
  let holders = 1400;

  const headEase = Easing.bezier(0.3, 0, 0.4, 1);

  for (let f = 0; f < cfg.totalFrames; f++) {
    const p = f / (cfg.totalFrames - 1);

    // The whole base is already framed at frame 0; only the final few candles
    // of the blow-off print in over the first ~40%. After that the live edge
    // dwells at endIdx (≈ peak) and just chops. Motion is front-loaded.
    const head =
      p <= 0.4
        ? interpolate(headEase(p / 0.4), [0, 1], [H0, endIdx])
        : endIdx;
    const headInt = Math.min(endIdx, Math.floor(head));
    const frac = head - headInt;

    if (headInt !== formingInt) {
      formingInt = headInt;
      fHi = candles[headInt].o;
      fLo = candles[headInt].o;
    }

    // forming-candle close path + real-trading chop (random walk pulled to it)
    const cand = candles[headInt];
    const trendClose =
      cand.o + (cand.c - cand.o) * Easing.out(Easing.ease)(clamp01(frac));
    const regime = p < 0.4 ? 1 : 0.62;
    volEnv = Math.max(0.45, Math.min(1.9, volEnv + (rng() - 0.5) * 0.5));
    const vol = regime * volEnv;
    let step = (rng() * 2 - 1) * vol * price * 0.0065;
    step -= 0.45 * lastStep; // chop / mean reversion
    if (rng() > 0.945) step *= 3.6; // jumps throw the wicks
    if (rng() < 0.3) step *= 0.14; // stalls
    lastStep = step;
    const pull = 0.1 + 0.12 * regime;
    price = Math.max(cand.l * 0.7, price + step + (trendClose - price) * pull);
    fHi = Math.max(fHi, price);
    fLo = Math.min(fLo, price);

    const liveMcap = price * mp;
    const tickUp = price >= prevPrice;
    prevPrice = price;

    const maxHigh = Math.max(prefMaxHigh[headInt] ?? cand.h, fHi);
    const peakMultiple = (maxHigh * mp) / launchMcap;
    holders += rng() > 0.7 ? 1 : 0;

    // camera — zoomed out to frame the whole parabola; edge near the right
    const { viewCount, godX } = camera[f];
    const viewRight = headInt + frac + godX;

    // visible candles
    const viewCandles: ViewCandle[] = [];
    const lo = Math.max(startIdx, Math.ceil(viewRight - viewCount) - 1);
    let tMin = Infinity;
    let tMax = -Infinity;
    let liveX: number | null = null;
    for (let i = lo; i <= headInt; i++) {
      const x = viewRight - i;
      if (x < -1 || x > viewCount + 1) continue;
      const forming = i === headInt;
      const o = candles[i].o * mp;
      const c = (forming ? price : candles[i].c) * mp;
      const h = (forming ? fHi : candles[i].h) * mp;
      const l = (forming ? fLo : candles[i].l) * mp;
      viewCandles.push({ o, h, l, c, x, forming });
      tMin = Math.min(tMin, l);
      tMax = Math.max(tMax, h);
      if (forming) liveX = x;
    }
    if (!Number.isFinite(tMin)) {
      tMin = fLo * mp;
      tMax = fHi * mp;
    }

    // autoscale: ease toward padded bounds (floor near 0 → "$—")
    const pad = (tMax - tMin) * 0.14 + tMax * 0.001;
    const targetMax = tMax + pad;
    const targetMin = Math.max(0, tMin - pad * 1.4);
    dispMax += (targetMax - dispMax) * 0.12;
    dispMin += (targetMin - dispMin) * 0.12;

    // entry diamond marker (green), anchored at the base
    const entryX = viewRight - entryIdx;
    const entry =
      entryX >= 0 && entryX <= viewCount
        ? { mcap: entryMcap, vx: entryX }
        : null;

    // real trade tape — stream the real recent ticks newest-first
    const tape: TapeRow[] = [];
    if (ticks.length) {
      const headTick = Math.floor(p * (ticks.length - 1));
      const tr = lcg(0x1234 + headTick);
      for (let k = 0; k < 7; k++) {
        const idx = headTick - k;
        if (idx < 0) break;
        const t = ticks[idx];
        tape.push({
          key: `t${idx}`,
          kind: t.kind,
          usd: t.usd,
          mcap: t.price * mp,
          trader: fakeTrader(tr),
          ageSec: k === 0 ? 0 : k,
        });
      }
    }

    // scrolling time ticks
    const xToTime = (vx: number) => {
      const idx = Math.round(viewRight - vx);
      const t = candles[Math.max(0, Math.min(candles.length - 1, idx))].t;
      const d = new Date(t * 1000);
      return `${String(d.getHours()).padStart(2, "0")}:${String(
        d.getMinutes(),
      ).padStart(2, "0")}`;
    };
    const axisTimes = [0.16, 0.5, 0.84].map((r) => ({
      label: xToTime(r * viewCount),
      vx: r * viewCount,
    }));

    frames.push({
      mcap: liveMcap,
      multiple: liveMcap / entryMcap,
      peakMultiple,
      holders,
      scaleMin: dispMin,
      scaleMax: dispMax,
      ladder: buildLadder(dispMin, dispMax),
      candles: viewCandles,
      viewCount,
      liveMcap,
      liveUp: tickUp,
      liveX,
      entry,
      tfLabel: "15s",
      axisTimes,
      tape,
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

export function mcapFull(v: number): string {
  return `$${Math.round(v).toLocaleString("en-US")}`;
}

export function ladderLabel(v: number): string {
  if (v <= 0) return "$—";
  if (v >= 1e6) return `$${(v / 1e6).toFixed(v >= 1e7 ? 0 : 1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}
