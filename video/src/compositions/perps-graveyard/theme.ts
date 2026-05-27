// PerpsGraveyardReel — reskinned into the brand's AntiCheat dot-grid world. The
// ground is the light field `colors.bg` with an animated blue dot-grid; type is
// Bricolage bold in near-black; the accent is GM Electric (#2D5BFF) with a glow;
// surfaces are opaque white cards. Red survives only as the chart's collapse
// colour. One protocol per slide; a rail of logo bubbles on the right lights up
// as each is named and stays lit — a progress bar made of graves.

import { Easing } from "remotion";
import { font, monoFont } from "../../common/fonts";
import { colors } from "../anticheat/theme";
import { PROTOCOLS } from "./data";

export { font, monoFont, colors };

// Shared glow recipes — text glow for the accent line, stroke glow for SVG,
// card glow for opaque white surfaces. Centralised so every surface reads the
// same as the AntiCheat reference.
export const ACCENT_TEXT_GLOW =
  "0 0 26px rgba(91,134,255,0.55), 0 0 10px rgba(45,91,255,0.45)";
export const accentStrokeGlow = (a = 0.55) =>
  `drop-shadow(0 0 12px rgba(45,91,255,${a}))`;
export const accentCardGlow = (px: number, a: number) =>
  `0 18px 44px rgba(10,12,20,0.12), 0 0 ${px}px rgba(45,91,255,${a})`;

export const FPS = 60;
export const W = 1920;
export const H = 1080;

export const sec = (s: number): number => Math.round(s * FPS);

// Palette mapped onto the AntiCheat world. `accent` is GM Electric; `down`/
// `downDeep` keep their red, used only for the chart's collapse.
export const C = {
  text: colors.fg,
  dim: colors.dim,
  faint: "#A2A6AE",
  rule: colors.rule,
  surface: colors.surface,
  accent: colors.accent,
  down: "#F2566B",
  downDeep: "#D8324B",
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
export const OVERLAP = 0; // hard cuts — beats are back-to-back (no cross-dissolve)
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
