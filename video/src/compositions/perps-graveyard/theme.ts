// PerpsGraveyardReel — the BatchFlowReel frosted-glass language, reused: a soft
// pastel ground, glass panels, blue→violet pills, SF-Pro/Inter type, sourced
// Apple easing. One protocol per slide; a rail of logo bubbles on the right
// lights up as each is named and stays lit — a progress bar made of graves.

import { Easing } from "remotion";
import { font, monoFont } from "../../common/fonts";
import { PROTOCOLS } from "./data";

export { font, monoFont };

export const FPS = 60;
export const W = 1920;
export const H = 1080;

export const sec = (s: number): number => Math.round(s * FPS);

export const BG_GRADIENT =
  "linear-gradient(135deg, #DCE6FF 0%, #E7E3FF 52%, #F2E4F1 100%)";
export const PILL_GRADIENT =
  "linear-gradient(95deg, #0071E3 0%, #5E78FF 52%, #9E7BFF 100%)";

export const C = {
  text: "#1D1D1F",
  dim: "#5A5B6A",
  faint: "#8A8B9C",
  rule: "rgba(60, 60, 110, 0.14)",
  ruleStrong: "rgba(60, 60, 110, 0.22)",
  surface: "rgba(255, 255, 255, 0.62)",
  surfaceSunk: "rgba(255, 255, 255, 0.34)",
  blue: "#0071E3",
  blueBright: "#2997ff",
  violet: "#6E5BFF",
  pink: "#FF7AC6",
  down: "#F2566B",
  downDeep: "#D8324B",
  up: "#1FB877",
  glassBorder: "rgba(255, 255, 255, 0.72)",
} as const;

export const EASE = {
  out: Easing.bezier(0.16, 1, 0.3, 1),
  in: Easing.bezier(0.7, 0, 0.84, 0),
  inOut: Easing.bezier(0.87, 0, 0.13, 1),
  smooth: Easing.bezier(0.4, 0, 0.2, 1),
} as const;

// ─── Layout ───────────────────────────────────────────────────────────────
// Right rail reserved for the bubble progress bar; the slide owns the rest.
export const RAIL_X = 1792; // bubble centre
export const RAIL_TOP = 92;
export const RAIL_BOTTOM = 936; // leaves room below for the running raised tally
export const BUBBLE_D = 44;

export const PANEL_L = 96; // left margin of the slide content
export const PANEL_R = 1610; // right edge before the rail gutter

// ─── Schedule ───────────────────────────────────────────────────────────────
export const INTRO_SEC = 2.4;
export const SLIDE_SEC = 4.2;
export const OUTRO_SEC = 3.4;
export const OVERLAP = 12; // cross-dissolve between beats
export const EDGE = 12; // per-beat fade length
export const ACTIVATE_DELAY = 7; // frames after a slide starts before its bubble lights

export type Slot =
  | { kind: "intro"; from: number; dur: number }
  | { kind: "slide"; from: number; dur: number; protoIdx: number }
  | { kind: "outro"; from: number; dur: number };

export const SCHEDULE: Slot[] = (() => {
  const slots: Slot[] = [];
  const introF = sec(INTRO_SEC);
  const slideF = sec(SLIDE_SEC);
  const outroF = sec(OUTRO_SEC);

  slots.push({ kind: "intro", from: 0, dur: introF });
  let from = introF - OVERLAP;
  PROTOCOLS.forEach((_p, i) => {
    slots.push({ kind: "slide", from, dur: slideF, protoIdx: i });
    from = from + slideF - OVERLAP;
  });
  slots.push({ kind: "outro", from, dur: outroF });
  return slots;
})();

export const TOTAL_FRAMES =
  SCHEDULE[SCHEDULE.length - 1].from + SCHEDULE[SCHEDULE.length - 1].dur;

// Global frame at which protocol i's bubble lights (and stays lit).
export const SLIDE_STARTS: number[] = SCHEDULE.filter(
  (s): s is Extract<Slot, { kind: "slide" }> => s.kind === "slide",
).map((s) => s.from + ACTIVATE_DELAY);
