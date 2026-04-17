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
