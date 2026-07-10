// Motion tables for the NetGrowth replica — every number measured
// per frame off the reference (geometry scans in
// .claude/rounds/work/netgrowth/). Per-event measured tables beat any
// analytic curve (replicate-method lesson 14); nothing here is invented.

import { CX_Y, CX_T, D_Y, D_T, BREATH_D } from "./genTables";

export { CX_Y, CX_T, D_Y, D_T, BREATH_D };

// ─── Cycle structure ───
// The 709-frame video is three runs of ONE deterministic choreography.
// Cycle starts (h1 rise at local f9 in each): f0, f235, f472.
// The exit sequence anchors at local f215 in cycle 1, f216 in cycles 2/3.
export const CYCLES = [
  { start: 0, exitAt: 215 },
  { start: 235, exitAt: 216 },
  { start: 472, exitAt: 216 },
] as const;

export const cycleOf = (frame: number) => {
  const c = frame >= 472 ? CYCLES[2] : frame >= 235 ? CYCLES[1] : CYCLES[0];
  return { rf: frame - c.start, exitAt: c.exitAt };
};

// Sample a per-frame table anchored at `startF`; clamps both ends.
export const tab = (t: readonly number[], startF: number, rf: number): number => {
  const i = Math.max(0, Math.min(t.length - 1, Math.round(rf - startF)));
  return t[i];
};

// ─── Entrances (offsets in px unless noted) ───
// Headline lines + subtitle rise from below a clip; offset = glyph-top
// minus settled top, per frame.
export const H1_RISE = [63, 38, 23, 14, 9, 5, 2, 1, 0]; // f9..f17
export const H2_RISE = [45, 27, 16, 9, 4, 1, 0]; // f20..f26
export const SUB_RISE = [36, 27, 19, 12, 7, 3, 1, 0]; // f25..f32

// Row labels slide rightward into place from off-frame left; dx vs settled.
export const LAB_IN = [376, 298, 204, 127, 75, 42, 21, 8, 2, 0]; // r1 f36.., r2 f41..

// Tracks draw left→right; right edge per frame.
export const TRK1_IN = [450, 464, 475, 498, 534, 589, 662, 744, 817, 871, 908, 930, 942, 945]; // f31..f44
export const TRK2_IN = [450, 455, 467, 494, 549, 643, 759, 853, 908, 935, 943]; // f40..f50

// Divider draws left→right; right edge per frame (also reversed on exit).
export const DIV_IN = [57, 68, 89, 123, 176, 257, 378, 542, 705, 826, 907, 960, 994, 1015, 1026, 1029]; // f34..f49

// Legend squares scale from their centers; width px per frame.
export const SQ_IN = [1, 5, 11, 18, 24, 28, 31, 33]; // f30..f37

// Legend texts slide rightward out from behind the square; dx vs settled.
export const LEG1_IN = [295, 272, 248, 222, 197, 170, 144, 120, 97, 75, 56, 39, 25, 14, 6, 2, 0]; // f37..f53
export const LEG2_IN = [269, 235, 201, 170, 141, 116, 94, 75, 58, 44, 33, 23, 15, 9, 5, 2, 0]; // f36..f52

// Footnote slides rightward from off-frame left; dx vs settled.
export const FN_IN = [786, 535, 284, 154, 82, 40, 16, 4, 0]; // f58..f66

// Logo slides rightward out from behind a left clip; dx vs settled.
export const LOGO_IN = [170, 151, 122, 84, 55, 37, 24, 16, 10, 6, 3, 2, 1, 0]; // f54..f67

// Tagline words scale up from their own centers; scale per frame.
export const WORD_IN = [0.06, 0.13, 0.21, 0.39, 0.61, 0.77, 0.86, 0.92, 0.95, 0.977, 0.988, 1]; // 12f
export const WORD_STARTS = [65, 78, 91]; // per word

// Bubbles pop at the track start (center fixed); diameter px per frame.
export const POP_Y = [9, 21, 43, 66, 79, 86, 89, 90.7]; // f44..f51
export const POP_T = [3, 9, 21, 43, 66, 79, 86, 89, 91]; // f43..f51

// ─── Exits (t = rf - exitAt) ───
// Rows fly out horizontally, accelerating: row 1 exits RIGHT, row 2 LEFT.
// Measured t=0..6/8, extrapolated with the fitted 0.444t³+3.333t² tail.
export const ROW1_OUT = [4, 18, 42, 81, 137, 216, 325, 441, 593, 777, 994, 1247];
export const ROW2_OUT = [5, 21.5, 51.5, 98, 166, 262, 394, 576, 797, 1057, 1360];

// Headline/subtitle sink back behind their clips (mirror of the rise).
export const H1_OUT = [0, 1, 2, 5, 9, 14, 23, 38, 63, 95]; // t=0..9
export const H2_OUT = [0, 0, 1, 4, 9, 16, 27, 45, 85]; // t=0..8
export const SUB_OUT = [2, 9, 19, 31, 46, 66]; // t=0..5

// Legend text retracts leftward behind the square; dx vs settled.
export const LEG1_OUT = [4, 9, 18, 29, 44, 63, 87, 116, 151, 191, 236, 280, 324]; // t=0..12
export const LEG2_OUT = [4, 9, 18, 29, 44, 63, 87, 116, 151, 191, 235, 280, 313]; // t=0..12
// Squares then scale away (width px, t from exitAt+11).
export const SQ_OUT = [33, 20, 8, 6, 4, 2, 1, 0];

// Logo retracts behind its left clip; dx vs settled.
export const LOGO_OUT = [0, 1, 3, 6, 10, 16, 24, 36, 55, 84, 122, 151, 170, 220]; // t=0..13

// Divider retracts right→left; right edge (t from exitAt+4).
export const DIV_OUT = [1029, 1026, 1015, 994, 960, 907, 826, 705, 542, 378, 257, 176, 123, 89, 69, 58, 0]; // then gone

// Tagline words scale back down (shared curve, measured off word 1).
export const WORD_OUT = [1, 0.98, 0.95, 0.92, 0.86, 0.77, 0.61, 0.39, 0.23, 0.13, 0.05, 0]; // t=1..12

// Footnote sinks at FULL opacity behind a clip at y=944 (just above the
// divider), anchored at exitAt. Top-edge dy measured per frame in all three
// cycles (identical): settled 900 -> 901/902/904/909/918/932/941 -> consumed.
// r1 modeled this as a 3f fade (FN_FADE [1,.81,.3,0]) — refuted by
// measurement: max ink brightness stays ~650 through the whole exit.
export const FN_SINK = [0, 1, 2, 4, 9, 18, 32, 41, 52, 64];
