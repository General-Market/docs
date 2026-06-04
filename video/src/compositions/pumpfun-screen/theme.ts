/**
 * Axiom token-screen palette + type, matched to the reference. The "Peak" badge
 * is purple, the green is a mint, the live/sell red is a bright TradingView red.
 * One typeface (Inter) for everything; tables use tabular figures.
 */
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily, waitUntilDone } = loadFont("normal", {
  subsets: ["latin"],
  weights: ["400", "500", "600", "700", "800"],
});

export const FONT_READY = waitUntilDone; // () => Promise<void>

export const C = {
  bg: "#07080a",
  bgPanel: "#0c0e12",
  bgRow: "#0a0c10",
  hairline: "#171b22",
  green: "#2fe3a6",
  greenDim: "#1f7a4d",
  greenBar: "#2fe3a6",
  red: "#f0334a",
  redDim: "#7a2230",
  peak: "#c04dff", // purple Peak badge
  text: "#f5f6f8",
  textMute: "#8b93a1",
  textFaint: "#5b626e",
  pill: "#0b0e13",
} as const;

export const FONT_UI = fontFamily;
// Numbers use the same face with tabular figures; callers add
// fontVariantNumeric: "tabular-nums" where alignment matters.
export const FONT_MONO = fontFamily;

/** 9:16 portrait, matched to the reference framing. */
export const W = 1080;
export const H = 1920;
export const FPS = 60;
