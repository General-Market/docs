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

// The whole board + tray must fit inside the frame at scale 1 and never crop.
// Title rides as a fixed overlay above the world (top 0..TITLE_BAND).
export const TITLE_BAND = 104;

export const LAYOUT = {
  board: { top: 116, rowH: 94, labelW: 138, trackX: 156, trackRight: 1902, rowGap: 4 },
  tile: { base: 78, gap: 7, min: 28 },
  tray: { top: 700, bottom: 1058, cols: 30, padX: 28, tile: 48 },
};

export const TIMING = {
  introFrames: 40, // gentle settle-in (never crops — scales up to 1.0)
  flight: 13, // frames a logo is airborne, tray -> row
  drop: { F: 5, D: 5, C: 5, B: 6, A: 9, S: 15 } as Record<Tier, number>,
  tierLead: 8,
  tierTail: 6,
  chipDwell: { F: 13, D: 13, C: 15, B: 20, A: 32, S: 46 } as Record<Tier, number>,
  outroFrames: 96,
};

export const CAMERA = {
  introStartScale: 0.955, // opens slightly small, grows to fill — a zoom that never crops
};
