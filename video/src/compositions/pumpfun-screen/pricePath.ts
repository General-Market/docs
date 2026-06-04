/* ------------------------------------------------------------------ *
 * pricePath — replay a REAL memecoin pump tick-by-tick into a per-frame
 * live-price series for the chart.
 *
 * The model, in one paragraph:
 *   • Real trades are ANCHORS. The price at each trade's mapped frame is
 *     exactly that trade's executed price — the true sequence, with all the
 *     real up-down-up-down chop intact. We never invent the macro shape.
 *   • TIME → FRAME is linear. The window's real time span [startT, endT] is
 *     stretched across [0, totalFrames). Real minutes compress into the clip;
 *     the ORDER and STRUCTURE of the prices survive untouched.
 *   • BETWEEN anchors the tape is not a dead staircase. We ease the base
 *     price between the two anchor prices, then add a liquidity-scaled
 *     micro-impact wiggle: a swap of `usd` against `liquidityUsd` moves price
 *     by roughly usd/liquidityUsd (constant-product intuition), so thinner
 *     pools / bigger trades → bigger jitter and a bigger visible step at the
 *     anchor. The wiggle is built to REVERSE often (negative autocorrelation),
 *     so the chart visibly oscillates like a live tape.
 *   • Everything is deterministic: a small LCG seeded from the frame index.
 *     No Math.random, no Date. One pass, finite outputs.
 * ------------------------------------------------------------------ */

import { Easing, interpolate } from "remotion";

export interface Tick {
  t: number;
  price: number;
  usd: number;
  kind: "buy" | "sell";
}

export interface Pool {
  liquidityUsd: number;
  reserveBase: number | null;
  reserveQuote: number | null;
}

export interface PriceFrame {
  price: number; // TOKEN price in USD (same unit as Tick.price)
  up: boolean;
}

const EASE = Easing.bezier(0.4, 0, 0.2, 1);

const clamp = (x: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, x));

/** Deterministic LCG seeded per frame — same frame always yields the same
 *  draw, so the path is pure. Returns a sequence of values in [0, 1). */
