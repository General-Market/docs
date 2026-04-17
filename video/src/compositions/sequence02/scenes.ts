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

// ── Zoom cues — 4 held levels + SLAM peaks, cuts on beats ───────────────────
//
// Four distinct zoom levels the camera rests on. Cuts land on emotional
// words; eases bridge phrases. Three dramatic-3 moments (three-step hard
// cut cascades) drive the biggest payoffs: RIGGED, 500, WIN.
//
// Max pushed to 1.64 — reserved for the absolute climactic beats.

import { dramatic3, type ZoomCue } from "./PunchZoom";

/** Four standing levels + a reserved SLAM for the biggest moments. */
const L = {
  WIDE: 1.00,
  MED: 1.16,
  CLOSE: 1.32,
  TIGHT: 1.50,
  SLAM: 1.64,
} as const;

export const PUNCH_EVENTS: ZoomCue[] = [
  // ── Scene 1 (0.00–4.56) — open wide, ease to MED on the hook
  { atSec: 0.00, scale: L.WIDE, easeSec: 0, label: "start wide" },
  { atSec: 0.16, scale: L.MED, easeSec: 0.55, label: "ease in on hook" },
  { atSec: 3.76, scale: L.CLOSE, easeSec: 0, label: "cut on 'banality'" },

  // ── Scene 2 (4.56–13.92) — drop wide, build into the stat
  { atSec: 4.56, scale: L.WIDE, easeSec: 0.45, label: "pull back for setup" },
  { atSec: 6.72, scale: L.MED, easeSec: 0.35, label: "ease in on 'means you'" },
  { atSec: 8.40, scale: L.CLOSE, easeSec: 0, label: "cut on 'never winning'" },
  { atSec: 10.40, scale: L.TIGHT, easeSec: 0, label: "SLAM on '70%'" },
  { atSec: 12.80, scale: L.MED, easeSec: 0.30, label: "ease down on 'insiders'" },

  // ── Scene 3 (13.92–24.40) — wide for the long beat, dramatic-3 into RIGGED
  { atSec: 13.92, scale: L.WIDE, easeSec: 0.55, label: "pull for narration" },
  { atSec: 18.48, scale: L.MED, easeSec: 0.25, label: "push on 'gave away'" },
  { atSec: 20.08, scale: L.CLOSE, easeSec: 0.20, label: "push on 'insiders'" },
  // ★ DRAMATIC 3 — "exchanges → were → RIGGED"
  ...dramatic3(22.80, {
    levels: [L.CLOSE, L.TIGHT, L.SLAM],
    stepSec: 0.52,
    label: "exchanges→rigged",
  }),

  // ── Scene 4 (24.40–30.08) — pull back for reveal, ease in on brand
  { atSec: 24.40, scale: L.MED, easeSec: 0.40, label: "pull for GM reveal" },
  { atSec: 25.60, scale: L.CLOSE, easeSec: 0.32, label: "ease on 'general market'" },
  { atSec: 27.20, scale: L.TIGHT, easeSec: 0, label: "cut on 'insider proof'" },
  { atSec: 29.40, scale: L.MED, easeSec: 0.30, label: "ease down 'edge back'" },

  // ── Scene 5 (30.08–37.28) — wide with mid-phrase pushes
  { atSec: 30.08, scale: L.WIDE, easeSec: 0.55, label: "wide for explanation" },
  { atSec: 33.12, scale: L.MED, easeSec: 0.30, label: "push on 'insiders'" },
  { atSec: 36.48, scale: L.CLOSE, easeSec: 0, label: "cut on 'insiders' (2nd)" },

  // ── Scene 6 (37.28–46.48) — solution punchy, lots of cuts
  { atSec: 37.28, scale: L.WIDE, easeSec: 0.35, label: "pull back fast" },
  { atSec: 39.28, scale: L.CLOSE, easeSec: 0, label: "cut on 'batches'" },
  { atSec: 40.16, scale: L.TIGHT, easeSec: 0.22, label: "push to 'thousands'" },
  { atSec: 42.80, scale: L.MED, easeSec: 0.35, label: "settle on 'forced'" },
  { atSec: 45.44, scale: L.TIGHT, easeSec: 0, label: "cut on 'edge'" },

  // ── Scene 7 (46.48–52.00) — DRAMATIC 3 into SLAM on 500
  // ★ DRAMATIC 3 — "Quantity → has protection → 500"
  ...dramatic3(46.48, {
    levels: [L.CLOSE, L.TIGHT, L.SLAM],
    stepSec: 1.15, // longer steps — matches the phrase cadence
    label: "quantity→500",
  }),

  // ── Scene 8 (52.00–60.56) — list rhythm: CLOSE/MED alternation per category
  { atSec: 52.00, scale: L.MED, easeSec: 0.40, label: "settle for list" },
  { atSec: 54.24, scale: L.CLOSE, easeSec: 0, label: "cut on 'Twitch'" },
  { atSec: 55.68, scale: L.MED, easeSec: 0, label: "drop on 'meme coins'" },
  { atSec: 56.24, scale: L.CLOSE, easeSec: 0, label: "cut on 'animals'" },
  { atSec: 56.96, scale: L.MED, easeSec: 0, label: "drop on 'movies'" },
  { atSec: 58.00, scale: L.CLOSE, easeSec: 0, label: "cut on 'parameter settlement'" },
  { atSec: 59.84, scale: L.TIGHT, easeSec: 0, label: "SLAM on '10 minutes'" },

  // ── Scene 9 (60.56–62.40) — ease into the closing
  { atSec: 60.56, scale: L.MED, easeSec: 0.30, label: "ease down 'Never'" },
  { atSec: 61.36, scale: L.CLOSE, easeSec: 0, label: "cut on 'spread'" },

  // ── Scene 10 (62.40–63.80) — DRAMATIC 3 to final SLAM on WIN
  // ★ DRAMATIC 3 — "trade → where you can → WIN"
  ...dramatic3(62.40, {
    levels: [L.CLOSE, L.TIGHT, L.SLAM],
    stepSec: 0.50,
    label: "trade→WIN",
  }),
];
