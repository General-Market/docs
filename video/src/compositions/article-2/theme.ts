import { Easing, interpolate } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";

// Load only the latin subset and the weights this family actually uses (400–900).
// The default loadFont() pulls every subset × weight (~119 requests) and gets
// rate-limited by Google Fonts during render, which aborts the frame.
const { fontFamily: INTER } = loadFont("normal", {
  weights: ["400", "500", "600", "700", "800", "900"],
  subsets: ["latin"],
  ignoreTooManyRequestsWarning: true,
});

export const FPS = 30;
export const W = 1920;
export const H = 1080;

// Type — Inter (Shopify-style sans) for chrome + chart; serif for the article body.
export const SANS = `${INTER}, "SF Pro Display", "Helvetica Neue", Arial, sans-serif`;
export const SANS_TEXT = `${INTER}, "SF Pro Text", "Helvetica Neue", Arial, sans-serif`;
export const SERIF = 'Georgia, "Times New Roman", Times, serif';

// Accent — one knob for every mark + line. GM Electric, the canonical data
// accent from the style table (migrated from iOS systemBlue #0A84FF).
export const ACCENT = "#2D5BFF";
export const ACCENT_HL = "rgba(45, 91, 255, 0.40)";
export const ACCENT_SOFT = "rgba(45, 91, 255, 0.28)";

// Bloomberg page palette
export const INK = "#16181D";
export const INK_SOFT = "#6B7177";
export const PAGE = "#ffffff";
export const NAV_BG = "#0B0B0C";

// Graph scene
export const NAVY = "#0a0c12";

// A single, continuous push-in across the whole comp — one direction, no
// reversal. A slow, assured dolly toward the page that reads as confidence,
// never a nervous in-and-out. It is already moving on frame 0, so the open is
// never a still. Range is felt (1.02–1.16) without ever pulling back.
export const articleZoom = (frame: number, total: number): number =>
  interpolate(frame, [0, total], [1.02, 1.16], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
