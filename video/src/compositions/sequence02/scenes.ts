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

// ── Zoom cues — held states, cuts on beats, clean bezier between ────────────
//
// Each cue locks the scale at a new level and holds it until the next cue.
// Hard cuts (easeSec: 0) land instantly on the emotional word; soft eases
// bridge phrases. No auto-release. The camera stays put — charisma lives
// in the hold.

import type { ZoomCue } from "./PunchZoom";

export const PUNCH_EVENTS: ZoomCue[] = [
  // ── Opening — push gently, hold through the hook
  { atSec: 0.00,  scale: 1.00, easeSec: 0,    label: "start wide" },
  { atSec: 1.28,  scale: 1.10, easeSec: 0.18, label: "ease in on 'booming'" },

  // ── Scene 2 — pull back, then cut into the stat
  { atSec: 4.56,  scale: 1.04, easeSec: 0.50, label: "settle wide" },
  { atSec: 8.40,  scale: 1.12, easeSec: 0,    label: "cut on 'never winning'" },
  { atSec: 10.40, scale: 1.22, easeSec: 0,    label: "SLAM on '70%'" },
  { atSec: 12.80, scale: 1.14, easeSec: 0.35, label: "ease down through 'insiders'" },

  // ── Scene 3 — breathe wide, drift into RIGGED, slam
  { atSec: 13.92, scale: 1.04, easeSec: 0.55, label: "pull back for narration" },
  { atSec: 21.50, scale: 1.10, easeSec: 2.00, label: "slow drift — tension" },
  { atSec: 23.84, scale: 1.32, easeSec: 0,    label: "SLAM on 'RIGGED'" },

  // ── Scene 4 — GM reveal: pull back, push in cinematically
  { atSec: 24.40, scale: 1.10, easeSec: 0.45, label: "pull for GM reveal" },
  { atSec: 25.60, scale: 1.16, easeSec: 0.30, label: "ease in on 'general market'" },

  // ── Scene 5 — wide hold through the explanation
  { atSec: 30.08, scale: 1.04, easeSec: 0.60, label: "wide for long narration" },

  // ── Scene 6 — cut into the solution
  { atSec: 39.28, scale: 1.20, easeSec: 0,    label: "cut on 'batches'" },
  { atSec: 42.80, scale: 1.14, easeSec: 0.50, label: "ease down through middle" },

  // ── Scene 7 — ease into the climax, slam on 500
  { atSec: 46.48, scale: 1.16, easeSec: 0.45, label: "ease in on 'Quantity'" },
  { atSec: 49.92, scale: 1.28, easeSec: 0,    label: "SLAM on '500'" },

  // ── Scene 8 — settle at medium, cut on 10 minutes
  { atSec: 52.00, scale: 1.08, easeSec: 0.55, label: "settle for list" },
  { atSec: 59.84, scale: 1.18, easeSec: 0,    label: "cut on '10 minutes'" },

  // ── Scene 9 — ease into closing beat
  { atSec: 60.56, scale: 1.14, easeSec: 0.30, label: "ease into 'Never pay spread'" },

  // ── Scene 10 — final slam on WIN
  { atSec: 63.40, scale: 1.34, easeSec: 0,    label: "FINAL SLAM on 'WIN'" },
];
