import { Easing } from "remotion";
import { font, monoFont } from "../../common/fonts";

export const FPS = 30;
export const W = 1920;
export const H = 1080;

// Brand render fonts — Geist (Inter fallback) + JetBrains Mono.
export const SANS = font;
export const MONO = monoFont;

// Pastel comparison world (docs/remotion-style-table.md §2).
export const C = {
  bg: "#F0F2F4",
  text: "#1D1D1F",
  dim: "#5A5B6A",
  faint: "#8A8B9C",
  blue: "#0071E3",
  up: "#1FB877", // pro
  down: "#F2566B", // con
  glass: "rgba(255,255,255,0.62)",
  glassBorder: "rgba(255,255,255,0.72)",
  rule: "rgba(10,10,12,0.10)",
} as const;

export const EASE = {
  out: Easing.bezier(0.16, 1, 0.3, 1),
  in: Easing.bezier(0.7, 0, 0.84, 0),
  inOut: Easing.bezier(0.87, 0, 0.13, 1),
  smooth: Easing.bezier(0.4, 0, 0.2, 1),
  cam: Easing.bezier(0.5, 0, 0.2, 1),
} as const;

// The one settle for arrivals.
export const HOUSE_SPRING = { mass: 0.6, damping: 16, stiffness: 120 } as const;
