/* ------------------------------------------------------------------ *
 * camera.ts — a HAND, not a robot.
 *
 * A person navigating a TradingView chart doesn't move in clean beziers.
 * They make a few intentional gestures at irregular moments — a drag-out to
 * see context, a pinch-in on the god candle, a small side-scroll — and the
 * rest of the time their hand just sits there, never quite still.
 *
 * Three layers stacked into each frame:
 *
 *   1. GESTURES. Sparse step changes to a *target* at fractional timeline
 *      moments (not hardcoded frames, so it scales with totalFrames). The
 *      actual value chases the target through a damped spring with a touch
 *      of OVERSHOOT, then settles — the feel of dragging and letting go.
 *      Integrated in a single forward pass; spring state carries frame→frame.
 *
 *   2. MICRO-CORRECTION. A beat after a gesture lands, a tiny re-adjust —
 *      a human second-guessing the framing — folded straight into the target.
 *
 *   3. PARASITE TREMOR. A constant, low-amplitude jitter on BOTH outputs:
 *      several incommensurate (prime-ish) sines plus a slow value-noise drift.
 *      Never a clean oscillation, never still. This is what keeps the held
 *      frames alive between gestures.
 *
 * The god candle must never leave the screen: godX is clamped every frame to
 * [2, viewCount*0.55], so the right-edge anchor always stays on-camera.
 *
 * Fully deterministic and pure — no Math.random, no clock. All "randomness"
 * is seeded from a fixed integer plus the frame index.
 * ------------------------------------------------------------------ */

export interface CameraFrame {
  viewCount: number;
  godX: number;
}

const TWO_PI = Math.PI * 2;

// Cheap deterministic hash → [0,1). Seed + integer in, stable float out.
function hash01(seed: number, n: number): number {
  let h = (seed ^ (n * 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0x45d9f3b) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 0x100000000;
}

// Smooth value noise: lerp between two hashed lattice points, smoothstep'd.
// `t` is in lattice units; gives a slow organic drift, not a clean sine.
function valueNoise(seed: number, t: number): number {
  const i = Math.floor(t);
  const f = t - i;
  const a = hash01(seed, i);
  const b = hash01(seed, i + 1);
  const s = f * f * (3 - 2 * f);
  return (a + (b - a) * s) * 2 - 1; // → [-1, 1]
}

// A spring step with overshoot. Semi-implicit Euler, dt in frames so the
// numbers stay sane at 60fps. Returns the new {pos, vel}.
function springStep(
  pos: number,
  vel: number,
  target: number,
  stiffness: number,
  damping: number,
  dt: number,
): { pos: number; vel: number } {
  const accel = (target - pos) * stiffness - vel * damping;
  const nextVel = vel + accel * dt;
  const nextPos = pos + nextVel * dt;
  return { pos: nextPos, vel: nextVel };
}

type Gesture = {
  at: number; // fraction of the timeline where the hand acts
  view: number; // new zoom target (candles visible)
  godX: number; // new right-edge anchor target
};

export function buildCamera(opts: {
  totalFrames: number;
  fps: number;
  viewCountRange?: [number, number];
}): CameraFrame[] {
  const { totalFrames, fps } = opts;
  const [vMin, vMax] = opts.viewCountRange ?? [24, 54];

  // Irregular gesture schedule, as fractions of the timeline. Built for a
  // ~16s @ 60fps clip but expressed in fractions so it scales to any length:
  // start mid-zoom, drag out for context, pinch hard onto the god candle,
  // a slight side-scroll, then a small second zoom to re-frame.
  const gestures: Gesture[] = [
    { at: 0.0, view: 30, godX: 4 }, // opening framing
    { at: 0.19, view: 50, godX: 6 }, // drag out — see the run-up
    { at: 0.43, view: 26, godX: 4 }, // pinch in on the god candle
    { at: 0.61, view: 26, godX: 8 }, // slight side-scroll, same zoom
    { at: 0.79, view: 33, godX: 5 }, // small second zoom, re-frame
  ];

  // A micro-correction lands shortly after a gesture settles — a small nudge
  // back, as if the hand over-shot the framing and tidied it. Expressed as a
  // delayed delta layered onto the standing target.
  const SETTLE = 0.06; // ~6% of timeline after the gesture
  const microView = -2.4;
  const microGodX = -0.8;

  // The target at frame f: take the most recent gesture, then fold in its
  // micro-correction once enough time has passed for the spring to have settled.
  const targetAt = (frac: number): { view: number; godX: number } => {
    let g = gestures[0];
    for (const cand of gestures) if (frac >= cand.at) g = cand;
    const since = frac - g.at;
    // Micro-correction ramps in over a short window after SETTLE.
    const corr = Math.min(1, Math.max(0, (since - SETTLE) / 0.05));
    return {
      view: g.view + microView * corr,
      godX: g.godX + microGodX * corr,
    };
  };

  // Parasite tremor: incommensurate sines + slow value-noise. Same shape for
  // both channels, scaled per channel. `tSec` keeps it framerate-independent.
  const tremor = (tSec: number, seed: number): number => {
    const a = Math.sin(tSec * 2.3 * TWO_PI + seed) * 0.5;
    const b = Math.sin(tSec * 3.7 * TWO_PI + seed * 1.7) * 0.3;
    const c = Math.sin(tSec * 5.9 * TWO_PI + seed * 0.3) * 0.18;
    const drift = valueNoise(seed * 31 + 7, tSec * 0.9) * 0.55;
    return a + b + c + drift; // roughly [-1.5, 1.5]
  };

  // Spring tuning — slightly under-damped so it overshoots then settles.
  // Different per channel: zoom is heavier/slower, the scroll snappier.
  const dt = 1; // integrate in frame units
  const viewK = 0.018;
  const viewC = 0.16; // damping ratio < critical → overshoot
  const godK = 0.03;
  const godC = 0.2;

  // Seed the springs at the opening target so the first frame is framed, not
  // springing in from zero.
  const opening = targetAt(0);
  let viewPos = opening.view;
  let viewVel = 0;
  let godPos = opening.godX;
  let godVel = 0;

  const out: CameraFrame[] = [];
  for (let f = 0; f < totalFrames; f++) {
    const frac = totalFrames > 1 ? f / (totalFrames - 1) : 0;
    const tSec = f / fps;
    const tgt = targetAt(frac);

    const vStep = springStep(viewPos, viewVel, tgt.view, viewK, viewC, dt);
    viewPos = vStep.pos;
    viewVel = vStep.vel;

    const gStep = springStep(godPos, godVel, tgt.godX, godK, godC, dt);
    godPos = gStep.pos;
    godVel = gStep.vel;

    // Lay the tremor over the settled spring positions. Low amplitude:
    // ~±0.4 candles on viewCount, ~±0.45 on godX.
    const viewTremor = tremor(tSec, 11) * 0.27; // ~±0.4
    const godTremor = tremor(tSec, 53) * 0.3; // ~±0.45

    let viewCount = viewPos + viewTremor;
    viewCount = Math.min(vMax, Math.max(vMin, viewCount));

    // god candle anchored from the right edge; never scrolled off-screen.
    let godX = godPos + godTremor;
    const godHi = viewCount * 0.55;
    godX = Math.min(godHi, Math.max(2, godX));

    out.push({ viewCount, godX });
  }

  return out;
}
