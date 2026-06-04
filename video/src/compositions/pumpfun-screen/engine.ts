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
  const { startIdx, peakIdx } = chooseParabola(candles);

  // PLAY the blow-off. The base (startIdx → bloffStart) is settled from frame 0;
  // the live edge climbs the vertical part (bloffStart → peakIdx) across the
  // clip, then dwells at the peak and chops. The all-time high is reached
  // DURING the clip — so Peak ticks up and the live price ends at the ATH.
  const bloffStart = Math.max(startIdx + 1, peakIdx - 34);

  const launchMcap = candles[startIdx].l * mp;
  const entryIdx = startIdx + 12;
  const entryMcap = candles[entryIdx].l * mp;

  // Auto-fit zoom: viewCount tracks the revealed span (startIdx → live edge)
  // plus a small right gap, clamped to a sane minimum. This frames base→edge at
  // all times (no empty left, no over-zoom) and gently zooms OUT as the spike
  // rises — Axiom auto-zoom. We IGNORE the camera's viewCount and use only its
  // godX for a small parasite nudge of the right edge.
  const RIGHT_GAP = 6;
  const MIN_VIEW = 70;
  const camera = buildCamera({
    totalFrames: cfg.totalFrames,
    fps: cfg.fps,
  });

  const rng = lcg(0x9e3779b1);
  const frames: FrameView[] = [];

  // Sampling pool of realistic non-whale USD trade sizes, drawn from the real
  // ticks (clamped to $5–$400); whales are generated separately. Fallback fills
  // the pool if the data is thin.
  const tickUsdPool = ticks
    .map((t) => t.usd)
    .filter((u) => u >= 5 && u <= 400);
  if (tickUsdPool.length < 8)
    for (let i = 0; i < 16; i++) tickUsdPool.push(5 + (i * 24.7) % 395);

  // live edge + eased axis state
  let price = candles[bloffStart].o;
  let lastStep = 0;
  let volEnv = 1;
  let formingInt = -1;
  let fHi = price;
  let fLo = price;
  let prevPrice = price;
  let runPeakHigh = price;
  let dispMin = candles[startIdx].l * mp;
  let dispMax = candles[bloffStart].h * mp;
  let holders = 1400;

    // The live edge climbs the vertical part (bloffStart → peakIdx) over
  // p∈[0,CLIMB_END], lively but NOT front-loaded (a gentle ease-in-out so the
  // ATH is reached near the end of the climb window, ~frame 820), then dwells
  // at the peak and chops for the rest. Motion is immediate from frame 1.
  const headEase = Easing.bezier(0.45, 0.05, 0.55, 1);
  const CLIMB_END = 0.86; // p at which the live edge reaches the peak

  // The live edge follows a MONOTONE rising envelope, geometric (log-space)
  // from the foot of the blow-off to the all-time high. This is what makes the
  // current multiple climb smoothly to ≈ peak instead of retracing along each
  // real candle's close. The settled real candles keep their true OHLC.
  const envFoot = candles[bloffStart].o;
  const envPeak = candles[peakIdx].h;
  const logFoot = Math.log(envFoot);
  const logSpan = Math.log(envPeak) - logFoot;

  for (let f = 0; f < cfg.totalFrames; f++) {
    const p = f / (cfg.totalFrames - 1);

    const head =
      p <= CLIMB_END
        ? interpolate(headEase(p / CLIMB_END), [0, 1], [bloffStart, peakIdx])
        : peakIdx;
    const headInt = Math.min(peakIdx, Math.floor(head));
    const frac = head - headInt;
    const dwelling = headInt >= peakIdx;

    if (headInt !== formingInt) {
      formingInt = headInt;
      fHi = candles[headInt].o;
      fLo = candles[headInt].o;
    }

    // Climb progress 0→1 across the whole blow-off (continuous, not per-candle).
    const cp = clamp01((headInt + frac - bloffStart) / (peakIdx - bloffStart));
    // Forming-candle target = the rising envelope at cp, capped at the ATH.
    const cand = candles[headInt];
    const trendClose = dwelling
      ? envPeak
      : Math.exp(logFoot + logSpan * cp);
    const regime = p < CLIMB_END ? 1 : 0.62;
    volEnv = Math.max(0.45, Math.min(1.9, volEnv + (rng() - 0.5) * 0.5));
    const vol = regime * volEnv;
    let step = (rng() * 2 - 1) * vol * price * 0.0065;
    step -= 0.45 * lastStep; // chop / mean reversion
    if (rng() > 0.945) step *= 3.6; // jumps throw the wicks
    if (rng() < 0.3) step *= 0.14; // stalls
    lastStep = step;
    // During the dwell, pull hard toward the ATH and floor the chop just under
    // it, so the live edge sits at the top (live ≈ peak). While climbing, a
    // gentler pull lets the random walk breathe along the real path.
    const pull = dwelling ? 0.32 : 0.1 + 0.12 * regime;
    const floor = dwelling ? cand.h * 0.965 : cand.l * 0.7;
    price = Math.max(floor, price + step + (trendClose - price) * pull);
    if (dwelling) price = Math.min(price, cand.h); // never overshoot the ATH
    fHi = Math.max(fHi, price);
    fLo = Math.min(fLo, price);

    const liveMcap = price * mp;
    const tickUp = price >= prevPrice;
    prevPrice = price;

    // Peak = running ATH of the live edge as it climbs. Gated to the smooth
    // rising envelope so the real data's early wick-spikes (a 10.48 wick at
    // candle ~480, before the true 11.43 peak) don't make Peak jump ahead and
    // then freeze — it ticks up continuously to the ATH near the end.
    runPeakHigh = Math.max(runPeakHigh, fHi);
    const peakMultiple = (runPeakHigh * mp) / launchMcap;
    holders += rng() > 0.7 ? 1 : 0;

    // Auto-fit zoom: frame startIdx → live edge + gap, growing as the pump
    // extends. Ignore camera.viewCount; use only godX for a small right nudge.
    const { godX } = camera[f];
    const viewCount = Math.max(MIN_VIEW, headInt - startIdx + RIGHT_GAP);
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

    // synthetic PUMP tape — reads like a coin running, not the real post-pump
    // sells. Deterministic (seeded LCG keyed to a slow tape cursor): ~78% buys,
    // mcap tracks the live price (±1.5% jitter), fast ages (mostly 0), realistic
    // USD spread with occasional whales. Newest row first, ageSec=0.
    const tape: TapeRow[] = [];
    const tapeCursor = Math.floor(p * 240); // advances ~ once per tape "trade"
    for (let k = 0; k < 7; k++) {
      const tr = lcg(0xa11ce + (tapeCursor - k) * 0x100193);
      const isBuy = tr() < 0.78;
      const jitter = 1 + (tr() * 2 - 1) * 0.015; // ±1.5%
      const whale = tr() > 0.9;
      let usd: number;
      if (whale) usd = 1000 + tr() * 3000; // $1k–$4k whale
      else if (tickUsdPool.length)
        usd = tickUsdPool[Math.floor(tr() * tickUsdPool.length)];
      else usd = 5 + tr() * 395;
      // ages: newest few rows 0, then a few 1/2 — fast tape
      const ageSec = k <= 2 ? 0 : k <= 4 ? 1 : 2;
      tape.push({
        key: `tp${tapeCursor - k}`,
        kind: isBuy ? "buy" : "sell",
        usd,
        mcap: liveMcap * jitter,
        trader: fakeTrader(tr),
        ageSec,
      });
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
      multiple: liveMcap / launchMcap,
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

export function usdLabel(v: number): string {
  if (v >= 1000) return `$${Math.round(v).toLocaleString("en-US")}`;
  return `$${v.toFixed(2)}`;
}

export function ladderLabel(v: number): string {
  if (v <= 0) return "$—";
  if (v >= 1e6) return `$${(v / 1e6).toFixed(v >= 1e7 ? 0 : 1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}
