// Single source of truth for the Vision tier-list reel.
// Every tunable — tiers, layout, timing, camera — lives here. Change once, the
// engine recomputes the whole schedule, layout and duration off these numbers.

import type { Tier } from "./data";
import { FPS, W, H } from "../article-2/theme";

export { FPS, W, H };

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
export const TRACK_BG = "rgba(255,255,255,0.045)";
export const TILE_BG = "rgba(255,255,255,0.96)";

export const LAYOUT = {
  title: { y: 30 },
  board: { top: 96, rowH: 108, labelW: 150, trackX: 170, trackRight: 1892, rowGap: 2 },
  tile: { base: 84, gap: 8, min: 30, radius: 13 },
  tray: { top: 762, bottom: 1054, cols: 30, padX: 44, tile: 50, radius: 9 },
};

export const TIMING = {
  introFrames: 42, // zoom-out reveal
  flight: 13, // frames a logo is airborne, tray -> row
  // gap between successive pickups, per tier (smaller = faster). Big crowded
  // tiers fire fast; the S/A giants get room to breathe.
  drop: { F: 5, D: 5, C: 5, B: 6, A: 9, S: 15 } as Record<Tier, number>,
  tierLead: 8, // beat before a tier begins filling
  tierTail: 6, // beat after a tier finishes
  // how long the description chip lingers after a drop, per tier
  chipDwell: { F: 13, D: 13, C: 15, B: 20, A: 32, S: 46 } as Record<Tier, number>,
  outroFrames: 96, // pull back to the finished board + brand beat
};

export const CAMERA = {
  introScale: 2.3,
  introCy: 360,
  focusScale: 1.08,
  focusBias: 0.5, // 0 = active row centred, 1 = screen centred
  outroScale: 1.0,
  outroCy: 408,
};
