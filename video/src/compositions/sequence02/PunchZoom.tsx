/**
 * PunchZoom — a keyframe-driven zoom envelope with a library of shapes.
 *
 * One generic ZoomEvent type, many helper constructors. Each event is a list
 * of (dtSec, scale) keyframes relative to atSec, plus a release back to 1.0.
 * Overlapping events take the max so nothing cancels.
 *
 * Shapes available out of the box:
 *
 *   punch      — snap in, brief hold, fast release
 *   crash      — very fast, very aggressive, long release
 *   progress   — step-ladder up through N discrete levels
 *   sustain    — zoom in and stay at scale for a long stretch
 *   bounce     — overshoot past target then settle
 *   drift      — slow linear push to a target
 *   doubletap  — two quick punches in a row
 *
 *   const scale = useZoom(ZOOM_EVENTS);
 *   <video style={{ transform: `scale(${scale})` }} />
 */

import React from "react";
import {
  Easing,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export interface ZoomEvent {
  /** When the envelope starts (seconds). Keyframes are dtSec-relative. */
  atSec: number;
  /** Keyframes (dtSec, scale). Implicit start at (0, 1.0). */
  keyframes: Array<{ dtSec: number; scale: number }>;
  /** How long the release takes after the last keyframe. */
  releaseSec: number;
  /** Easing curve between keyframes. Default "easeOut". */
  easing?: "linear" | "easeIn" | "easeOut" | "easeInOut";
  /** Optional label for readability. */
  label?: string;
}

// ── Shape constructors ──────────────────────────────────────────────────────

/** Snap in, hold briefly, release. The stock motion. */
export const punch = (
  atSec: number,
  opts: {
    scale?: number;
    inSec?: number;
    holdSec?: number;
    outSec?: number;
    label?: string;
  } = {},
): ZoomEvent => {
  const peak = opts.scale ?? 1.12;
  const ins = opts.inSec ?? 0.10;
  const hold = opts.holdSec ?? 0.25;
  return {
    atSec,
    label: opts.label,
    keyframes: [
      { dtSec: ins, scale: peak },
      { dtSec: ins + hold, scale: peak },
    ],
    releaseSec: opts.outSec ?? 0.55,
    easing: "easeOut",
  };
};

/** Aggressive spike. Bigger peak, longer release, snappier attack. */
export const crash = (
  atSec: number,
  opts: {
    scale?: number;
    outSec?: number;
    label?: string;
  } = {},
): ZoomEvent => {
  const peak = opts.scale ?? 1.22;
  return {
    atSec,
    label: opts.label,
    keyframes: [
      { dtSec: 0.06, scale: peak },
      { dtSec: 0.30, scale: peak },
    ],
    releaseSec: opts.outSec ?? 0.75,
    easing: "easeOut",
  };
};

/** Step-ladder up through N scales. Each step holds before the next. */
export const progress = (
  atSec: number,
  opts: {
    steps: number[];
    stepSec?: number; // time to move up to each step
    holdSec?: number; // hold time at each step
    releaseSec?: number;
    label?: string;
  },
): ZoomEvent => {
  const stepSec = opts.stepSec ?? 0.25;
  const holdSec = opts.holdSec ?? 0.30;
  const kfs: Array<{ dtSec: number; scale: number }> = [];
  let t = 0;
  opts.steps.forEach((s, i) => {
    t += stepSec;
    kfs.push({ dtSec: t, scale: s });
    if (i < opts.steps.length - 1) {
      t += holdSec;
      kfs.push({ dtSec: t, scale: s });
    }
  });
  // Final sustain at max
  t += holdSec;
  kfs.push({ dtSec: t, scale: opts.steps[opts.steps.length - 1] });
  return {
    atSec,
    label: opts.label,
    keyframes: kfs,
    releaseSec: opts.releaseSec ?? 0.70,
    easing: "easeOut",
  };
};

/** Slow push in, stay at target for a long time, release. */
export const sustain = (
  atSec: number,
  opts: {
    scale: number;
    durationSec: number;
    inSec?: number;
    outSec?: number;
    label?: string;
  },
): ZoomEvent => {
  const ins = opts.inSec ?? 0.30;
  return {
    atSec,
    label: opts.label,
    keyframes: [
      { dtSec: ins, scale: opts.scale },
      { dtSec: ins + opts.durationSec, scale: opts.scale },
    ],
    releaseSec: opts.outSec ?? 0.60,
    easing: "easeInOut",
  };
};

/** Overshoot past target, settle into a lower scale, then release. */
export const bounce = (
  atSec: number,
  opts: {
    overshoot: number;
    settle: number;
    outSec?: number;
    label?: string;
  },
): ZoomEvent => ({
  atSec,
  label: opts.label,
  keyframes: [
    { dtSec: 0.12, scale: opts.overshoot },
    { dtSec: 0.22, scale: opts.overshoot },
    { dtSec: 0.38, scale: opts.settle },
    { dtSec: 0.60, scale: opts.settle },
  ],
  releaseSec: opts.outSec ?? 0.55,
  easing: "easeOut",
});

/** Slow linear push to a target over a long duration. */
export const drift = (
  atSec: number,
  opts: {
    toScale: number;
    durationSec: number;
    outSec?: number;
    label?: string;
  },
): ZoomEvent => ({
  atSec,
  label: opts.label,
  keyframes: [{ dtSec: opts.durationSec, scale: opts.toScale }],
  releaseSec: opts.outSec ?? 0.80,
  easing: "easeInOut",
});

/** Two quick punches with a brief dip in between. */
export const doubletap = (
  atSec: number,
  opts: {
    scale?: number;
    gapSec?: number;
    label?: string;
  } = {},
): ZoomEvent => {
  const peak = opts.scale ?? 1.14;
  const gap = opts.gapSec ?? 0.22;
  return {
    atSec,
    label: opts.label,
    keyframes: [
      { dtSec: 0.08, scale: peak },
      { dtSec: 0.18, scale: peak },
      { dtSec: 0.28, scale: 1.02 },
      { dtSec: 0.28 + gap, scale: 1.02 },
      { dtSec: 0.36 + gap, scale: peak },
      { dtSec: 0.50 + gap, scale: peak },
    ],
    releaseSec: 0.55,
    easing: "easeOut",
  };
};

// ── Hook + wrapper ──────────────────────────────────────────────────────────

const EASING = {
  linear: (t: number) => t,
  easeIn: Easing.bezier(0.4, 0, 1, 1),
  easeOut: Easing.bezier(0, 0, 0.3, 1),
  easeInOut: Easing.bezier(0.4, 0, 0.2, 1),
};

/** Returns the current scale from the union of all zoom events. */
export const useZoom = (events: ZoomEvent[]): number => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  let scale = 1.0;

  for (const ev of events) {
    const startF = Math.round(ev.atSec * fps);
    const lastKf = ev.keyframes[ev.keyframes.length - 1];
    const lastKfFrame = startF + Math.round(lastKf.dtSec * fps);
    const envelopeEndF = lastKfFrame + Math.round(ev.releaseSec * fps);

    if (frame < startF || frame >= envelopeEndF) continue;

    const tSec = (frame - startF) / fps;
    const easeFn = EASING[ev.easing ?? "easeOut"];

    let s: number;
    if (tSec <= lastKf.dtSec) {
      // Inside the keyframe sequence — find bracketing pair
      let prev: { dtSec: number; scale: number } = { dtSec: 0, scale: 1.0 };
      let cur: { dtSec: number; scale: number } = ev.keyframes[0];
      for (const kf of ev.keyframes) {
        if (tSec <= kf.dtSec) {
          cur = kf;
          break;
        }
        prev = kf;
      }
      const denom = Math.max(0.001, cur.dtSec - prev.dtSec);
      const segT = Math.max(0, Math.min(1, (tSec - prev.dtSec) / denom));
      s = prev.scale + (cur.scale - prev.scale) * easeFn(segT);
    } else {
      // Releasing from lastKf.scale back to 1.0
      const relT = Math.max(
        0,
        Math.min(1, (tSec - lastKf.dtSec) / ev.releaseSec),
      );
      s = lastKf.scale + (1.0 - lastKf.scale) * EASING.easeOut(relT);
    }

    if (s > scale) scale = s;
  }

  return scale;
};

/** Back-compat alias — older call sites used usePunchZoom. */
export const usePunchZoom = useZoom;

/** Wraps children in a scaled container driven by the envelope union. */
export const PunchZoom: React.FC<{
  events: ZoomEvent[];
  origin?: string;
  children: React.ReactNode;
}> = ({ events, origin = "center center", children }) => {
  const scale = useZoom(events);
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        transform: `scale(${scale})`,
        transformOrigin: origin,
        willChange: "transform",
      }}
    >
      {children}
    </div>
  );
};
