import type { Scene } from "../endcard/layout";
import { W } from "./theme";
import { LAYOUTS } from "../endcard/layout";
import type { Rect } from "../endcard/layout";

/**
 * Scene cadence is driven by the parakeet transcript of Sequence02.mp4.
 * Each layout change lands on a sentence boundary; scene length follows
 * how long the idea lives in the voice.
 */
export const SCENES: Scene[] = [
  { startSec: 0.0,   endSec: 4.56,  layout: "centered" },          // hook
  { startSec: 4.56,  endSec: 13.92, layout: "right-medium" },      // "1 in 2000 / 70%"
  { startSec: 13.92, endSec: 24.40, layout: "left-medium" },       // "RIGGED"
  { startSec: 24.40, endSec: 30.08, layout: "centered" },          // "Introducing GM"
  { startSec: 30.08, endSec: 37.28, layout: "right-small" },       // normal exchange flaw
  { startSec: 37.28, endSec: 46.48, layout: "left-small" },        // batches
  { startSec: 46.48, endSec: 52.00, layout: "centered" },          // "quantity / 500 markets"
  { startSec: 52.00, endSec: 60.56, layout: "right-medium" },      // market list
  { startSec: 60.56, endSec: 62.40, layout: "centered-bottom" },   // "never pay spread"
  { startSec: 62.40, endSec: 63.80, layout: "middle-banner" },     // GM logo
];

const SIDE_MARGIN = 48;

/** Content-area rect = the empty side opposite the offset webcam rect. */
export function getContentArea(layout: Scene["layout"]): Rect | null {
  if (
    layout === "centered" ||
    layout === "centered-bottom" ||
    layout === "middle-banner"
  ) {
    return null;
  }
  const r = LAYOUTS[layout];
  if (layout.startsWith("left-")) {
    const x = r.x + r.w + SIDE_MARGIN;
    return { x, y: r.y, w: W - x - SIDE_MARGIN, h: r.h };
  }
  // right-*
  return {
    x: SIDE_MARGIN,
    y: r.y,
    w: r.x - 2 * SIDE_MARGIN,
    h: r.h,
  };
}

// ── Accent overlays ─────────────────────────────────────────────────────────

export interface SideAccent {
  appearSec: number;
  hideSec: number;
  title: string;
  sub?: string;
  /** Font size for title. Defaults to 112 if title is short, 80 otherwise. */
  titleSize?: number;
}

/** Side-panel text — only renders when the current scene has a content area. */
export const SIDE_ACCENTS: SideAccent[] = [
  // scene 2 (4.56–13.92, right-medium) — stat
  { appearSec: 9.2,  hideSec: 13.5, title: "1 in 2000", sub: "take 70%", titleSize: 128 },
  // scene 3 (13.92–24.40, left-medium) — condemnation
  { appearSec: 21.0, hideSec: 24.2, title: "Rigged", titleSize: 220 },
  // scene 5 (30.08–37.28, right-small) — the flaw
  { appearSec: 31.4, hideSec: 36.8, title: "Normal exchange", sub: "insiders pick the markets they own", titleSize: 64 },
  // scene 6 (37.28–46.48, left-small) — the fix
  { appearSec: 38.8, hideSec: 46.0, title: "Batches of thousands", sub: "insiders forced into markets where they have no edge", titleSize: 60 },
  // scene 8 (52.00–60.56, right-medium) — market categories
  { appearSec: 53.4, hideSec: 60.2, title: "Twitch, memes, animals, movies.", sub: "Settlement every 10 minutes.", titleSize: 76 },
];

export interface CenterCallout {
  appearSec: number;
  hideSec: number;
  text: string;
  position: "top" | "bottom";
  size?: number;
}

/** Overlays during centered scenes — land on the frame not the rect. */
export const CENTER_CALLOUTS: CenterCallout[] = [
  // scene 4 — "Introducing General Market"
  { appearSec: 25.2, hideSec: 29.8, text: "Insider-proof", position: "top", size: 76 },
  // scene 7 — "Quantity has protection. Trade 500 exclusive markets."
  { appearSec: 47.0, hideSec: 51.6, text: "500 exclusive markets", position: "bottom", size: 88 },
];

export const BOTTOM_LABEL_TEXT = "Never pay spread. Trade where you can win.";

// ── Zoom choreography — varied shapes anchored to the voice track ───────────
//
// A launch video needs more than zoom/unzoom. This timeline mixes:
//   progress (step-ladder up),  sustain (long hold at scale),
//   crash (fast aggressive spike),  bounce (overshoot + settle),
//   drift (slow linear push),  doubletap (two quick hits),
//   punch (the stock snap).
//
// Word timings come from the parakeet transcript at word-level resolution.

