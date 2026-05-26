// Single source of truth for the Vision tier-list reel.
// Every tunable — tiers, layout, timing, camera — lives here. Change once, the
// engine recomputes the whole schedule, layout and duration off these numbers.

import type { Tier } from "./data";
import { FPS, W, H } from "../article-2/theme";

export { FPS, W, H };

export const TITLE = "Every General Markets Tier List";

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

export const TITLE_BAND = 150;
export const TITLE_PAD_TOP = 48; // breathing room above the title

export const LAYOUT = {
  board: { top: 208, rowH: 88, labelW: 132, trackX: 150, trackRight: 1900, rowGap: 4, leftPad: 14 },
  tile: { gap: 8, min: 30, max: 92 }, // one uniform size, derived from the fullest row
  tray: { top: 744, bottom: 1056, cols: 30, padX: 28, tile: 48 },
};

export const TIMING = {
  introFrames: 8, // a brief beat before the fill (trimmed away by OPEN_TRIM)
  flight: 13,
  drop: { F: 5, D: 5, C: 5, B: 6, A: 9, S: 15 } as Record<Tier, number>,
  tierLead: 10,
  tierTail: 8,
  chipDwell: { F: 13, D: 13, C: 15, B: 20, A: 32, S: 46 } as Record<Tier, number>,
  outroFrames: 100,
};

// The video opens mid-fill — no intro, no poster. Frame 0 of the render is this
// many frames into the timeline, so the F tier is already partly stacked.
export const OPEN_TRIM = 90;

// A soft focus glide up the board as it fills, and a pull-back at the end.
export const CAMERA = {
  establishScale: 0.9,
  focusScale: 1.08, // a gentle focus as the camera glides up, row by row
  focusBias: 0.5, // 0 = active row centred, 1 = screen centred
  outroScale: 0.92,
};
