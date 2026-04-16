/**
 * Wabi onboarding — timing spine, colors, tokens.
 * Eight acts, 13 seconds, 30fps, 390 frames total.
 */

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;
export const DURATION = 390;

// Act breakpoints in frames (start, end].
export const ACTS = {
  I: { start: 0, end: 27 },        // 0.9s  — Orb rises from below
  II: { start: 27, end: 69 },      // 1.4s  — Orb climbs, headline fades
  III: { start: 69, end: 87 },     // 0.6s  — Lens refracts "Meet Wabi"
  IV: { start: 87, end: 123 },     // 1.2s  — Orb settles into puck, CTAs appear
  V: { start: 123, end: 195 },     // 2.4s  — Bubbles begin rising
  VI: { start: 195, end: 270 },    // 2.5s  — Swarm compounds
  VII: { start: 270, end: 315 },   // 1.5s  — Central orb re-glassifies
  VIII: { start: 315, end: 390 },  // 2.5s  — Orb exits, bubbles linger
} as const;

export const COLOR = {
  canvas: "#F2F2F2",
  text: "#1A1A1A",
  muted: "#8E8E93",
  statusBar: "#1A1A1A",
  appleBg: "#1A1A1A",
  appleText: "#FFFFFF",
  googleBg: "#FFFFFF",
  googleText: "#1A1A1A",
  orbCore: "#4A9BFF",
  orbGlow: "#6BB6FF",
} as const;

// Typographic stack. Switzer is the local weighted family; falls back to system sans.
export const FONT_STACK =
  '"Switzer", -apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif';
