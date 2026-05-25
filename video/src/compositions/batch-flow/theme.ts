// BatchFlowReel — the batch market, from the product UI to the throughput
// graph, in the RetailPnL CRT/neon-on-white-glow language.
//
// Lighter CRT: white-glow ground + faint scanline + vignette, neon accents,
// logo/chip cards — but the UI replica and bars stay crisp (no barrel warp).

import { Easing } from "remotion";
import { font, monoFont } from "../../common/fonts";

export { font, monoFont };

export const FPS = 60;
export const W = 1920;
export const H = 1080;

export const sec = (s: number): number => Math.round(s * FPS);

// The CRT glow ground — white bowing to pale blue-gray at the edges.
export const BG_GRADIENT =
  "radial-gradient(ellipse 120% 95% at 50% 16%, #FFFFFF 0%, #FBFCFE 60%, #EFF3F7 100%)";

export const C = {
  text: "#1D2026",
  dim: "#6E727A",
  faint: "#9AA0A8",
  grid: "rgba(10, 12, 20, 0.07)",
  rule: "rgba(10, 12, 20, 0.10)",
  ruleStrong: "rgba(10, 12, 20, 0.16)",
  surface: "#FFFFFF",
  surfaceSunk: "#F4F6F9",
  up: "#16B33F",
  upSoft: "rgba(22, 179, 63, 0.14)",
  down: "#E63838",
  downSoft: "rgba(230, 56, 56, 0.12)",
  blue: "#1F6FEB",
  blueSoft: "rgba(31, 111, 235, 0.12)",
} as const;

// 12-color neon palette, deepened for the white field (matches RetailPnL).
export const NEON = [
  "#1F6FEB",
  "#16B33F",
  "#D9931C",
  "#7B3FE4",
  "#109A8E",
  "#F0601C",
  "#8DA017",
  "#E0318C",
  "#18AE66",
  "#1B95E0",
  "#3D4CC9",
  "#E63838",
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
  | "scale"
  | "bars";

export const BEATS: { key: BeatKey; seconds: number }[] = [
  { key: "product", seconds: 7.0 },
  { key: "enter", seconds: 4.0 },
  { key: "traders", seconds: 5.5 },
  { key: "pool", seconds: 6.5 },
  { key: "settle", seconds: 6.5 },
  { key: "payout", seconds: 5.5 },
  { key: "scale", seconds: 7.0 },
  { key: "bars", seconds: 7.0 },
];

export const OVERLAP = 14;
export const EDGE = 14; // beat fade-in / fade-out length, matches OVERLAP

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
