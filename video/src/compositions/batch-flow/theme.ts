// BatchFlowReel — the batch market, from the product UI to the throughput
// graph, on a white ground carrying an accelerating blue points-and-lines
// network. Frosted cards, blue→violet gradient pills, soft glows. Brand blue
// leads; violet and pink are the pastel accents.

import { Easing } from "remotion";
import { font, monoFont } from "../../common/fonts";

export { font, monoFont };

export const FPS = 60;
export const W = 1920;
export const H = 1080;

export const sec = (s: number): number => Math.round(s * FPS);

// The panel is scaled down inside the comp so the blue broll breathes around
// it. Beats render in full 1920×1080 space and are scaled into the panel.
export const WINDOW_SCALE = 0.92;

// Blue-led pastel gradient for the pills and the flow connectors.
export const PILL_GRADIENT =
  "linear-gradient(95deg, #0071E3 0%, #5E78FF 52%, #9E7BFF 100%)";

export const C = {
  text: "#1D1D1F",
  dim: "#5A5B6A",
  faint: "#8A8B9C",
  grid: "rgba(60, 60, 110, 0.08)",
  rule: "rgba(60, 60, 110, 0.14)",
  ruleStrong: "rgba(60, 60, 110, 0.22)",
  // Card / panel fills are translucent so the frosted window reads through
  // them — anything painted on C.surface becomes glass automatically.
  surface: "rgba(255, 255, 255, 0.62)",
  surfaceSunk: "rgba(255, 255, 255, 0.34)",
  up: "#1FB877",
  upSoft: "rgba(31, 184, 119, 0.16)",
  down: "#F2566B",
  downSoft: "rgba(242, 86, 107, 0.14)",
  blue: "#0071E3",
  blueSoft: "rgba(0, 113, 227, 0.14)",
  // Pastel accents.
  accent: "#0071E3",
  accentBright: "#2997ff",
  violet: "#6E5BFF",
  pink: "#FF7AC6",
  // Glass tokens.
  glass: "rgba(255, 255, 255, 0.62)",
  glassSunk: "rgba(255, 255, 255, 0.34)",
  glassBorder: "rgba(255, 255, 255, 0.72)",
} as const;

// 12-color palette — brand blue first, then a legible pastel spread for chips
// and bars. Saturated enough to read on the frosted window, soft enough to
// sit in the pastel world.
export const NEON = [
  "#0071E3",
  "#1FB877",
  "#E8A13A",
  "#7B5CFF",
  "#17B0A6",
  "#FF7A59",
  "#9AB02A",
  "#FF6FB5",
  "#22B36B",
  "#2BA6F0",
  "#5566E0",
  "#F0556A",
] as const;

export const EASE = {
  out: Easing.bezier(0.16, 1, 0.3, 1),
  in: Easing.bezier(0.7, 0, 0.84, 0),
  inOut: Easing.bezier(0.87, 0, 0.13, 1),
  smooth: Easing.bezier(0.4, 0, 0.2, 1),
} as const;

export type BeatKey =
  | "product"
  | "enter"
  | "traders"
  | "pool"
  | "settle"
  | "payout"
  | "multiply"
  | "unlock";

export const BEATS: { key: BeatKey; seconds: number }[] = [
  { key: "product", seconds: 7.0 },
  { key: "enter", seconds: 4.0 },
  { key: "traders", seconds: 5.5 },
  { key: "pool", seconds: 6.5 },
  { key: "settle", seconds: 6.5 },
  { key: "payout", seconds: 5.5 },
  { key: "multiply", seconds: 7.0 },
  { key: "unlock", seconds: 7.0 },
];

export const OVERLAP = 30;
export const EDGE = 30; // beat slide-in / slide-out length, matches OVERLAP

export type BeatSlot = { key: BeatKey; from: number; durationInFrames: number };

export const SCHEDULE: BeatSlot[] = (() => {
  const slots: BeatSlot[] = [];
  let cursor = 0;
  BEATS.forEach((b, i) => {
    const durationInFrames = sec(b.seconds);
    const from = i === 0 ? 0 : cursor - OVERLAP;
    slots.push({ key: b.key, from, durationInFrames });
    cursor = from + durationInFrames;
  });
  return slots;
})();

export const TOTAL_FRAMES =
  SCHEDULE[SCHEDULE.length - 1].from + SCHEDULE[SCHEDULE.length - 1].durationInFrames;

export const slotFor = (key: BeatKey): BeatSlot =>
  SCHEDULE.find((s) => s.key === key) ?? SCHEDULE[0];