function lcg(seed: number) {
  let s = (seed ^ 0x9e3779b1) >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Liquidity-scaled impact fraction for a trade of `usd` against the pool.
 *  Constant-product: a swap moves price by ~ usd / liquidityUsd. Clamped so a
 *  whale in a dust pool can't blow the wiggle past a sane band. */
function impactFraction(usd: number, liquidityUsd: number): number {
  if (!(liquidityUsd > 0) || !(usd > 0)) return 0.0015;
  return clamp(usd / liquidityUsd, 0.0004, 0.06);
}

export function buildPricePath(
  ticks: Tick[],
  pool: Pool,
  opts: {
    totalFrames: number;
    fps: number;
    pumpWindow: { startT: number; endT: number; basePrice: number; peakPrice: number };
  },
): PriceFrame[] {
  const { totalFrames, pumpWindow } = opts;
  const { startT, endT, basePrice, peakPrice } = pumpWindow;
  const N = Math.max(1, Math.floor(totalFrames));

  // ---- Fallback: no real ticks → liquidity-scaled oscillating random walk ----
  if (!ticks || ticks.length === 0) {
    return synthWalk(pool, basePrice, peakPrice, N);
  }

  // ---- 1. Select the window (inclusive), sorted ascending by time ----
  const sorted = [...ticks].sort((a, b) => a.t - b.t);
  let windowTicks = sorted.filter((tk) => tk.t >= startT && tk.t <= endT);
  if (windowTicks.length < 8) windowTicks = sorted; // widen to all ticks

  // Degenerate: a single usable anchor → flat-ish walk around it.
  if (windowTicks.length < 2) {
    const p = windowTicks[0]?.price ?? basePrice;
    return synthWalk(pool, p, p * 1.0001, N);
  }

  // ---- 2. Map real time → frames (linear over the window span) ----
  const t0 = windowTicks[0].t;
  const t1 = windowTicks[windowTicks.length - 1].t;
  const span = t1 - t0 || 1;
  // Anchor frame for each tick. First → 0, last → N-1. Strictly increasing.
  const anchorFrame: number[] = windowTicks.map((tk) =>
    clamp(Math.round(((tk.t - t0) / span) * (N - 1)), 0, N - 1),
  );
  for (let i = 1; i < anchorFrame.length; i++) {
    if (anchorFrame[i] <= anchorFrame[i - 1]) {
      anchorFrame[i] = Math.min(anchorFrame[i - 1] + 1, N - 1);
    }
  }

  const floorPrice = Math.max(1e-15, basePrice * 0.5);

  // ---- 3. Stepwise replay with liquidity micro-fill ----
  const out: PriceFrame[] = new Array(N);
  let prev = windowTicks[0].price;
  let lastWiggle = 0; // for negative autocorrelation → flicker / reversals

  // Walk segment by segment so anchors land exactly on their frames.
  let seg = 0; // index of the LEFT anchor of the current segment
  for (let f = 0; f < N; f++) {
    // advance the segment so anchorFrame[seg] <= f <= anchorFrame[seg+1]
    while (
      seg < windowTicks.length - 2 &&
      f > anchorFrame[seg + 1]
    ) {
      seg++;
    }

    const aF = anchorFrame[seg];
    const bF = anchorFrame[Math.min(seg + 1, windowTicks.length - 1)];
    const aP = windowTicks[seg].price;
    const bP = windowTicks[Math.min(seg + 1, windowTicks.length - 1)].price;

    let price: number;
    const onAnchor = f === aF || f === bF;

    if (onAnchor) {
      // Exact real trade price at this anchor frame.
      price = f === bF ? bP : aP;
    } else {
      // Eased base between the two real prices (not a straight glide — the
      // ease gives little stalls near each anchor).
      const local = clamp((f - aF) / Math.max(1, bF - aF), 0, 1);
      const base = interpolate(EASE(local), [0, 1], [aP, bP]);

      // Liquidity-scaled micro-impact. Both bracketing trades push the
      // amplitude: a fat trade against a thin pool ripples the gap harder.
      const impA = impactFraction(windowTicks[seg].usd, pool.liquidityUsd);
      const impB = impactFraction(
        windowTicks[Math.min(seg + 1, windowTicks.length - 1)].usd,
        pool.liquidityUsd,
      );
      const impact = (impA + impB) * 0.5;

      // Deterministic draw for this frame.
      const rng = lcg(f * 2654435761 + seg);
      // Raw noise in [-1, 1], with negative autocorrelation so it reverses.
      let wiggle = rng() * 2 - 1;
      wiggle -= 0.55 * lastWiggle; // mean-revert → up-down-up-down chop
      if (rng() > 0.9) wiggle *= 2.4; // occasional spurt (throws a wick)
      if (rng() < 0.32) wiggle *= 0.12; // occasional stall (waiting on a fill)
      lastWiggle = wiggle;

      // Amplitude: impact fraction times the base, with a small floor so the
      // line never goes perfectly dead even in a deep pool. Mid-segment gets
      // the most movement; it tapers toward the anchors so they read clean.
      const taper = Math.sin(local * Math.PI); // 0 at anchors, 1 in the middle
      const amp = base * (impact * 0.9 + 0.0012) * (0.5 + 1.1 * taper);
      price = base + wiggle * amp;
    }

    price = Math.max(floorPrice, price);
    if (!Number.isFinite(price)) price = prev;

    out[f] = { price, up: f === 0 ? true : price >= prev };
    prev = price;
  }

  return out;
}

/* ------------------------------------------------------------------ *
 * Fallback walk — liquidity-scaled, heavily oscillating, deterministic.
 * Rises base → peak then settles slightly below peak. Strong reversals.
 * ------------------------------------------------------------------ */
function synthWalk(
  pool: Pool,
  basePrice: number,
  peakPrice: number,
  N: number,
): PriceFrame[] {
  const out: PriceFrame[] = new Array(N);
  const floorPrice = Math.max(1e-15, basePrice * 0.5);
  // A nominal "typical trade" of 1% of the pool sets the oscillation scale,
  // so a thinner pool chops harder.
  const impact = impactFraction(Math.max(1, pool.liquidityUsd * 0.01), pool.liquidityUsd);

  let prev = basePrice;
  let lastWiggle = 0;
  const settle = peakPrice - (peakPrice - basePrice) * 0.12; // a touch below peak

  for (let f = 0; f < N; f++) {
    const p = N <= 1 ? 1 : f / (N - 1);
    // Macro skeleton: slow base, vertical boom, settle below peak.
    let base: number;
    if (p < 0.28) {
      base = basePrice;
    } else if (p < 0.82) {
      const r = (p - 0.28) / 0.54;
      base = basePrice + (peakPrice - basePrice) * Math.pow(r, 2.1);
    } else {
      const r = (p - 0.82) / 0.18;
      base = peakPrice + (settle - peakPrice) * Easing.out(Easing.ease)(r);
    }

    const rng = lcg(f * 40503 + 7);
    let wiggle = rng() * 2 - 1;
    wiggle -= 0.5 * lastWiggle; // reversals
    if (rng() > 0.9) wiggle *= 2.6; // spurt
    if (rng() < 0.3) wiggle *= 0.15; // stall
    lastWiggle = wiggle;

    const regime = p < 0.28 ? 0.4 : p < 0.82 ? 1 : 0.6;
    const amp = base * (impact * 1.4 + 0.003) * regime;
    let price = base + wiggle * amp;
    price = Math.max(floorPrice, price);
    if (!Number.isFinite(price)) price = prev;

    out[f] = { price, up: f === 0 ? true : price >= prev };
    prev = price;
  }

  return out;
}
