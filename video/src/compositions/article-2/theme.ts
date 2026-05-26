import { Easing, interpolate } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily: INTER } = loadFont();

export const FPS = 30;
export const W = 1920;
export const H = 1080;

// Type — Inter (Shopify-style sans) for chrome + chart; serif for the article body.
export const SANS = `${INTER}, "SF Pro Display", "Helvetica Neue", Arial, sans-serif`;
export const SANS_TEXT = `${INTER}, "SF Pro Text", "Helvetica Neue", Arial, sans-serif`;
export const SERIF = 'Georgia, "Times New Roman", Times, serif';

// Accent — one knob for every mark + line. Currently blue (was orange).
export const ACCENT = "#0A84FF";
export const ACCENT_HL = "rgba(10, 132, 255, 0.40)";
export const ACCENT_SOFT = "rgba(10, 132, 255, 0.28)";

// Bloomberg page palette
export const INK = "#16181D";
export const INK_SOFT = "#6B7177";
export const PAGE = "#ffffff";
export const NAV_BG = "#0B0B0C";

// Graph scene
export const NAVY = "#0a0c12";

// A pronounced background "Ken Burns" that pushes in, pulls out, and pushes in
// again — three zoom bursts across the whole comp. The opening frame is already
// mid-push (scale climbing from 1.0), so frame 0 reads as motion, never a still.
// Range is deliberately wide (1.0–1.20) so the move is felt, not guessed at.
export const zoomBurst = (frame: number, total: number): number => {
  const k = (f: number): number => Math.round(f * total);
  return interpolate(
    frame,
    [0, k(0.16), k(0.4), k(0.62), k(0.84), total],
    [1.0, 1.16, 1.03, 1.2, 1.06, 1.13],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.cubic),
    },
  );
};
