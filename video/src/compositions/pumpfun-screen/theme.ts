/**
 * Axiom / pump.fun token-screen palette + type, sampled pixel-for-pixel from the
 * reference recording. These are not invented numbers — they come from the frame.
 */
export const C = {
  bg: "#080a0d",
  bgPanel: "#0c0f14",
  bgRow: "#0a0d12",
  hairline: "#171b22",
  green: "#34da89",
  greenDim: "#1f7a4d",
  greenBar: "#33d988",
  red: "#d6283a",
  redDim: "#7a2230",
  peak: "#46e3c8",
  text: "#f5f6f8",
  textMute: "#8b93a1",
  textFaint: "#5b626e",
  pill: "#0b0e13",
} as const;

// Axiom uses a clean grotesk for UI and a tabular mono for numbers.
export const FONT_UI =
  '-apple-system, "SF Pro Display", "Inter", "Helvetica Neue", sans-serif';
export const FONT_MONO =
  '"SF Mono", "JetBrains Mono", ui-monospace, "Menlo", monospace';

/** 9:16 portrait, matched to the reference framing. */
export const W = 1080;
export const H = 1920;
export const FPS = 60;
