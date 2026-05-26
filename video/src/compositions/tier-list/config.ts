// Single source of truth for the Vision tier-list reel.
// Every tunable — tiers, layout, timing, camera — lives here. Change once, the
// engine recomputes the whole schedule, layout and duration off these numbers.

import type { Tier } from "./data";
import { FPS, W, H } from "../article-2/theme";

export { FPS, W, H };

export const TITLE = "Every General Markets Tier List";
export const SUBTITLE = "ranked by volume";

/** The canonical tiermaker palette, top (S) to bottom (F). */
export const TIERS: { id: Tier; color: string; ink: string }[] = [
  { id: "S", color: "#FF7F7F", ink: "#3a0d0d" },
  { id: "A", color: "#FFBF7F", ink: "#3a210a" },
  { id: "B", color: "#FFDF80", ink: "#3a2e0a" },
  { id: "C", color: "#FFFF7F", ink: "#363808" },
  { id: "D", color: "#BFFF7F", ink: "#1f3a0a" },
  { id: "F", color: "#7FB6FF", ink: "#0c2440" },
];

/** Order the cursor fills the board — bottom up, ending on the S payoff row. */
export const FILL_ORDER: Tier[] = ["F", "D", "C", "B", "A", "S"];

export const FIELD_BG = "#070809";
export const INK = "#F4F6FA";
export const TRACK_BG = "rgba(255,255,255,0.04)";
export const TRACK_BG_ACTIVE = "rgba(255,255,255,0.10)";
export const TILE_DISC = "#f5f5f7"; // matches the frontend research-bar logo disc

export const TITLE_BAND = 110;

export const LAYOUT = {
  board: { top: 134, rowH: 90, labelW: 132, trackX: 150, trackRight: 1900, rowGap: 4, leftPad: 14 },
  tile: { gap: 8, min: 30, max: 92 }, // one uniform size, derived from the fullest row
  tray: { top: 700, bottom: 1056, cols: 30, padX: 28, tile: 48 },
};

export const TIMING = {
  introFrames: 46, // establish — the whole board + tray, with a slow push
  flight: 13,
  drop: { F: 5, D: 5, C: 5, B: 6, A: 9, S: 15 } as Record<Tier, number>,
  tierLead: 10,
  tierTail: 8,
  chipDwell: { F: 13, D: 13, C: 15, B: 20, A: 32, S: 46 } as Record<Tier, number>,
  outroFrames: 100,
};

// A camera that never holds still: it establishes the whole board, then dives
// into each row tracking the cursor, lifts out between rows, and pulls back at
// the end — all over a gently tilting, breathing 3D plane.
export const CAMERA = {
  introPushFrom: 0.84, // establish opens a touch wide, pushes in to establishScale
  establishScale: 0.92, // whole board + tray in view
  transitionScale: 1.0, // lifted out, between rows
  focusScale: 1.34, // dived into the active row, tracking the drop
  outroScale: 0.92,
  tiltBaseDeg: 6, // the board reclines like a table — 3D depth
  tiltOscDeg: 2.2, // …and breathes
  swayDeg: 2.4, // slow side-to-side yaw
  perspective: 1500,
};