import {
  punch,
  crash,
  progress,
  sustain,
  bounce,
  drift,
  doubletap,
  type ZoomEvent,
} from "./PunchZoom";

export const PUNCH_EVENTS: ZoomEvent[] = [
  // ── Scene 1 (0.00–4.56): hook — progress climbs through the first sentence
  progress(0.16, {
    steps: [1.05, 1.10, 1.15],
    stepSec: 0.42,
    holdSec: 0.18,
    releaseSec: 0.45,
    label: "insider trading is BOOMING",
  }),
  punch(3.76, { scale: 1.14, holdSec: 0.35, label: "banality" }),

  // ── Scene 2 (4.56–13.92): stat — drift → bounce → crash → sustain
  drift(5.00, {
    toScale: 1.06,
    durationSec: 2.6,
    outSec: 0.25,
    label: "prediction market reality",
  }),
  bounce(7.68, {
    overshoot: 1.20,
    settle: 1.11,
    outSec: 0.55,
    label: "never winning",
  }),
  crash(10.40, { scale: 1.24, outSec: 0.80, label: "70%" }),
  sustain(12.80, {
    scale: 1.12,
    durationSec: 0.90,
    inSec: 0.20,
    outSec: 0.40,
    label: "They are the insiders",
  }),

  // ── Scene 3 (13.92–24.40): condemnation — small hits, drift to CRASH
  punch(14.16, { scale: 1.08, label: "you thought" }),
  punch(18.48, { scale: 1.10, label: "gave away" }),
  punch(20.08, { scale: 1.12, label: "insiders" }),
  drift(21.60, {
    toScale: 1.15,
    durationSec: 2.20,
    outSec: 0.08,
    label: "tension build",
  }),
  crash(23.84, { scale: 1.32, outSec: 1.00, label: "RIGGED" }),

  // ── Scene 4 (24.40–30.08): reveal — progressive rollout of GM
  progress(24.40, {
    steps: [1.05, 1.10, 1.16],
    stepSec: 0.50,
    holdSec: 0.28,
    releaseSec: 0.5,
    label: "Introducing · general · market",
  }),
  doubletap(27.20, { scale: 1.14, gapSec: 0.20, label: "insider proof" }),
  punch(29.40, { scale: 1.12, label: "edge back" }),

  // ── Scene 5 (30.08–37.28): explanation — hold at a pushed baseline
  punch(31.20, { scale: 1.10, label: "different?" }),
  sustain(32.16, {
    scale: 1.08,
    durationSec: 1.60,
    inSec: 0.25,
    outSec: 0.50,
    label: "normal exchange",
  }),
  progress(34.30, {
    steps: [1.06, 1.10, 1.14],
    stepSec: 0.55,
    holdSec: 0.40,
    releaseSec: 0.55,
    label: "trade · market · insiders",
  }),

  // ── Scene 6 (37.28–46.48): solution — crash, progress, bounce
  crash(39.28, { scale: 1.20, outSec: 0.35, label: "batches" }),
  progress(40.20, {
    steps: [1.08, 1.13, 1.18],
    stepSec: 0.30,
    holdSec: 0.20,
    releaseSec: 0.45,
    label: "thousands of trades",
  }),
  punch(42.80, { scale: 1.10, label: "forced" }),
  bounce(45.44, {
    overshoot: 1.22,
    settle: 1.13,
    outSec: 0.45,
    label: "no more edge",
  }),

  // ── Scene 7 (46.48–52.00): climax — progress then CRASH on 500
  progress(46.48, {
    steps: [1.08, 1.13, 1.18],
    stepSec: 0.42,
    holdSec: 0.32,
    releaseSec: 0.40,
    label: "Quantity has protection",
  }),
  crash(49.92, { scale: 1.26, outSec: 0.75, label: "500" }),

  // ── Scene 8 (52.00–60.56): list — one progress ramping across categories
  progress(54.00, {
    steps: [1.06, 1.10, 1.14, 1.18],
    stepSec: 0.68,
    holdSec: 0.60,
    releaseSec: 0.70,
    label: "Twitch → memes → animals → movies",
  }),
  punch(59.84, {
    scale: 1.14,
    inSec: 0.08,
    holdSec: 0.30,
    outSec: 0.40,
    label: "10 minutes",
  }),

  // ── Scene 9 (60.56–62.40): transition — stepped through the closing
  progress(60.56, {
    steps: [1.08, 1.14],
    stepSec: 0.40,
    holdSec: 0.30,
    releaseSec: 0.20,
    label: "Never pay spread",
  }),

  // ── Scene 10 (62.40–63.80): final CRASH on WIN
  crash(63.30, { scale: 1.34, outSec: 0.30, label: "WIN" }),
];
